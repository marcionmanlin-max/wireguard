#!/usr/bin/env python3
"""
IonMan DNS - WireGuard Manager
Setup, sync, and manage WireGuard VPN configuration.
"""

import sys
import os
import subprocess
import mysql.connector

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

WG_DIR = '/etc/wireguard'
WG_CONF = f'{WG_DIR}/wg0.conf'
SERVER_PRIV_KEY = f'{WG_DIR}/server_private.key'
SERVER_PUB_KEY = f'{WG_DIR}/server_public.key'


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def get_setting(cursor, key, default=''):
    cursor.execute("SELECT setting_value FROM settings WHERE setting_key = %s", (key,))
    row = cursor.fetchone()
    if not row:
        return default
    return row['setting_value'] if isinstance(row, dict) else row[0]


def setup():
    """Initial WireGuard server setup"""
    print("Setting up WireGuard server...")
    
    os.makedirs(WG_DIR, exist_ok=True)
    
    # Generate server keys if they don't exist
    if not os.path.exists(SERVER_PRIV_KEY):
        priv = subprocess.check_output(['wg', 'genkey']).decode().strip()
        with open(SERVER_PRIV_KEY, 'w') as f:
            f.write(priv)
        os.chmod(SERVER_PRIV_KEY, 0o600)
        
        pub = subprocess.check_output(['wg', 'pubkey'], input=priv.encode()).decode().strip()
        with open(SERVER_PUB_KEY, 'w') as f:
            f.write(pub)
        print(f"Server keys generated")
    else:
        print(f"Server keys already exist")
    
    # Get settings from DB
    db = get_db()
    cursor = db.cursor()
    
    listen_port = get_setting(cursor, 'wg_listen_port', '51820')
    server_ip = get_setting(cursor, 'wg_server_ip', '10.0.0.1/24')
    
    db.close()
    
    # Read server private key
    with open(SERVER_PRIV_KEY, 'r') as f:
        server_priv = f.read().strip()
    
    # Generate wg0.conf
    config = f"""[Interface]
Address = {server_ip}
ListenPort = {listen_port}
PrivateKey = {server_priv}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eno1 -j MASQUERADE; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eno1 -j MASQUERADE; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
"""
    
    with open(WG_CONF, 'w') as f:
        f.write(config)
    os.chmod(WG_CONF, 0o600)
    
    print(f"WireGuard config written to {WG_CONF}")
    
    # Sync peers
    sync()
    
    # Enable and start
    subprocess.run(['systemctl', 'enable', 'wg-quick@wg0'], check=False)
    subprocess.run(['systemctl', 'restart', 'wg-quick@wg0'], check=False)
    
    # Enable IP forwarding
    subprocess.run(['sysctl', '-w', 'net.ipv4.ip_forward=1'], check=False)
    
    # Make persistent
    with open('/etc/sysctl.d/99-ionman-wg.conf', 'w') as f:
        f.write('net.ipv4.ip_forward=1\n')
    
    print("WireGuard server setup complete!")


def sync():
    """Sync WireGuard config with database peers"""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    listen_port = get_setting(cursor, 'wg_listen_port', '51820')
    server_ip = get_setting(cursor, 'wg_server_ip', '10.0.0.1/24')
    
    # Read server private key
    try:
        with open(SERVER_PRIV_KEY, 'r') as f:
            server_priv = f.read().strip()
    except FileNotFoundError:
        print("Server private key not found. Run 'setup' first.")
        db.close()
        return
    
    # Build config
    config = f"""[Interface]
Address = {server_ip}
ListenPort = {listen_port}
PrivateKey = {server_priv}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eno1 -j MASQUERADE; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eno1 -j MASQUERADE; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

"""
    
    # Add peers
    cursor.execute("SELECT * FROM wg_peers WHERE enabled = 1")
    peers = cursor.fetchall()
    
    for peer in peers:
        config += f"# {peer['name']}\n"
        config += f"[Peer]\n"
        config += f"PublicKey = {peer['public_key']}\n"
        if peer['preshared_key']:
            config += f"PresharedKey = {peer['preshared_key']}\n"
        config += f"AllowedIPs = {peer['allowed_ips']}\n\n"
    
    # Write config
    with open(WG_CONF, 'w') as f:
        f.write(config)
    os.chmod(WG_CONF, 0o600)
    
    print(f"WireGuard config synced with {len(peers)} peers")
    
    # Restart WireGuard
    subprocess.run(['systemctl', 'restart', 'wg-quick@wg0'], check=False, capture_output=True)
    
    db.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: wireguard_manager.py [setup|sync]")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == 'setup':
        setup()
    elif action == 'sync':
        sync()
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)


if __name__ == '__main__':
    main()
