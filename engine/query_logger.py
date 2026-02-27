#!/usr/bin/env python3
"""
IonMan DNS - DNS Query Logger
Parses dnsmasq log file and stores queries in the database.
Detects blocked queries from dnsmasq's actual config responses.
"""

import re
import time
import os
import mysql.connector
from datetime import datetime
from collections import OrderedDict

# Credentials: loaded from config/db.env (gitignored) or system env vars.
# Copy config/db.env.example → config/db.env and fill in your values.
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config_loader import load_env; load_env()

DB_CONFIG = {
    'host':     os.environ.get('IONMAN_DB_HOST', 'localhost'),
    'user':     os.environ.get('IONMAN_DB_USER', ''),
    'password': os.environ.get('IONMAN_DB_PASS', ''),
    'database': os.environ.get('IONMAN_DB_NAME', 'ionman_dns'),
}

DNSMASQ_LOG = '/var/log/dnsmasq-ionman.log'

# Regex patterns for dnsmasq log lines
QUERY_RE = re.compile(r'query\[(\w+)\]\s+(\S+)\s+from\s+(\S+)')
CONFIG_RE = re.compile(r'config\s+(\S+)\s+is\s+(0\.0\.0\.0|127\.0\.0\.1|::)')
FORWARDED_RE = re.compile(r'forwarded\s+(\S+)\s+to\s+(\S+)')
REPLY_RE = re.compile(r'reply\s+(\S+)\s+is\s+(\S+)')
CACHED_RE = re.compile(r'cached\s+(\S+)\s+is\s+(\S+)')

# Also match regex-based blocking
REGEX_BLOCKED_RE = re.compile(r'/(\S+)\s+is\s+(0\.0\.0\.0|127\.0\.0\.1|::)')


class QueryTracker:
    """Track pending queries and match with responses"""
    
    def __init__(self, max_size=10000):
        self.pending = OrderedDict()  # domain -> (qtype, client, timestamp)
        self.max_size = max_size
    
    def add_query(self, domain, qtype, client):
        domain_lower = domain.lower()
        self.pending[domain_lower] = (qtype, client, datetime.now())
        # Prune old entries
        while len(self.pending) > self.max_size:
            self.pending.popitem(last=False)
    
    def mark_blocked(self, domain):
        domain_lower = domain.lower()
        if domain_lower in self.pending:
            qtype, client, ts = self.pending.pop(domain_lower)
            return (domain_lower, qtype, client, 'blocked', ts)
        return None
    
    def mark_allowed(self, domain):
        domain_lower = domain.lower()
        if domain_lower in self.pending:
            qtype, client, ts = self.pending.pop(domain_lower)
            return (domain_lower, qtype, client, 'allowed', ts)
        return None
    
    def flush_old(self, max_age=30):
        """Mark queries older than max_age seconds as allowed (no response seen)"""
        now = datetime.now()
        results = []
        to_remove = []
        for domain, (qtype, client, ts) in self.pending.items():
            age = (now - ts).total_seconds()
            if age > max_age:
                results.append((domain, qtype, client, 'allowed', ts))
                to_remove.append(domain)
        for d in to_remove:
            self.pending.pop(d, None)
        return results


def db_connect():
    """Create database connection with retry"""
    for attempt in range(5):
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            return conn
        except mysql.connector.Error as e:
            print(f"DB connect attempt {attempt+1} failed: {e}")
            time.sleep(2)
    raise Exception("Failed to connect to database after 5 attempts")


def flush_batch(cursor, db, batch):
    """Insert batch of queries into database"""
    if not batch:
        return
    cursor.executemany(
        "INSERT INTO query_log (domain, query_type, client_ip, action, logged_at) VALUES (%s, %s, %s, %s, %s)",
        batch
    )
    db.commit()
    print(f"  Flushed {len(batch)} queries to DB")


def tail_log(filepath):
    """Tail the dnsmasq log and insert queries into DB using actual dnsmasq responses"""
    db = db_connect()
    cursor = db.cursor()
    tracker = QueryTracker()
    
    try:
        with open(filepath, 'r') as f:
            # Seek to end of file
            f.seek(0, 2)
            
            batch = []
            last_flush = time.time()
            last_reconnect = time.time()
            
            while True:
                line = f.readline()
                if not line:
                    # Flush pending queries that are old (no response came)
                    old = tracker.flush_old(max_age=10)
                    for entry in old:
                        batch.append(entry)
                    
                    # Flush batch periodically
                    if batch and time.time() - last_flush > 3:
                        try:
                            flush_batch(cursor, db, batch)
                        except mysql.connector.Error:
                            db = db_connect()
                            cursor = db.cursor()
                            flush_batch(cursor, db, batch)
                        batch = []
                        last_flush = time.time()
                    
                    # Reconnect periodically to keep connection alive
                    if time.time() - last_reconnect > 300:
                        try:
                            db.ping(reconnect=True)
                        except:
                            db = db_connect()
                            cursor = db.cursor()
                        last_reconnect = time.time()
                    
                    time.sleep(0.05)
                    continue
                
                line = line.strip()
                
                # 1. New DNS query
                match = QUERY_RE.search(line)
                if match:
                    qtype = match.group(1)
                    domain = match.group(2)
                    client = match.group(3)
                    tracker.add_query(domain, qtype, client)
                    continue
                
                # 2. Config response = BLOCKED by dnsmasq
                match = CONFIG_RE.search(line)
                if match:
                    domain = match.group(1)
                    result = tracker.mark_blocked(domain)
                    if result:
                        batch.append(result)
                    continue
                
                # 3. Forwarded = ALLOWED (sent to upstream)
                match = FORWARDED_RE.search(line)
                if match:
                    domain = match.group(1)
                    result = tracker.mark_allowed(domain)
                    if result:
                        batch.append(result)
                    continue
                
                # 4. Cached = ALLOWED (from cache)
                match = CACHED_RE.search(line)
                if match:
                    domain = match.group(1)
                    result = tracker.mark_allowed(domain)
                    if result:
                        batch.append(result)
                    continue
                
                # Flush if batch is large
                if len(batch) >= 200:
                    try:
                        flush_batch(cursor, db, batch)
                    except mysql.connector.Error:
                        db = db_connect()
                        cursor = db.cursor()
                        flush_batch(cursor, db, batch)
                    batch = []
                    last_flush = time.time()
    
    except FileNotFoundError:
        print(f"Log file not found: {filepath}")
        print("Make sure dnsmasq is configured with log-facility")
    except KeyboardInterrupt:
        if batch:
            flush_batch(cursor, db, batch)
        print("\nStopped")
    finally:
        try:
            db.close()
        except:
            pass


def process_existing_log(filepath):
    """Process existing log file (one-time import)"""
    db = db_connect()
    cursor = db.cursor()
    
    batch = []
    count = 0
    pending = {}  # domain -> (qtype, client)
    
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                
                match = QUERY_RE.search(line)
                if match:
                    qtype = match.group(1)
                    domain = match.group(2).lower()
                    client = match.group(3)
                    pending[domain] = (qtype, client)
                    continue
                
                match = CONFIG_RE.search(line)
                if match:
                    domain = match.group(1).lower()
                    if domain in pending:
                        qtype, client = pending.pop(domain)
                        batch.append((domain, qtype, client, 'blocked', datetime.now()))
                    continue
                
                match = FORWARDED_RE.search(line)
                if match:
                    domain = match.group(1).lower()
                    if domain in pending:
                        qtype, client = pending.pop(domain)
                        batch.append((domain, qtype, client, 'allowed', datetime.now()))
                    continue
                
                match = CACHED_RE.search(line)
                if match:
                    domain = match.group(1).lower()
                    if domain in pending:
                        qtype, client = pending.pop(domain)
                        batch.append((domain, qtype, client, 'allowed', datetime.now()))
                    continue
                
                if len(batch) >= 5000:
                    flush_batch(cursor, db, batch)
                    count += len(batch)
                    batch = []
                    print(f"  Processed {count} queries...")
        
        # Remaining pending queries are allowed
        for domain, (qtype, client) in pending.items():
            batch.append((domain, qtype, client, 'allowed', datetime.now()))
        
        if batch:
            flush_batch(cursor, db, batch)
            count += len(batch)
        
        print(f"Total: {count} queries imported")
    
    except FileNotFoundError:
        print(f"Log file not found: {filepath}")
    finally:
        db.close()


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--import':
        print("Importing existing log...")
        process_existing_log(DNSMASQ_LOG)
    else:
        print("IonMan DNS Query Logger starting...")
        print(f"Tailing: {DNSMASQ_LOG}")
        tail_log(DNSMASQ_LOG)
