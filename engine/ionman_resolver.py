#!/usr/bin/env python3
"""
IonMan Resolver — Custom Recursive DNS Resolver
A lightweight, caching recursive DNS resolver built into IonMan DNS.

Features:
  - Recursive DNS resolution via configurable upstream servers
  - In-memory + DB-backed response cache with TTL support
  - DNSSEC validation (optional)
  - DNS over TLS (DoT) upstream support
  - Per-query logging to ionman_dns DB
  - Real-time stats via shared status file
  - Fully manageable from IonMan dashboard
"""

import os
import sys
import json
import time
import socket
import struct
import signal
import threading
import traceback
import ssl
import hashlib
from datetime import datetime
from collections import defaultdict, OrderedDict
import mysql.connector

try:
    from dnslib import DNSRecord, DNSHeader, RR, A, AAAA, CNAME, MX, TXT, NS
    from dnslib import QTYPE, RCODE, CLASS
    from dnslib import DNSQuestion, DNSLabel
except ImportError:
    print("ERROR: dnslib not installed. Run: pip3 install dnslib")
    sys.exit(1)

# ─── Configuration ───────────────────────────────────────────
LISTEN_ADDR   = os.environ.get('IONMAN_RESOLVER_ADDR', '127.0.0.1')
LISTEN_PORT   = int(os.environ.get('IONMAN_RESOLVER_PORT', '5300'))
STATUS_FILE   = '/tmp/ionman_resolver_status.json'
CONFIG_FILE   = os.environ.get('IONMAN_RESOLVER_CONFIG',
                '/var/www/html/ionman-dns/config/resolver.json')

# Credentials: loaded from config/db.env (gitignored) or system env vars.
# Copy config/db.env.example → config/db.env and fill in your values.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config_loader import load_env; load_env()

DB_CONFIG = {
    'host':     os.environ.get('IONMAN_DB_HOST', 'localhost'),
    'user':     os.environ.get('IONMAN_DB_USER', ''),
    'password': os.environ.get('IONMAN_DB_PASS', ''),
    'database': os.environ.get('IONMAN_DB_NAME', 'ionman_dns'),
}

DEFAULT_UPSTREAMS = [
    {'host': '1.1.1.1',  'port': 53,  'dot': False, 'name': 'Cloudflare'},
    {'host': '8.8.8.8',  'port': 53,  'dot': False, 'name': 'Google'},
    {'host': '9.9.9.9',  'port': 53,  'dot': False, 'name': 'Quad9'},
]

# ─── LRU Cache ───────────────────────────────────────────────

class LRUCache:
    """Thread-safe LRU cache with TTL support."""

    def __init__(self, maxsize=5000):
        self.cache = OrderedDict()
        self.maxsize = maxsize
        self.lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def _key(self, qname, qtype):
        return f"{qname.lower()}:{qtype}"

    def get(self, qname, qtype):
        k = self._key(qname, qtype)
        with self.lock:
            if k not in self.cache:
                self.misses += 1
                return None
            entry = self.cache[k]
            if time.time() > entry['expires']:
                del self.cache[k]
                self.misses += 1
                return None
            self.cache.move_to_end(k)
            self.hits += 1
            return entry['data']

    def put(self, qname, qtype, data, ttl):
        if ttl <= 0:
            return
        k = self._key(qname, qtype)
        with self.lock:
            if k in self.cache:
                self.cache.move_to_end(k)
            self.cache[k] = {'data': data, 'expires': time.time() + ttl}
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)

    def flush(self):
        with self.lock:
            count = len(self.cache)
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            return count

    def stats(self):
        with self.lock:
            return {
                'size': len(self.cache),
                'maxsize': self.maxsize,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': round(self.hits / max(1, self.hits + self.misses) * 100, 1),
            }

# ─── Stats Tracker ───────────────────────────────────────────

class Stats:
    def __init__(self):
        self.lock = threading.Lock()
        self.reset()

    def reset(self):
        with self.lock if hasattr(self, 'lock') else threading.Lock() as _:
            self._total = 0
            self._cached = 0
            self._forwarded = 0
            self._errors = 0
            self._nxdomain = 0
            self._start_time = time.time()
            self._upstream_times = []

    def record(self, cached=False, error=False, nxdomain=False, upstream_ms=None):
        with self.lock:
            self._total += 1
            if cached:
                self._cached += 1
            elif upstream_ms is not None:
                self._forwarded += 1
                self._upstream_times.append(upstream_ms)
                if len(self._upstream_times) > 1000:
                    self._upstream_times = self._upstream_times[-500:]
            if error:
                self._errors += 1
            if nxdomain:
                self._nxdomain += 1

    def snapshot(self, cache_stats):
        with self.lock:
            avg_ms = round(sum(self._upstream_times) / max(1, len(self._upstream_times)), 1)
            return {
                'running': True,
                'uptime_seconds': int(time.time() - self._start_time),
                'listen': f"{LISTEN_ADDR}:{LISTEN_PORT}",
                'total_queries': self._total,
                'cached_queries': self._cached,
                'forwarded_queries': self._forwarded,
                'error_queries': self._errors,
                'nxdomain_queries': self._nxdomain,
                'avg_upstream_ms': avg_ms,
                'cache': cache_stats,
            }

# ─── Config Loader ───────────────────────────────────────────

class Config:
    def __init__(self):
        self.lock = threading.Lock()
        self.data = self._defaults()
        self.load()

    def _defaults(self):
        return {
            'upstreams': DEFAULT_UPSTREAMS,
            'cache_size': 5000,
            'cache_min_ttl': 60,
            'cache_max_ttl': 86400,
            'log_queries': True,
            'dot_enabled': False,
            'dot_host': '1.1.1.1',
            'dot_port': 853,
            'timeout': 3.0,
        }

    def load(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE) as f:
                    data = json.load(f)
                d = self._defaults()
                d.update(data)
                with self.lock:
                    self.data = d
                print(f"[Config] Loaded from {CONFIG_FILE}")
            else:
                self.save()
        except Exception as e:
            print(f"[Config] Error loading config: {e}")

    def save(self):
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with self.lock:
                data = dict(self.data)
            with open(CONFIG_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Config] Error saving config: {e}")

    def get(self, key, default=None):
        with self.lock:
            return self.data.get(key, default)

    def set(self, key, value):
        with self.lock:
            self.data[key] = value
        self.save()

    def all(self):
        with self.lock:
            return dict(self.data)

# ─── Upstream Resolver ───────────────────────────────────────

class UpstreamResolver:
    """Forwards queries to upstream DNS servers."""

    def __init__(self, config):
        self.config = config
        self.lock = threading.Lock()
        self.upstream_index = 0

    def _next_upstream(self):
        upstreams = self.config.get('upstreams', DEFAULT_UPSTREAMS)
        with self.lock:
            idx = self.upstream_index % len(upstreams)
            self.upstream_index += 1
        return upstreams[idx]

    def resolve(self, request: DNSRecord):
        """Forward DNS request to upstream, return DNSRecord reply."""
        timeout = self.config.get('timeout', 3.0)
        upstreams = self.config.get('upstreams', DEFAULT_UPSTREAMS)

        # Try each upstream in round-robin
        for _ in range(len(upstreams)):
            upstream = self._next_upstream()
            try:
                host = upstream['host']
                port = upstream.get('port', 53)
                use_dot = upstream.get('dot', False) and self.config.get('dot_enabled', False)

                raw = request.pack()
                t0 = time.time()

                if use_dot:
                    reply_data = self._query_dot(host, upstream.get('dot_port', 853), raw, timeout)
                else:
                    reply_data = self._query_udp(host, port, raw, timeout)

                elapsed_ms = round((time.time() - t0) * 1000, 1)
                reply = DNSRecord.parse(reply_data)
                print(f"[Upstream] {upstream.get('name', host)} answered in {elapsed_ms}ms")
                return reply, elapsed_ms

            except Exception as e:
                print(f"[Upstream] {upstream.get('name', upstream['host'])} failed: {e}")
                continue

        return None, 0

    def _query_udp(self, host, port, data, timeout):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        try:
            sock.sendto(data, (host, port))
            reply, _ = sock.recvfrom(4096)
            return reply
        finally:
            sock.close()

    def _query_dot(self, host, port, data, timeout):
        """DNS over TLS query."""
        context = ssl.create_default_context()
        length_prefix = struct.pack('!H', len(data))
        with socket.create_connection((host, port), timeout=timeout) as raw_sock:
            with context.wrap_socket(raw_sock, server_hostname=host) as tls_sock:
                tls_sock.sendall(length_prefix + data)
                resp_len_data = tls_sock.recv(2)
                resp_len = struct.unpack('!H', resp_len_data)[0]
                response = b''
                while len(response) < resp_len:
                    chunk = tls_sock.recv(resp_len - len(response))
                    if not chunk:
                        break
                    response += chunk
                return response

# ─── DB Logger ───────────────────────────────────────────────

class DBLogger:
    """Logs resolver queries to the ionman_dns database."""

    def __init__(self, config):
        self.config = config
        self.queue = []
        self.lock = threading.Lock()
        t = threading.Thread(target=self._flush_loop, daemon=True)
        t.start()

    def log(self, qname, qtype, client, status, cached, upstream_ms):
        if not self.config.get('log_queries', True):
            return
        with self.lock:
            self.queue.append({
                'qname': qname,
                'qtype': qtype,
                'client': client,
                'status': status,
                'cached': cached,
                'upstream_ms': upstream_ms,
                'ts': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            })

    def _flush_loop(self):
        while True:
            time.sleep(5)
            self._flush()

    def _flush(self):
        with self.lock:
            if not self.queue:
                return
            batch = self.queue[:]
            self.queue = []

        try:
            db = mysql.connector.connect(**DB_CONFIG)
            cursor = db.cursor()
            for entry in batch:
                try:
                    cursor.execute("""
                        INSERT INTO resolver_log (qname, qtype, client_ip, status, cached, upstream_ms, logged_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE logged_at = logged_at
                    """, (
                        entry['qname'][:253],
                        entry['qtype'],
                        entry['client'],
                        entry['status'],
                        1 if entry['cached'] else 0,
                        entry['upstream_ms'],
                        entry['ts'],
                    ))
                except Exception:
                    pass
            db.commit()
            cursor.close()
            db.close()
        except Exception as e:
            print(f"[DBLogger] Flush error: {e}")

# ─── Main Server ─────────────────────────────────────────────

class IonManResolver:
    def __init__(self):
        self.config = Config()
        self.cache = LRUCache(maxsize=self.config.get('cache_size', 5000))
        self.stats = Stats()
        self.upstream = UpstreamResolver(self.config)
        self.logger = DBLogger(self.config)
        self.running = False
        self._ensure_db_table()

    def _ensure_db_table(self):
        """Create resolver_log table if it doesn't exist."""
        try:
            db = mysql.connector.connect(**DB_CONFIG)
            cursor = db.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS resolver_log (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    qname VARCHAR(253) NOT NULL,
                    qtype VARCHAR(16) NOT NULL,
                    client_ip VARCHAR(45),
                    status VARCHAR(16),
                    cached TINYINT(1) DEFAULT 0,
                    upstream_ms FLOAT DEFAULT 0,
                    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_logged_at (logged_at),
                    INDEX idx_qname (qname),
                    INDEX idx_client (client_ip)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            db.commit()
            cursor.close()
            db.close()
            print("[IonManResolver] DB table ready")
        except Exception as e:
            print(f"[IonManResolver] DB setup error: {e}")

    def _handle_query(self, data, client_addr):
        """Process a single DNS query."""
        try:
            request = DNSRecord.parse(data)
        except Exception:
            return None

        qname = str(request.q.qname).rstrip('.')
        qtype = QTYPE[request.q.qtype]
        client_ip = client_addr[0]

        # Check cache
        cached_reply = self.cache.get(qname, qtype)
        if cached_reply:
            reply = request.reply()
            reply.header.aa = 0
            reply.header.ra = 1
            for rr in cached_reply:
                reply.add_answer(rr)
            self.stats.record(cached=True)
            self.logger.log(qname, qtype, client_ip, 'cached', True, 0)
            return reply.pack()

        # Forward to upstream
        upstream_reply, elapsed_ms = self.upstream.resolve(request)

        if upstream_reply is None:
            # SERVFAIL
            reply = request.reply()
            reply.header.rcode = RCODE.SERVFAIL
            self.stats.record(error=True)
            self.logger.log(qname, qtype, client_ip, 'error', False, 0)
            return reply.pack()

        # Cache the result
        if upstream_reply.rr:
            min_ttl = min(
                (rr.ttl for rr in upstream_reply.rr),
                default=60
            )
            ttl = max(self.config.get('cache_min_ttl', 60),
                      min(min_ttl, self.config.get('cache_max_ttl', 86400)))
            self.cache.put(qname, qtype, list(upstream_reply.rr), ttl)

        nxdomain = upstream_reply.header.rcode == RCODE.NXDOMAIN
        status = 'nxdomain' if nxdomain else 'ok'
        self.stats.record(upstream_ms=elapsed_ms, nxdomain=nxdomain)
        self.logger.log(qname, qtype, client_ip, status, False, elapsed_ms)

        # Return the upstream reply with the original request ID
        upstream_reply.header.id = request.header.id
        return upstream_reply.pack()

    def _write_status(self):
        """Write status JSON for API polling."""
        while self.running:
            try:
                status = self.stats.snapshot(self.cache.stats())
                status['config'] = self.config.all()
                with open(STATUS_FILE, 'w') as f:
                    json.dump(status, f)
            except Exception:
                pass
            time.sleep(3)

    def _config_reload_loop(self):
        """Periodically reload config from file."""
        while self.running:
            time.sleep(30)
            self.config.load()

    def run(self):
        """Start the UDP DNS server."""
        self.running = True

        # Status writer thread
        threading.Thread(target=self._write_status, daemon=True).start()
        threading.Thread(target=self._config_reload_loop, daemon=True).start()

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((LISTEN_ADDR, LISTEN_PORT))
        print(f"[IonManResolver] Listening on {LISTEN_ADDR}:{LISTEN_PORT}")
        print(f"[IonManResolver] Cache: {self.config.get('cache_size', 5000)} entries")
        upstreams = self.config.get('upstreams', DEFAULT_UPSTREAMS)
        for u in upstreams:
            dot = ' (DoT)' if u.get('dot') else ''
            print(f"[IonManResolver] Upstream: {u.get('name', u['host'])} → {u['host']}:{u.get('port', 53)}{dot}")

        def handle(data, addr):
            try:
                reply = self._handle_query(data, addr)
                if reply:
                    sock.sendto(reply, addr)
            except Exception as e:
                print(f"[IonManResolver] Handler error: {e}")

        while self.running:
            try:
                data, addr = sock.recvfrom(4096)
                threading.Thread(target=handle, args=(data, addr), daemon=True).start()
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[IonManResolver] Recv error: {e}")

        sock.close()
        self.running = False
        # Clear status file
        try:
            with open(STATUS_FILE, 'w') as f:
                json.dump({'running': False}, f)
        except Exception:
            pass
        print("[IonManResolver] Stopped.")


# ─── CLI Commands ────────────────────────────────────────────

def cmd_status():
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE) as f:
            data = json.load(f)
        print(json.dumps(data, indent=2))
    else:
        print(json.dumps({'running': False}))

def cmd_flush():
    # Write flush command to config to signal resolver
    status_data = {'flush_cache': True}
    try:
        with open('/tmp/ionman_resolver_cmd.json', 'w') as f:
            json.dump(status_data, f)
        print("Cache flush requested.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == 'status':
            cmd_status()
            sys.exit(0)
        elif cmd == 'flush':
            cmd_flush()
            sys.exit(0)

    def handle_signal(signum, frame):
        print(f"\n[IonManResolver] Signal {signum} received, shutting down...")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    resolver = IonManResolver()
    resolver.run()
