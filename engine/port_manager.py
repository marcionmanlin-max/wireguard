#!/usr/bin/env python3
"""
IonMan DNS - Port Blocking Manager

Manages iptables rules for per-peer game port blocking.
Uses a dedicated chain IONMAN-PORTS in the FORWARD table.

Usage:
  python3 port_manager.py sync       # Sync all rules from DB
  python3 port_manager.py flush      # Remove all IONMAN rules
  python3 port_manager.py status     # Show current rules
  python3 port_manager.py daemon     # Run as daemon, sync every 30s
"""

import json
import os
import sys
import time
import subprocess
import mysql.connector

CONFIG_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_PORTS_FILE = os.path.join(CONFIG_DIR, 'config', 'game_ports.json')
CATEGORIES_FILE = os.path.join(CONFIG_DIR, 'config', 'categories.json')
CHAIN_NAME = 'IONMAN-PORTS'
SYNC_INTERVAL = 30

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


def run_ipt(args, check=True):
    """Run iptables command."""
    cmd = ['iptables'] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        # Ignore "already exists" or "doesn't exist" errors
        if 'already' not in result.stderr and 'No chain' not in result.stderr and 'does a matching rule exist' not in result.stderr:
            print(f"  [WARN] iptables {' '.join(args)}: {result.stderr.strip()}")
    return result


def load_game_ports():
    """Load game port definitions from JSON."""
    with open(GAME_PORTS_FILE) as f:
        return json.load(f)


def detect_new_games():
    """Scan categories.json gaming domains for games not yet in game_ports.json.
    Groups uncovered domains by their root (e.g., 'newgame.com' -> 'newgame'),
    and auto-adds them to game_ports.json as dns-only entries.
    Returns list of newly added game keys.
    """
    game_ports = load_game_ports()

    # Collect all domains already covered by game_ports.json
    covered_domains = set()
    for game_key, game_def in game_ports.items():
        for d in game_def.get('domains', []):
            covered_domains.add(d.lower())
            # Also add the root domain
            parts = d.lower().split('.')
            if len(parts) >= 2:
                covered_domains.add('.'.join(parts[-2:]))

    # Load gaming category from categories.json
    if not os.path.exists(CATEGORIES_FILE):
        return []
    with open(CATEGORIES_FILE) as f:
        cats = json.load(f)
    gaming = cats.get('gaming', {})
    gaming_domains = gaming.get('domains', [])

    # Find uncovered domains
    uncovered = []
    for domain in gaming_domains:
        d = domain.lower()
        parts = d.split('.')
        root = '.'.join(parts[-2:]) if len(parts) >= 2 else d
        # Check if any existing game covers this domain
        is_covered = False
        for gd in covered_domains:
            if d == gd or d.endswith('.' + gd) or root == gd:
                is_covered = True
                break
        if not is_covered:
            uncovered.append((d, root))

    if not uncovered:
        return []

    # Group by root domain to form game entries
    from collections import defaultdict
    groups = defaultdict(list)
    for domain, root in uncovered:
        # Use root as the key (sanitized)
        key = root.replace('.', '_').replace('-', '_')
        groups[key].append(domain)

    added = []
    for key, domains in groups.items():
        if key in game_ports:
            continue
        # Create a dns-only entry (blocked by default, no ports)
        label = key.replace('_', ' ').title()
        # Try to guess a better label
        for d in domains:
            name = d.split('.')[0] if not d.startswith('www.') else d.split('.')[1]
            if name not in ('www', 'store', 'accounts', 'api', 'web', 'm', 'cdn'):
                label = name.replace('-', ' ').title()
                break

        game_ports[key] = {
            'label': label,
            'icon': 'Gamepad2',
            'color': '#6B7280',
            'description': f'Auto-detected: {", ".join(domains[:3])}',
            'default_blocked': True,
            'domains': domains,
            'ports': [],
            'server_ips': [],
            'auto_detected': True
        }
        added.append(key)
        print(f"[PortManager] Auto-detected new game: {key} ({', '.join(domains)})")

    if added:
        with open(GAME_PORTS_FILE, 'w') as f:
            json.dump(game_ports, f, indent=2)
        print(f"[PortManager] Added {len(added)} new games to game_ports.json")

        # Insert rules for existing peers in DB
        try:
            db = mysql.connector.connect(**DB_CONFIG)
            cursor = db.cursor(dictionary=True)
            cursor.execute("SELECT DISTINCT client_ip FROM port_blocking_rules")
            existing_ips = [row['client_ip'] for row in cursor.fetchall()]
            for ip in existing_ips:
                for game_key in added:
                    cursor.execute(
                        "INSERT IGNORE INTO port_blocking_rules (client_ip, game_key, enabled) VALUES (%s, %s, 1)",
                        (ip, game_key)
                    )
            db.commit()
            db.close()
        except Exception as e:
            print(f"[PortManager] DB insert error for auto-detected games: {e}")

    return added


def load_rules_from_db():
    """Load enabled port blocking rules from database.
    Returns: dict of { client_ip: set(game_key) }
    """
    db = mysql.connector.connect(**DB_CONFIG)
    cursor = db.cursor(dictionary=True)

    # Get per-client rules
    cursor.execute("SELECT client_ip, game_key FROM port_blocking_rules WHERE enabled = 1")
    rules = {}
    for row in cursor.fetchall():
        ip = row['client_ip'].split('/')[0]  # strip CIDR
        if ip not in rules:
            rules[ip] = set()
        rules[ip].add(row['game_key'])

    # Get global defaults
    cursor.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'port_block_%'")
    global_blocks = {}
    for row in cursor.fetchall():
        game_key = row['setting_key'].replace('port_block_', '')
        global_blocks[game_key] = row['setting_value'] == '1'

    db.close()
    return rules, global_blocks


def ensure_chain():
    """Create IONMAN-PORTS chain if it doesn't exist."""
    result = run_ipt(['-L', CHAIN_NAME, '-n'], check=False)
    if result.returncode != 0:
        run_ipt(['-N', CHAIN_NAME])
        print(f"[PortManager] Created chain {CHAIN_NAME}")

    # Ensure chain is referenced from FORWARD (insert at position 1 for priority)
    result = run_ipt(['-C', 'FORWARD', '-j', CHAIN_NAME], check=False)
    if result.returncode != 0:
        run_ipt(['-I', 'FORWARD', '1', '-j', CHAIN_NAME])
        print(f"[PortManager] Inserted {CHAIN_NAME} into FORWARD chain")


def flush_chain():
    """Flush all rules from IONMAN-PORTS chain."""
    run_ipt(['-F', CHAIN_NAME], check=False)


def get_current_rules():
    """Get current iptables rules in IONMAN-PORTS as text."""
    result = run_ipt(['-L', CHAIN_NAME, '-n', '-v', '--line-numbers'], check=False)
    return result.stdout if result.returncode == 0 else ''


def build_rules(per_client_rules, global_blocks, game_ports):
    """Build list of iptables rule args from DB rules.
    Returns list of iptables arg lists.
    """
    rules = []

    # Collect all IPs that need blocking for each game
    game_clients = {}  # game_key -> set of IPs
    for client_ip, games in per_client_rules.items():
        for game in games:
            if game not in game_clients:
                game_clients[game] = set()
            game_clients[game].add(client_ip)

    for game_key, game_def in game_ports.items():
        blocked_ips = game_clients.get(game_key, set())
        if not blocked_ips:
            continue

        for client_ip in sorted(blocked_ips):
            # Port-based rules
            for port_def in game_def.get('ports', []):
                proto = port_def['proto']
                port_range = port_def['range'].replace('-', ':')  # iptables uses : for ranges
                comment = f"ionman:{game_key}:{client_ip}"

                rules.append([
                    '-A', CHAIN_NAME,
                    '-s', client_ip,
                    '-p', proto,
                    '--dport', port_range,
                    '-j', 'DROP',
                    '-m', 'comment', '--comment', comment
                ])

            # IP-based rules (server IPs)
            for ip_range in game_def.get('server_ips', []):
                comment = f"ionman:{game_key}:{client_ip}:ip"
                rules.append([
                    '-A', CHAIN_NAME,
                    '-s', client_ip,
                    '-d', ip_range,
                    '-j', 'DROP',
                    '-m', 'comment', '--comment', comment
                ])

    return rules


def sync_rules():
    """Full sync: flush and rebuild all iptables rules from DB."""
    game_ports = load_game_ports()
    per_client, global_blocks = load_rules_from_db()

    ensure_chain()
    flush_chain()

    rules = build_rules(per_client, global_blocks, game_ports)

    for rule_args in rules:
        run_ipt(rule_args)

    # Count unique clients and games
    clients = set()
    games = set()
    for client_ip, client_games in per_client.items():
        if client_games:
            clients.add(client_ip)
            games.update(client_games)

    print(f"[PortManager] Synced {len(rules)} iptables rules for "
          f"{len(clients)} clients, {len(games)} games")
    return len(rules)


def show_status():
    """Print current IONMAN-PORTS rules."""
    ensure_chain()
    print(f"=== {CHAIN_NAME} iptables rules ===")
    print(get_current_rules())


def flush_all():
    """Remove all IONMAN rules and chain."""
    flush_chain()
    # Remove from FORWARD
    run_ipt(['-D', 'FORWARD', '-j', CHAIN_NAME], check=False)
    run_ipt(['-X', CHAIN_NAME], check=False)
    print(f"[PortManager] Flushed and removed {CHAIN_NAME} chain")


def daemon():
    """Run as daemon, syncing rules periodically."""
    print(f"[PortManager] Starting daemon (sync every {SYNC_INTERVAL}s)")
    detect_cycle = 0
    while True:
        try:
            # Run auto-detect every 10 cycles (~5 min)
            detect_cycle += 1
            if detect_cycle >= 10:
                detect_cycle = 0
                detect_new_games()
            sync_rules()
        except Exception as e:
            print(f"[PortManager] Error syncing: {e}")
        time.sleep(SYNC_INTERVAL)


def main():
    if len(sys.argv) < 2:
        print("Usage: port_manager.py [sync|flush|status|daemon|detect]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == 'sync':
        sync_rules()
    elif cmd == 'flush':
        flush_all()
    elif cmd == 'status':
        show_status()
    elif cmd == 'daemon':
        daemon()
    elif cmd == 'detect':
        added = detect_new_games()
        if added:
            print(f"Detected {len(added)} new games: {', '.join(added)}")
        else:
            print("No new games detected.")
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == '__main__':
    main()
