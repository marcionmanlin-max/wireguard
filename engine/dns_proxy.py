#!/usr/bin/env python3
"""
IonMan DNS - Per-Peer Category Blocking Proxy

Lightweight DNS proxy that sits in front of dnsmasq.
Handles per-peer/group category blocking before forwarding to dnsmasq.

Flow:
  1. DNS query from WireGuard peer (10.0.0.X)
  2. Lookup peer → get per-peer category rules (or fall back to global defaults)
  3. If domain matches a blocked category → respond with 0.0.0.0 / ::
  4. Else → forward to dnsmasq on UPSTREAM_PORT for global blocklist handling
"""

import json
import os
import sys
import time
import signal
import struct
import socket
import threading
import traceback
import queue
import mysql.connector
from dnslib import DNSRecord, RR, A, AAAA, QTYPE, RCODE, DNSHeader

# ─── Configuration ──────────────────────────────────────────
LISTEN_ADDR  = os.environ.get('IONMAN_DNS_LISTEN', '0.0.0.0')
LISTEN_PORT  = int(os.environ.get('IONMAN_DNS_PORT', '53'))
UPSTREAM_ADDR = os.environ.get('IONMAN_UPSTREAM_ADDR', '127.0.0.1')
UPSTREAM_PORT = int(os.environ.get('IONMAN_UPSTREAM_PORT', '5353'))
CATEGORIES_FILE = os.environ.get('IONMAN_CATEGORIES', '/var/www/html/ionman-dns/config/categories.json')
GAME_PORTS_FILE = os.environ.get('IONMAN_GAME_PORTS', '/var/www/html/ionman-dns/config/game_ports.json')
RELOAD_INTERVAL = 30  # seconds
BLOCK_TTL = 300

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

LOG_BLOCKED = True  # Log blocked queries to database

# ─── Rule Engine ────────────────────────────────────────────

class RuleEngine:
    """Manages per-peer category blocking rules."""

    # Categories that are ALWAYS enforced for ALL peers, regardless of per-peer rules
    ALWAYS_ON_CATEGORIES = {'ads'}

    def __init__(self):
        self.categories = {}      # cat_key -> set of domains
        self.cat_labels = {}      # cat_key -> label
        self.global_rules = {}    # cat_key -> bool (from settings)
        self.peer_rules = {}      # peer_ip -> { cat_key -> bool }
        self.peer_domain_rules = {}  # peer_ip -> set of blocked domains
        self.whitelist = set()    # globally whitelisted domains (from DB whitelist table)
        # Game-specific overrides (from port_blocking system)
        self.game_domains = {}        # game_key -> set of domains
        self.global_game_blocks = {}  # game_key -> bool (from settings port_block_*)
        self.peer_game_rules = {}     # peer_ip -> { game_key -> bool }
        self.lock = threading.Lock()
        self._load_categories()
        self._load_game_ports()
        self.reload_rules()

    def _load_categories(self):
        """Load category domain lists from JSON file."""
        try:
            with open(CATEGORIES_FILE) as f:
                data = json.load(f)
            cats = {}
            labels = {}
            for key, info in data.items():
                cats[key] = set(d.lower() for d in info.get('domains', []))
                labels[key] = info.get('label', key)
            with self.lock:
                self.categories = cats
                self.cat_labels = labels
            print(f"[RuleEngine] Loaded {len(cats)} categories, "
                  f"{sum(len(v) for v in cats.values())} total domains")
        except Exception as e:
            print(f"[RuleEngine] Error loading categories: {e}")

    def _load_game_ports(self):
        """Load game port definitions (for game→domain mapping)."""
        try:
            if not os.path.exists(GAME_PORTS_FILE):
                return
            with open(GAME_PORTS_FILE) as f:
                data = json.load(f)
            game_domains = {}
            for key, info in data.items():
                domains = set(d.lower() for d in info.get('domains', []))
                if domains:
                    game_domains[key] = domains
            with self.lock:
                self.game_domains = game_domains
            print(f"[RuleEngine] Loaded {len(game_domains)} games with domains")
        except Exception as e:
            print(f"[RuleEngine] Error loading game ports: {e}")

    def reload_rules(self):
        """Reload categories from JSON + per-peer rules and global defaults from DB."""
        self._load_categories()  # Always reload categories to pick up new domains
        self._load_game_ports()  # Reload game port definitions
        try:
            db = mysql.connector.connect(**DB_CONFIG)
            cursor = db.cursor(dictionary=True)

            # Global category settings (block_social, block_gaming, etc.)
            new_global = {}
            for key in self.categories:
                cursor.execute(
                    "SELECT setting_value FROM settings WHERE setting_key = %s",
                    (f'block_{key}',)
                )
                row = cursor.fetchone()
                new_global[key] = (row and row['setting_value'] == '1')

            # Per-peer rules from client_blocking_rules (target_type='peer')
            new_peer = {}
            cursor.execute("""
                SELECT cbr.target_id, cbr.rule_key, cbr.enabled, wp.allowed_ips
                FROM client_blocking_rules cbr
                JOIN wg_peers wp ON wp.id = cbr.target_id
                WHERE cbr.target_type = 'peer' AND cbr.rule_type = 'category'
            """)
            for row in cursor.fetchall():
                ip = row['allowed_ips'].split('/')[0]
                if ip not in new_peer:
                    new_peer[ip] = {}
                new_peer[ip][row['rule_key']] = bool(row['enabled'])

            # Group rules (target_type='group')
            cursor.execute("""
                SELECT cgm.peer_id, cbr.rule_key, cbr.enabled, wp.allowed_ips
                FROM client_blocking_rules cbr
                JOIN client_group_members cgm ON cgm.group_id = cbr.target_id
                JOIN wg_peers wp ON wp.id = cgm.peer_id
                WHERE cbr.target_type = 'group' AND cbr.rule_type = 'category'
            """)
            for row in cursor.fetchall():
                ip = row['allowed_ips'].split('/')[0]
                if ip not in new_peer:
                    new_peer[ip] = {}
                # Peer-level rules take precedence over group-level
                if row['rule_key'] not in new_peer[ip]:
                    new_peer[ip][row['rule_key']] = bool(row['enabled'])

            # Per-peer domain-level blocklist rules (rule_type='blocklist')
            new_peer_domains = {}
            cursor.execute("""
                SELECT cbr.target_id, cbr.rule_key, wp.allowed_ips
                FROM client_blocking_rules cbr
                JOIN wg_peers wp ON wp.id = cbr.target_id
                WHERE cbr.target_type = 'peer' AND cbr.rule_type = 'blocklist' AND cbr.enabled = 1
            """)
            for row in cursor.fetchall():
                ip = row['allowed_ips'].split('/')[0]
                if ip not in new_peer_domains:
                    new_peer_domains[ip] = set()
                new_peer_domains[ip].add(row['rule_key'].lower())

            # Load whitelist
            cursor.execute("SELECT domain FROM whitelist")
            new_whitelist = set(row['domain'].lower() for row in cursor.fetchall())

            # Load game-specific port blocking overrides
            # Global game blocks (port_block_roblox, port_block_minecraft, etc.)
            new_global_game = {}
            cursor.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'port_block_%%'")
            for row in cursor.fetchall():
                game_key = row['setting_key'].replace('port_block_', '')
                new_global_game[game_key] = row['setting_value'] == '1'

            # Per-peer game blocks from port_blocking_rules
            new_peer_game = {}
            cursor.execute("""
                SELECT client_ip, game_key, enabled FROM port_blocking_rules
            """)
            for row in cursor.fetchall():
                ip = row['client_ip'].split('/')[0]
                if ip not in new_peer_game:
                    new_peer_game[ip] = {}
                new_peer_game[ip][row['game_key']] = bool(row['enabled'])

            db.close()

            with self.lock:
                self.global_rules = new_global
                self.peer_rules = new_peer
                self.peer_domain_rules = new_peer_domains
                self.whitelist = new_whitelist
                self.global_game_blocks = new_global_game
                self.peer_game_rules = new_peer_game

            peer_count = len(new_peer)
            domain_peer_count = len(new_peer_domains)
            total_domain_rules = sum(len(v) for v in new_peer_domains.values())
            global_on = [k for k, v in new_global.items() if v]
            game_allowed = [k for k, v in new_global_game.items() if not v]
            print(f"[RuleEngine] Reloaded: {peer_count} peers with custom rules, "
                  f"{domain_peer_count} peers with {total_domain_rules} domain rules, "
                  f"global blocked: {', '.join(global_on) or 'none'}, "
                  f"games allowed: {', '.join(game_allowed) or 'none'}")

        except Exception as e:
            print(f"[RuleEngine] Error reloading rules: {e}")
            traceback.print_exc()

    # Adult content auto-detection keywords and TLDs
    ADULT_TLDS = {'.xxx', '.adult', '.sex', '.porn', '.sexy'}
    ADULT_KEYWORDS = {
        'porn', 'xxx', 'hentai', 'nsfw', 'xvideos', 'xnxx', 'xhamster',
        'redtube', 'youporn', 'brazzers', 'bangbros', 'naughty',
        'camgirl', 'livecam', 'sexcam', 'chaturbate', 'stripchat',
        'onlyfans', 'fapello', 'rule34', 'nhentai', 'e621',
        'spankbang', 'eporner', 'tube8', 'beeg', 'porntube',
        'pornstar', 'livejasmin', 'cam4', 'bongacams', 'myfreecams',
        'slutty', 'milf', 'hardcore',
    }
    # Partial keyword matching in domain parts (avoid false positives)
    ADULT_PART_KEYWORDS = {
        'porn', 'xxx', 'hentai', 'nsfw', 'xvideo', 'xnxx', 'xhamster',
        'sexcam', 'livecam', 'camgirl', 'fap',
    }

    def _is_adult_domain(self, domain):
        """Heuristic check if domain looks like an adult/porn site.
        Uses TLD matching and keyword detection in domain parts."""
        # Check adult TLDs
        for tld in self.ADULT_TLDS:
            if domain.endswith(tld):
                return True

        # Split domain into meaningful parts (remove common TLDs)
        parts = domain.replace('.', ' ').split()
        for part in parts:
            if part in self.ADULT_KEYWORDS:
                return True
            # Check if any part contains adult keywords (e.g., pornhub, xxxvideos)
            for kw in self.ADULT_PART_KEYWORDS:
                if kw in part and len(part) > len(kw):
                    return True

        return False

    def is_blocked(self, client_ip, domain):
        """
        Check if domain should be blocked for this client IP.
        Returns (blocked: bool, category: str|None)
        Priority:
          0. Whitelist always wins (never block)
          1. Game-specific overrides from port_blocking (allow specific games even if category blocked)
          2. Per-peer domain rules (blocklist)
          3. Per-peer category rules > global category defaults
        Supports subdomain matching: blocking 'tiktok.com' also blocks 'www.tiktok.com'
        """
        domain = domain.lower().rstrip('.')
        with self.lock:
            # 0. Whitelist always wins - never block whitelisted domains
            if self._domain_matches(domain, self.whitelist):
                return False, None

            # 1. Check game-specific override: if a game is explicitly allowed
            #    for this peer (or globally), its domains bypass category blocking
            if self._is_game_allowed(client_ip, domain):
                return False, None

            # 2. Check per-peer domain-level blocklist rules first
            peer_domains = self.peer_domain_rules.get(client_ip)
            if peer_domains:
                if self._domain_matches(domain, peer_domains):
                    return True, 'blocklist'

            # 3. Check category-level rules
            custom = self.peer_rules.get(client_ip)

            for cat_key, cat_domains in self.categories.items():
                if self._domain_matches(domain, cat_domains):
                    # Always-on categories (ads) are blocked regardless of per-peer settings
                    if cat_key in self.ALWAYS_ON_CATEGORIES:
                        if self.global_rules.get(cat_key, False):
                            return True, cat_key
                    elif custom is not None and cat_key in custom:
                        # Per-peer explicit rule exists
                        if custom[cat_key]:
                            return True, cat_key
                    else:
                        # Fall back to global default
                        if self.global_rules.get(cat_key, False):
                            return True, cat_key

            # 4. Auto-detect adult/porn content by keywords and TLDs
            #    Only triggers when porn category is globally or per-peer blocked
            porn_blocked = False
            if custom is not None and 'porn' in custom:
                porn_blocked = custom['porn']
            else:
                porn_blocked = self.global_rules.get('porn', False)

            if porn_blocked and self._is_adult_domain(domain):
                # Auto-detected as adult, add to porn category for future lookups
                if 'porn' in self.categories:
                    base = domain.split('.')
                    if len(base) >= 2:
                        root = '.'.join(base[-2:]) if base[-1] not in ('xxx', 'adult', 'sex', 'porn', 'sexy') else '.'.join(base[-2:])
                        self.categories['porn'].add(root)
                print(f"[AutoDetect] Adult domain detected: {domain}")
                return True, 'porn'

        return False, None

    def _is_game_allowed(self, client_ip, domain):
        """Check if domain belongs to a game that is explicitly allowed for this client.
        If a game is unblocked in port-blocking (either globally or per-peer),
        its domains should NOT be DNS-blocked even if the parent category is blocked.
        """
        for game_key, game_domain_set in self.game_domains.items():
            if self._domain_matches(domain, game_domain_set):
                # Check per-peer game rule first
                peer_game = self.peer_game_rules.get(client_ip, {})
                if game_key in peer_game:
                    if not peer_game[game_key]:  # explicitly allowed (enabled=False)
                        return True
                    # explicitly blocked — don't override, let category blocking decide
                    return False

                # Fall back to global game block setting
                if game_key in self.global_game_blocks:
                    if not self.global_game_blocks[game_key]:  # globally allowed
                        return True

                # Fall back to game_ports.json default_blocked
                # (we don't have default_blocked here, but if no setting exists,
                # it means the game was never configured — don't override)
                return False
        return False

    @staticmethod
    def _domain_matches(domain, domain_set):
        """Check if domain or any of its parent domains is in domain_set.
        e.g. 'v16.tiktokcdn.com' matches if 'tiktokcdn.com' is in the set.
        """
        if domain in domain_set:
            return True
        # Walk up domain parts: a.b.c.com -> b.c.com -> c.com
        parts = domain.split('.')
        for i in range(1, len(parts) - 1):
            parent = '.'.join(parts[i:])
            if parent in domain_set:
                return True
        return False


# ─── DNS Proxy Server ──────────────────────────────────────

class QueryLogger:
    """Async query logger — collects queries in a queue and batch-inserts to DB."""

    def __init__(self):
        self.q = queue.Queue(maxsize=50000)
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def log(self, client_ip, domain, qtype, action):
        try:
            self.q.put_nowait((client_ip, domain, str(qtype), action))
        except queue.Full:
            pass  # drop silently under extreme load

    def _worker(self):
        db = None
        while True:
            batch = []
            try:
                # Block until at least one item
                item = self.q.get(timeout=3)
                batch.append(item)
                # Drain queue up to 500
                while len(batch) < 500:
                    try:
                        batch.append(self.q.get_nowait())
                    except queue.Empty:
                        break

                if not db or not db.is_connected():
                    db = mysql.connector.connect(**DB_CONFIG)
                cursor = db.cursor()
                cursor.executemany(
                    "INSERT INTO query_log (client_ip, domain, query_type, action, logged_at) "
                    "VALUES (%s, %s, %s, %s, NOW())",
                    batch
                )
                db.commit()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[QueryLogger] Error flushing batch: {e}")
                db = None
                time.sleep(1)


# Global query logger instance
_query_logger = None

def get_query_logger():
    global _query_logger
    if _query_logger is None:
        _query_logger = QueryLogger()
    return _query_logger


class DNSProxy:
    """UDP DNS proxy with per-peer category blocking."""

    def __init__(self, rules):
        self.rules = rules
        self.logger = get_query_logger()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((LISTEN_ADDR, LISTEN_PORT))
        self.running = True
        print(f"[DNSProxy] Listening on {LISTEN_ADDR}:{LISTEN_PORT}")
        print(f"[DNSProxy] Upstream dnsmasq at {UPSTREAM_ADDR}:{UPSTREAM_PORT}")
        print(f"[DNSProxy] Logging ALL queries to database")

    def serve_forever(self):
        while self.running:
            try:
                data, addr = self.sock.recvfrom(4096)
                threading.Thread(
                    target=self._handle,
                    args=(data, addr),
                    daemon=True
                ).start()
            except OSError:
                if self.running:
                    traceback.print_exc()
                break
            except Exception:
                traceback.print_exc()

    def stop(self):
        self.running = False
        self.sock.close()

    def _handle(self, data, addr):
        try:
            request = DNSRecord.parse(data)
        except Exception:
            return  # Malformed DNS packet

        client_ip = addr[0]
        qname = str(request.q.qname).rstrip('.')
        qtype = request.q.qtype
        qtype_str = QTYPE[qtype]

        # Check per-peer blocking
        blocked, category = self.rules.is_blocked(client_ip, qname)

        if blocked:
            reply = request.reply()
            if qtype == QTYPE.A:
                reply.add_answer(RR(
                    request.q.qname, QTYPE.A,
                    rdata=A("0.0.0.0"), ttl=BLOCK_TTL
                ))
            elif qtype == QTYPE.AAAA:
                reply.add_answer(RR(
                    request.q.qname, QTYPE.AAAA,
                    rdata=AAAA("::"), ttl=BLOCK_TTL
                ))
            elif qtype == QTYPE.HTTPS:
                reply.header.rcode = RCODE.NXDOMAIN
            else:
                reply.add_answer(RR(
                    request.q.qname, QTYPE.A,
                    rdata=A("0.0.0.0"), ttl=BLOCK_TTL
                ))

            self.sock.sendto(reply.pack(), addr)
            self.logger.log(client_ip, qname, qtype_str, 'blocked')
            return

        # Forward to upstream dnsmasq
        try:
            upstream_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            upstream_sock.settimeout(5)
            upstream_sock.sendto(data, (UPSTREAM_ADDR, UPSTREAM_PORT))
            response, _ = upstream_sock.recvfrom(4096)
            upstream_sock.close()
            self.sock.sendto(response, addr)

            # Check if dnsmasq blocked it (response has 0.0.0.0)
            action = 'allowed'
            try:
                resp_record = DNSRecord.parse(response)
                for rr in resp_record.rr:
                    if str(rr.rdata) in ('0.0.0.0', '::', '127.0.0.1'):
                        action = 'blocked'
                        break
            except Exception:
                pass

            self.logger.log(client_ip, qname, qtype_str, action)
        except socket.timeout:
            reply = request.reply()
            reply.header.rcode = RCODE.SERVFAIL
            self.sock.sendto(reply.pack(), addr)
            self.logger.log(client_ip, qname, qtype_str, 'allowed')
        except Exception as e:
            print(f"[DNSProxy] Upstream error for {qname}: {e}")


# ─── Reload Timer ───────────────────────────────────────────

def reload_timer(rules):
    """Periodically reload rules from DB."""
    while True:
        time.sleep(RELOAD_INTERVAL)
        rules.reload_rules()


# ─── Main ───────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  IonMan DNS - Per-Peer Category Blocking Proxy")
    print("=" * 60)

    rules = RuleEngine()

    # Start reload thread
    t = threading.Thread(target=reload_timer, args=(rules,), daemon=True)
    t.start()

    proxy = DNSProxy(rules)

    def shutdown(sig, frame):
        print("\n[DNSProxy] Shutting down...")
        proxy.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    def reload_handler(sig, frame):
        print("[DNSProxy] SIGHUP received — reloading rules...")
        rules.reload_rules()

    signal.signal(signal.SIGHUP, reload_handler)

    proxy.serve_forever()


if __name__ == '__main__':
    main()
