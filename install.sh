#!/usr/bin/env bash
#
# IonMan DNS+WireGuard - Automated Installer
# A Pi-hole + AdGuard Home alternative with built-in WireGuard VPN
#
# Usage: sudo bash install.sh
#
# Tested on: Ubuntu 24.04 / 25.04 / 25.10
#

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[  OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ─── Pre-flight checks ──────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    fail "This script must be run as root (use sudo)"
fi

if ! grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
    warn "This installer is designed for Ubuntu/Debian. Proceed at your own risk."
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      IonMan DNS+WireGuard - Installer v1.0    ║${NC}"
echo -e "${CYAN}║   Pi-hole + AdGuard Home Alt with VPN        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── Configuration ─────────────────────────────────────────
INSTALL_DIR="/var/www/html/ionman-dns"
DOMAIN=""
DB_NAME="ionman_dns"
DB_USER="ionman"
DB_PASS=""
ADMIN_PASS=""
SERVER_IP=""
PUBLIC_IP=""
WG_PORT="51820"

# Detect server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s4 https://ifconfig.me 2>/dev/null || echo "")

echo -e "${CYAN}Server LAN IP:${NC}    $SERVER_IP"
echo -e "${CYAN}Server Public IP:${NC} ${PUBLIC_IP:-not detected}"
echo ""

# Interactive setup
read -rp "Domain name (e.g. dns.example.com, leave blank for IP-only): " DOMAIN
read -rsp "MariaDB password for '$DB_USER' user: " DB_PASS
echo ""
echo ""

# Auto-generate a secure admin password
ADMIN_PASS=$(openssl rand -base64 16 | tr -d '/+=\n' | head -c 20)

if [[ -z "$DB_PASS" ]]; then
    fail "Database password is required"
fi

# ─── Step 1: System packages ────────────────────────────────
info "Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    nginx \
    php-fpm php-cli php-mysql php-json php-mbstring php-curl \
    mariadb-server mariadb-client \
    dnsmasq \
    wireguard wireguard-tools \
    python3 python3-pip python3-mysql.connector \
    curl wget git certbot python3-certbot-nginx \
    qrencode \
    > /dev/null 2>&1
ok "System packages installed"

# Detect PHP version
PHP_VER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
PHP_FPM_SOCK="/run/php/php${PHP_VER}-fpm.sock"
info "Detected PHP $PHP_VER (FPM socket: $PHP_FPM_SOCK)"

# ─── Step 2: MariaDB setup ──────────────────────────────────
info "Setting up MariaDB..."
systemctl enable --now mariadb > /dev/null 2>&1

mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# Import schema
mysql "$DB_NAME" < "$INSTALL_DIR/sql/schema.sql"
ok "Database '$DB_NAME' created"

# ─── Step 3: API config ─────────────────────────────────────
info "Configuring API..."
cat > "$INSTALL_DIR/api/config.php" << PHPCONF
<?php
/**
 * IonMan DNS+WireGuard - API Configuration
 */

define('DB_HOST', 'localhost');
define('DB_USER', '$DB_USER');
define('DB_PASS', '$DB_PASS');
define('DB_NAME', '$DB_NAME');

define('DNSMASQ_CONFIG_DIR', '/etc/dnsmasq.d');
define('DNSMASQ_BLOCKLIST_FILE', '/etc/dnsmasq.d/ionman-blocklist.conf');
define('IONMAN_DATA_DIR', '$INSTALL_DIR/data');
define('IONMAN_LOG_DIR', '$INSTALL_DIR/logs');
define('IONMAN_ENGINE_DIR', '$INSTALL_DIR/engine');

define('WG_CONFIG_DIR', '/etc/wireguard');
define('WG_INTERFACE', 'wg0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (\$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function db(): mysqli {
    static \$conn = null;
    if (\$conn === null) {
        \$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if (\$conn->connect_error) {
            http_response_code(500);
            die(json_encode(['error' => 'Database connection failed']));
        }
        \$conn->set_charset('utf8mb4');
    }
    return \$conn;
}

function json_response(\$data, int \$code = 200): void {
    http_response_code(\$code);
    echo json_encode(\$data, JSON_PRETTY_PRINT);
    exit;
}

function json_error(string \$message, int \$code = 400): void {
    json_response(['error' => \$message], \$code);
}

function get_json_body(): array {
    \$body = file_get_contents('php://input');
    return json_decode(\$body, true) ?: [];
}

function get_setting(string \$key): ?string {
    \$stmt = db()->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
    \$stmt->bind_param('s', \$key);
    \$stmt->execute();
    \$result = \$stmt->get_result();
    \$row = \$result->fetch_assoc();
    return \$row ? \$row['setting_value'] : null;
}

function set_setting(string \$key, string \$value): void {
    \$stmt = db()->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    \$stmt->bind_param('sss', \$key, \$value, \$value);
    \$stmt->execute();
}
PHPCONF

# Set admin password
ADMIN_HASH=$(php -r "echo password_hash('$ADMIN_PASS', PASSWORD_BCRYPT);")
mysql "$DB_NAME" -e "INSERT INTO settings (setting_key, setting_value) VALUES ('admin_password_hash', '$ADMIN_HASH') ON DUPLICATE KEY UPDATE setting_value = '$ADMIN_HASH';"
ok "API configured with admin password"

# Configure Python engine DB credentials via config/db.env (gitignored)
info "Writing config/db.env..."
cat > "$INSTALL_DIR/config/db.env" <<DBENV
IONMAN_DB_HOST=localhost
IONMAN_DB_USER=$DB_USER
IONMAN_DB_PASS=$DB_PASS
IONMAN_DB_NAME=$DB_NAME
DBENV
chmod 600 "$INSTALL_DIR/config/db.env"
ok "Engine credentials written to config/db.env"

# ─── Step 4: Directory permissions ──────────────────────────
info "Setting permissions..."
WEB_USER=$(ps aux | grep -E 'php-fpm.*pool' | grep -v grep | head -1 | awk '{print $1}')
WEB_USER=${WEB_USER:-www-data}

chown -R "$WEB_USER":"$WEB_USER" "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/logs"
chmod 775 "$INSTALL_DIR/data" "$INSTALL_DIR/logs"
ok "Permissions set (web user: $WEB_USER)"

# ─── Step 5: dnsmasq configuration ──────────────────────────
info "Configuring dnsmasq..."

# Disable systemd-resolved if active (conflicts with port 53)
if systemctl is-active --quiet systemd-resolved; then
    systemctl stop systemd-resolved
    systemctl disable systemd-resolved
    rm -f /etc/resolv.conf
    echo "nameserver 127.0.0.1" > /etc/resolv.conf
    ok "Disabled systemd-resolved (was conflicting on port 53)"
fi

# Generate initial dnsmasq config
python3 "$INSTALL_DIR/engine/dnsmasq_config.py"

systemctl enable --now dnsmasq > /dev/null 2>&1
systemctl restart dnsmasq
ok "dnsmasq configured and running"

# ─── Step 6: WireGuard VPN ──────────────────────────────────
info "Setting up WireGuard VPN..."

# Generate server keys
umask 077
WG_PRIVKEY=$(wg genkey)
WG_PUBKEY=$(echo "$WG_PRIVKEY" | wg pubkey)

# Detect main network interface
MAIN_IFACE=$(ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -1)

cat > /etc/wireguard/wg0.conf << WGCONF
[Interface]
Address = 10.0.0.1/24
ListenPort = $WG_PORT
PrivateKey = $WG_PRIVKEY
PostUp = iptables -t nat -A POSTROUTING -o $MAIN_IFACE -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o $MAIN_IFACE -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
WGCONF

chmod 600 /etc/wireguard/wg0.conf

# Enable IP forwarding
cat > /etc/sysctl.d/99-ionman-wg.conf << SYSCTL
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
SYSCTL
sysctl --system > /dev/null 2>&1

# Store WG endpoint
WG_ENDPOINT="${PUBLIC_IP:-$SERVER_IP}:$WG_PORT"
mysql "$DB_NAME" -e "INSERT INTO settings (setting_key, setting_value) VALUES ('wg_endpoint', '$WG_ENDPOINT') ON DUPLICATE KEY UPDATE setting_value = '$WG_ENDPOINT';"

systemctl enable --now wg-quick@wg0 > /dev/null 2>&1
ok "WireGuard configured (10.0.0.1/24, port $WG_PORT)"

# ─── Step 7: Firewall ───────────────────────────────────────
info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw allow 53/tcp > /dev/null 2>&1
    ufw allow 53/udp > /dev/null 2>&1
    ufw allow "$WG_PORT"/udp > /dev/null 2>&1
    ufw allow in on wg0 to any port 53 > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1
    ok "UFW firewall configured"
else
    warn "UFW not found, configure your firewall manually (ports: 80, 443, 53, $WG_PORT)"
fi

# ─── Step 8: Query logger service ───────────────────────────
info "Installing query logger service..."
cat > /etc/systemd/system/ionman-logger.service << SVCFILE
[Unit]
Description=IonMan DNS+WireGuard Query Logger
After=dnsmasq.service mysql.service
Wants=dnsmasq.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 $INSTALL_DIR/engine/query_logger.py
EnvironmentFile=$INSTALL_DIR/config/db.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCFILE

systemctl daemon-reload
systemctl enable --now ionman-logger.service > /dev/null 2>&1
ok "Query logger service running"

# ─── Step 9: Sudoers for web user ───────────────────────────
info "Configuring sudoers for web user..."
cat > /etc/sudoers.d/ionman << SUDOFILE
# IonMan DNS+WireGuard - Allow web server to manage DNS services
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/python3 $INSTALL_DIR/engine/dnsmasq_config.py
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/python3 $INSTALL_DIR/engine/blocklist_updater.py *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/python3 $INSTALL_DIR/engine/wireguard_manager.py *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart dnsmasq
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl status dnsmasq
$WEB_USER ALL=(ALL) NOPASSWD: /usr/sbin/wg show *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/sbin/wg set *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/wg show *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/wg set *
$WEB_USER ALL=(ALL) NOPASSWD: /usr/bin/wg-quick *
SUDOFILE
chmod 440 /etc/sudoers.d/ionman
ok "Sudoers configured"

# ─── Step 10: Nginx configuration ───────────────────────────
info "Configuring nginx..."

if [[ -n "$DOMAIN" ]]; then
    # Domain-based setup with HTTPS
    cat > "/etc/nginx/sites-available/ionman-dns" << NGINXCONF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    server_name $DOMAIN;
    root $INSTALL_DIR/public;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location ^~ /dns/api/ {
        include fastcgi_params;
        fastcgi_pass unix:$PHP_FPM_SOCK;
        fastcgi_param SCRIPT_FILENAME $INSTALL_DIR/api/index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }
    location ^~ /dns/ {
        alias $INSTALL_DIR/public/;
        index index.html;
        try_files \$uri \$uri/ /dns/index.html;
    }
    location = /dns { return 301 /dns/; }
    location = / { return 301 /dns/; }
    location ~ /\.ht { deny all; }
}
NGINXCONF
    ln -sf /etc/nginx/sites-available/ionman-dns /etc/nginx/sites-enabled/
    
    # Get SSL certificate
    info "Obtaining SSL certificate for $DOMAIN..."
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || \
        warn "SSL certificate failed. Run manually: sudo certbot --nginx -d $DOMAIN"
else
    # IP-only setup (HTTP)
    cat > "/etc/nginx/sites-available/ionman-dns" << NGINXCONF
server {
    listen 80;
    server_name _;
    root $INSTALL_DIR/public;
    index index.html;

    location ^~ /dns/api/ {
        include fastcgi_params;
        fastcgi_pass unix:$PHP_FPM_SOCK;
        fastcgi_param SCRIPT_FILENAME $INSTALL_DIR/api/index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }
    location ^~ /dns/ {
        alias $INSTALL_DIR/public/;
        index index.html;
        try_files \$uri \$uri/ /dns/index.html;
    }
    location = /dns { return 301 /dns/; }
    location = / { return 301 /dns/; }
    location ~ /\.ht { deny all; }
}
NGINXCONF
    ln -sf /etc/nginx/sites-available/ionman-dns /etc/nginx/sites-enabled/
fi

rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1 && systemctl reload nginx
ok "Nginx configured"

# ─── Step 11: Download initial blocklists ────────────────────
info "Downloading initial blocklists (this may take a minute)..."
python3 "$INSTALL_DIR/engine/blocklist_updater.py" --update-all 2>/dev/null || \
    warn "Blocklist download failed. Run manually: sudo python3 $INSTALL_DIR/engine/blocklist_updater.py --update-all"
ok "Blocklists downloaded"

# ─── Done ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   IonMan DNS+WireGuard installed successfully!║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
if [[ -n "$DOMAIN" ]]; then
    echo -e "  Dashboard:  ${CYAN}https://$DOMAIN/dns/${NC}"
else
    echo -e "  Dashboard:  ${CYAN}http://$SERVER_IP/dns/${NC}"
fi
echo -e "  Password:   ${CYAN}${ADMIN_PASS}${NC}"
echo -e "  ${YELLOW}(Save this password! It won't be shown again)${NC}"
echo ""
echo -e "  DNS Server: ${CYAN}$SERVER_IP${NC} (set this as your DNS)"
echo -e "  WireGuard:  ${CYAN}$WG_ENDPOINT${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. Point your devices' DNS to ${CYAN}$SERVER_IP${NC}"
echo -e "  2. Or connect via WireGuard VPN (add peers in the dashboard)"
if [[ -z "$DOMAIN" ]]; then
    echo -e "  3. For HTTPS, get a domain and run: ${CYAN}sudo certbot --nginx -d yourdomain.com${NC}"
fi
echo ""
