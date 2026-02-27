#!/usr/bin/env python3
"""
IonMan DNS - Blocklist Updater
Downloads and parses blocklists from Pi-hole, AdGuard, and hosts format sources.
"""

import sys
import re
import argparse
import requests
import mysql.connector
from datetime import datetime

import os

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

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

def parse_hosts_format(content):
    """Parse hosts file format (0.0.0.0 domain or 127.0.0.1 domain)"""
    domains = set()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # Remove inline comments
        line = line.split('#')[0].strip()
        parts = line.split()
        if len(parts) >= 2:
            ip = parts[0]
            if ip in ('0.0.0.0', '127.0.0.1'):
                domain = parts[1].lower().strip()
                if domain not in ('localhost', 'localhost.localdomain', 'local', 
                                 'broadcasthost', 'ip6-localhost', 'ip6-loopback',
                                 'ip6-localnet', 'ip6-mcastprefix', 'ip6-allnodes',
                                 'ip6-allrouters', 'ip6-allhosts'):
                    if is_valid_domain(domain):
                        domains.add(domain)
    return domains

def parse_domain_list(content):
    """Parse plain domain list (one per line)"""
    domains = set()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('!'):
            continue
        line = line.split('#')[0].strip()
        domain = line.lower().strip()
        if is_valid_domain(domain):
            domains.add(domain)
    return domains

def parse_adblock_format(content):
    """Parse AdGuard/AdBlock filter format (||domain^)"""
    domains = set()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('!') or line.startswith('['):
            continue
        # Match ||domain^ pattern
        match = re.match(r'^\|\|([a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,})\^', line, re.IGNORECASE)
        if match:
            domain = match.group(1).lower()
            if is_valid_domain(domain):
                domains.add(domain)
    return domains

def is_valid_domain(domain):
    """Basic domain validation"""
    if not domain or len(domain) > 253:
        return False
    return bool(re.match(r'^[a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,}$', domain))

def detect_and_parse(content):
    """Auto-detect format and parse"""
    lines = content.strip().splitlines()[:50]
    
    # Check for AdBlock format
    adblock_count = sum(1 for l in lines if l.startswith('||') or l.startswith('!'))
    hosts_count = sum(1 for l in lines if l.startswith(('0.0.0.0', '127.0.0.1')))
    
    if adblock_count > hosts_count:
        return parse_adblock_format(content)
    elif hosts_count > 0:
        return parse_hosts_format(content)
    else:
        return parse_domain_list(content)

def download_list(url, timeout=60):
    """Download a blocklist"""
    try:
        headers = {'User-Agent': 'IonMan DNS/1.0'}
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return None

def update_blocklist(db, list_id):
    """Update a single blocklist"""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM blocklists WHERE id = %s", (list_id,))
    bl = cursor.fetchone()
    
    if not bl:
        print(f"Blocklist ID {list_id} not found")
        return False
    
    print(f"Updating: {bl['name']} ({bl['url']})")
    
    content = download_list(bl['url'])
    if not content:
        return False
    
    domains = detect_and_parse(content)
    print(f"  Parsed {len(domains)} domains")
    
    if not domains:
        print("  No domains found, skipping")
        return False
    
    # Delete existing domains for this list
    cursor.execute("DELETE FROM blocked_domains WHERE source_list_id = %s", (list_id,))
    
    # Batch insert
    batch_size = 5000
    domain_list = list(domains)
    for i in range(0, len(domain_list), batch_size):
        batch = domain_list[i:i+batch_size]
        values = [(d, list_id) for d in batch]
        cursor.executemany(
            "INSERT INTO blocked_domains (domain, source_list_id) VALUES (%s, %s)",
            values
        )
        db.commit()
    
    # Update list stats
    cursor.execute(
        "UPDATE blocklists SET domain_count = %s, last_updated = %s WHERE id = %s",
        (len(domains), datetime.now(), list_id)
    )
    db.commit()
    
    print(f"  Done: {len(domains)} domains imported")
    return True

def update_all(db):
    """Update all enabled blocklists"""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM blocklists WHERE enabled = 1")
    lists = cursor.fetchall()
    
    total = 0
    for bl in lists:
        if update_blocklist(db, bl['id']):
            total += 1
    
    print(f"\nUpdated {total}/{len(lists)} blocklists")
    
    # Generate dnsmasq config after updating
    import subprocess
    subprocess.run([sys.executable, '/var/www/html/ionman-dns/engine/dnsmasq_config.py'], check=False)

def main():
    parser = argparse.ArgumentParser(description='IonMan DNS Blocklist Updater')
    parser.add_argument('--list-id', type=int, help='Update specific blocklist ID')
    parser.add_argument('--all', action='store_true', help='Update all enabled blocklists')
    args = parser.parse_args()
    
    db = get_db()
    
    if args.list_id:
        update_blocklist(db, args.list_id)
        # Regenerate dnsmasq config
        import subprocess
        subprocess.run([sys.executable, '/var/www/html/ionman-dns/engine/dnsmasq_config.py'], check=False)
    elif args.all:
        update_all(db)
    else:
        print("Usage: blocklist_updater.py --all | --list-id=N")
    
    db.close()

if __name__ == '__main__':
    main()
