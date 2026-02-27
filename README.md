# IonMan DNS+WireGuard

**A Pi-hole + AdGuard Home alternative with built-in WireGuard VPN.**

Block ads, trackers, malware, social media, streaming, gaming, gambling, adult content, and more across your entire network. Connect remotely via WireGuard VPN and get the same protection anywhere.

Everything Pi-hole and AdGuard Home can do — plus WireGuard VPN, category blocking, regex/wildcard rules, and a modern React dashboard — in one easy-to-deploy package.

---

## Features

- **DNS-level ad & tracker blocking** — blocks requests before they reach your devices
- **Category blocking** — one-click block/unblock for Social Media, Streaming, Gaming, Movies & TV, Gambling, Adult Content, Dating
- **Individual domain toggles** — expand any category and toggle specific brands (e.g. block TikTok but allow Facebook)
- **WireGuard VPN** — built-in VPN server, create peers from the dashboard, protect your DNS traffic from anywhere
- **Real-time dashboard** — live query stats, charts, top queried/blocked domains, top clients
- **Query log** — searchable, filterable, with client name resolution
- **Blocklists** — Pi-hole and AdGuard compatible, 19 presets included
- **Whitelist & Blacklist** — custom domain overrides
- **Regex blocking** — advanced pattern-based blocking
- **Mobile-friendly** — fully responsive dark-themed UI
- **Password-protected** — admin password auto-generated during install

### Why IonMan DNS over Pi-hole, AdGuard Home, NextDNS, etc.?

There are many DNS-level blockers out there. Here's why IonMan DNS+WireGuard is different:

#### 1. Built-in WireGuard VPN — not a separate install

Pi-hole and AdGuard Home block ads on your **local** network only. The moment you leave your house (mobile data, coffee shop WiFi, hotel, school), your protection disappears. You'd need to separately install WireGuard or Tailscale, configure it, and hope it works with your DNS blocker.

**IonMan DNS ships with WireGuard VPN built-in.** Create peers from the dashboard, scan a QR code, and your phone/laptop is protected from anywhere in the world — ads blocked, DNS encrypted, traffic routed through your server. One install, one dashboard, zero extra setup.

#### 2. Category blocking with per-brand toggles

Pi-hole and AdGuard Home give you blocklists — giant text files with thousands of domains. Want to block TikTok but keep Facebook? Good luck finding the right list, or manually adding 50 TikTok domains one by one.

**IonMan DNS has 7 built-in categories** (Social Media, Streaming, Gaming, Movies & TV, Gambling, Adult Content, Dating) with **100+ brand mappings**. Toggle an entire category with one click, or expand it and toggle individual brands. Want to block all social media except WhatsApp? Two clicks.

#### 3. Modern React dashboard

Pi-hole uses a legacy PHP 5 admin panel (AdminLTE). AdGuard Home's Go-based UI is functional but plain.

**IonMan DNS is built with React 18 + Tailwind CSS** with a fully responsive dark-themed UI, real-time charts (Recharts), live stats, and a mobile-first design that works beautifully on phones and tablets.

#### 4. Subscription system for clients

Neither Pi-hole nor AdGuard Home has any concept of paid subscriptions or multi-user access.

**IonMan DNS includes a full subscription system** — public signup page, 10-minute free trial, automatic WireGuard peer creation, GCash/card payment with instant activation, and auto-expiry. Perfect if you want to offer DNS+VPN as a service to clients.

#### 5. Compatible with existing blocklists

IonMan DNS supports **both Pi-hole and AdGuard format blocklists**. Your existing lists work out of the box — 19 preset blocklists included, plus you can add any custom URL.

#### 6. One server, everything included

| What you need | Pi-hole | AdGuard Home | IonMan DNS+WG |
|---------------|---------|-------------|:---:|
| DNS blocking | Pi-hole | AdGuard Home | ✅ Included |
| VPN | + WireGuard/Tailscale | + WireGuard/Tailscale | ✅ Included |
| Category blocking | + custom lists | + custom lists | ✅ Included |
| Subscription/payment | + Stripe/custom code | + Stripe/custom code | ✅ Included |
| Client management | + manual | + manual | ✅ Included |
| Mobile-ready UI | ❌ Desktop-first | ⚠️ Basic | ✅ Mobile-first |

### Feature Comparison

| Feature | IonMan DNS+WG | Pi-hole | AdGuard Home | NextDNS |
|---------|:---:|:---:|:---:|:---:|
| DNS ad blocking | ✅ | ✅ | ✅ | ✅ |
| Self-hosted (you own the data) | ✅ | ✅ | ✅ | ❌ Cloud |
| Category blocking (social, streaming, etc.) | ✅ | ❌ | ❌ | ⚠️ Limited |
| Per-brand toggles within categories | ✅ | ❌ | ❌ | ❌ |
| Built-in WireGuard VPN | ✅ | ❌ | ❌ | ❌ |
| Public subscription page | ✅ | ❌ | ❌ | ❌ |
| Auto-activate on payment | ✅ | ❌ | ❌ | ❌ |
| 10-min free trial | ✅ | ❌ | ❌ | ❌ |
| GCash / card payment | ✅ | ❌ | ❌ | ✅ Card only |
| Regex/wildcard blocking | ✅ | ✅ | ✅ | ⚠️ |
| Pi-hole blocklist compatible | ✅ | ✅ | ✅ | ❌ |
| AdGuard blocklist compatible | ✅ | ❌ | ✅ | ⚠️ |
| Modern React UI | ✅ | ❌ | ❌ | ✅ |
| One-command install | ✅ | ✅ | ✅ | N/A Cloud |
| Free & open source | ✅ | ✅ | ✅ | ❌ Freemium |

---

## Subscription System

IonMan DNS includes a **built-in subscription system** so you can offer DNS+VPN protection as a service.

### How It Works

1. **Visitor goes to your subscribe page** (`https://yourdomain.com/dns/subscribe`)
2. **Registers** with name, email, phone, address → gets a **10-minute free trial** with full access
3. **A WireGuard peer is auto-created** — they get a config file and QR code immediately
4. **Trial expires after 10 minutes** → VPN peer is automatically disabled
5. **They pay via GCash or card** → subscription is **instantly activated** (no admin approval needed)
6. **Monthly subscription** — auto-expires after 30 days, peer disabled until renewal

### Pricing

| Plan | Monthly | PHP Equiv. | Includes |
|------|---------|-----------|----------|
| Free Trial | $0 | ₱0 | 10 minutes, full access |
| Client | $25/mo | ~₱1,441 | DNS blocking, WireGuard VPN, all features, priority support |
| Self-Hosted | $50/mo | ~₱2,882 | Full server installation on your own machine, unlimited peers |

### Payment Methods

- **GCash** — Send to **09626616298** (IonMan), enter reference number → instant activation
- **Card** — Enter card details → instant activation
- No manual admin approval required — the system activates automatically

### Admin Panel

Admins can manage subscribers from the dashboard (`/dns/subscribers`):
- View all subscribers, their plans, and status
- See payment history for each subscriber
- Suspend or reactivate subscribers manually
- Monitor pending/expired accounts

---

## Prerequisites

A Linux server (Ubuntu 22.04+ recommended) with:
- Root/sudo access
- A static LAN IP or cloud VPS
- Port 53 (DNS), 80/443 (HTTP/HTTPS), 51820/udp (WireGuard) available
- Minimum 1 GB RAM, 10 GB disk

### Required software (installed automatically):

| Package | Purpose |
|---------|---------|
| nginx | Web server for dashboard & API |
| PHP 8.x + php-fpm | Backend API |
| MariaDB 10.x+ | Database |
| dnsmasq | DNS server & blocker |
| WireGuard | VPN server |
| Python 3.10+ | Engine scripts (logger, config generator, blocklist updater) |
| python3-mysql.connector | Python DB access |
| certbot | SSL certificates (optional) |
| qrencode | WireGuard QR codes |

---

## Quick Install

**One-liner (copy & paste):**

```bash
sudo apt update && sudo apt install -y git && git clone https://github.com/marcionmanlin-max/wireguard.git /var/www/html/ionman-dns && sudo bash /var/www/html/ionman-dns/install.sh
```

**Or step by step:**

```bash
# 1. Install git (if not installed)
sudo apt update && sudo apt install -y git

# 2. Clone the repository
git clone https://github.com/marcionmanlin-max/wireguard.git /var/www/html/ionman-dns

# 3. Run the installer
sudo bash /var/www/html/ionman-dns/install.sh
```

The installer will:
1. Install all system packages (nginx, PHP, MariaDB, dnsmasq, WireGuard, Python)
2. Create the database and import the schema
3. Generate the API config with your database password
4. **Auto-generate a secure admin password** (displayed at the end — save it!)
5. Configure dnsmasq as the DNS server
6. Set up WireGuard VPN with IP forwarding
7. Configure firewall rules (UFW)
8. Install the query logger as a systemd service
9. Set up nginx with optional SSL (if you provide a domain)
10. Download initial blocklists

After installation, open your browser to the URL shown and log in with the auto-generated admin password.

---

## Manual Installation

### 1. Install system packages

```bash
sudo apt update
sudo apt install -y \
  nginx php-fpm php-cli php-mysql php-json php-mbstring php-curl \
  mariadb-server mariadb-client \
  dnsmasq wireguard wireguard-tools \
  python3 python3-pip python3-mysql.connector \
  curl wget git certbot python3-certbot-nginx qrencode
```

### 2. Clone the repository

```bash
sudo git clone https://github.com/marcionmanlin-max/wireguard.git /var/www/html/ionman-dns
```

### 3. Create the database

```bash
sudo mysql -e "CREATE DATABASE ionman_dns CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'ionman'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON ionman_dns.* TO 'ionman'@'localhost';"
sudo mysql ionman_dns < /var/www/html/ionman-dns/sql/schema.sql
```

### 4. Configure the API

```bash
cp /var/www/html/ionman-dns/api/config.example.php /var/www/html/ionman-dns/api/config.php
```

Edit `config.php` and set your database credentials:
```php
define('DB_USER', 'ionman');
define('DB_PASS', 'YOUR_DB_PASSWORD');
define('DB_NAME', 'ionman_dns');
```

Set the admin password:
```bash
ADMIN_PASS=$(openssl rand -base64 16 | tr -d '/+=\n' | head -c 20)
echo "Your admin password: $ADMIN_PASS"
HASH=$(php -r "echo password_hash('$ADMIN_PASS', PASSWORD_BCRYPT);")
mysql ionman_dns -e "INSERT INTO settings (setting_key, setting_value) VALUES ('admin_password_hash', '$HASH') ON DUPLICATE KEY UPDATE setting_value = '$HASH';"
```

### 5. Configure engine credentials

Create `config/db.env` from the example and fill in your database details:
```bash
cp /var/www/html/ionman-dns/config/db.env.example /var/www/html/ionman-dns/config/db.env
nano /var/www/html/ionman-dns/config/db.env
```

`config/db.env` contents:
```ini
IONMAN_DB_HOST=localhost
IONMAN_DB_USER=your_db_user
IONMAN_DB_PASS=your_db_password
IONMAN_DB_NAME=ionman_dns
```

> **`config/db.env` is gitignored** — credentials stay on the server, never in version control.
> The Python engine scripts load this file automatically at startup via `engine/config_loader.py`.


### 6. Disable systemd-resolved (Ubuntu)

```bash
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved
sudo rm /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
```

### 7. Configure dnsmasq

```bash
sudo python3 /var/www/html/ionman-dns/engine/dnsmasq_config.py
sudo systemctl enable --now dnsmasq
```

### 8. Set up WireGuard

```bash
WG_PRIVKEY=$(wg genkey)
WG_PUBKEY=$(echo "$WG_PRIVKEY" | wg pubkey)
MAIN_IFACE=$(ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')

sudo tee /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = $WG_PRIVKEY
PostUp = iptables -t nat -A POSTROUTING -o $MAIN_IFACE -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o $MAIN_IFACE -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
EOF

sudo chmod 600 /etc/wireguard/wg0.conf
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/99-ionman-wg.conf
sudo sysctl --system
sudo systemctl enable --now wg-quick@wg0
```

### 9. Install the query logger

```bash
sudo tee /etc/systemd/system/ionman-logger.service << EOF
[Unit]
Description=IonMan DNS+WireGuard Query Logger
After=dnsmasq.service mysql.service
Wants=dnsmasq.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /var/www/html/ionman-dns/engine/query_logger.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ionman-logger.service
```

### 10. Set permissions and sudoers

```bash
sudo chown -R www-data:www-data /var/www/html/ionman-dns
sudo chmod -R 755 /var/www/html/ionman-dns

sudo tee /etc/sudoers.d/ionman << EOF
www-data ALL=(ALL) NOPASSWD: /usr/bin/python3 /var/www/html/ionman-dns/engine/dnsmasq_config.py
www-data ALL=(ALL) NOPASSWD: /usr/bin/python3 /var/www/html/ionman-dns/engine/blocklist_updater.py *
www-data ALL=(ALL) NOPASSWD: /usr/bin/python3 /var/www/html/ionman-dns/engine/wireguard_manager.py *
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart dnsmasq
www-data ALL=(ALL) NOPASSWD: /usr/sbin/wg show *
www-data ALL=(ALL) NOPASSWD: /usr/sbin/wg set *
www-data ALL=(ALL) NOPASSWD: /usr/bin/wg-quick *
EOF
sudo chmod 440 /etc/sudoers.d/ionman
```

### 11. Configure nginx

For HTTPS with a domain:

```bash
sudo certbot certonly --nginx -d dns.yourdomain.com
```

```nginx
server {
    listen 80;
    server_name dns.yourdomain.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name dns.yourdomain.com;
    root /var/www/html/ionman-dns/public;
    index index.html;
    ssl_certificate /etc/letsencrypt/live/dns.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dns.yourdomain.com/privkey.pem;

    location ^~ /dns/api/ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/html/ionman-dns/api/index.php;
        fastcgi_param REQUEST_URI $request_uri;
    }
    location ^~ /dns/ {
        alias /var/www/html/ionman-dns/public/;
        index index.html;
        try_files $uri $uri/ /dns/index.html;
    }
    location = /dns { return 301 /dns/; }
    location = / { return 301 /dns/; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ionman-dns /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 12. Download blocklists

```bash
sudo python3 /var/www/html/ionman-dns/engine/blocklist_updater.py --update-all
```

### 13. Configure your devices

Set your devices' DNS to your server's IP, or connect via WireGuard VPN for remote protection.

---

## Firewall Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 53 | TCP/UDP | DNS |
| 80 | TCP | HTTP (redirect to HTTPS) |
| 443 | TCP | HTTPS dashboard |
| 51820 | UDP | WireGuard VPN |

```bash
sudo ufw allow 53/tcp && sudo ufw allow 53/udp
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw allow 51820/udp
sudo ufw allow in on wg0 to any port 53
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              IonMan DNS+WireGuard                   │
├──────────┬──────────┬──────────┬────────────────────┤
│ Frontend │   API    │  Engine  │     Services       │
│ React 18 │ PHP 8.x  │ Python 3 │                    │
│ Vite 6   │ nginx    │          │                    │
│ Tailwind │ MariaDB  │          │                    │
├──────────┼──────────┼──────────┼────────────────────┤
│ Dashboard│ /stats   │ query_   │ dnsmasq (DNS)      │
│ QueryLog │ /query   │  logger  │ WireGuard (VPN)    │
│ Block-   │ /block   │ dnsmasq_ │ ionman-logger      │
│  lists   │ /domains │  config  │  (systemd)         │
│ Domains  │ /wire    │ blocklist│ MariaDB (DB)       │
│ WireGuard│ /categ   │  updater │ nginx (web)        │
│ Settings │ /control │ wireguard│ php-fpm (API)      │
│ About    │ /auth    │  manager │                    │
└──────────┴──────────┴──────────┴────────────────────┘
```

---

## Updating

```bash
cd /var/www/html/ionman-dns
git pull
cd frontend && npm install && npm run build
sudo systemctl restart ionman-logger dnsmasq
```

---

## Uninstall

```bash
sudo systemctl stop ionman-logger dnsmasq wg-quick@wg0
sudo systemctl disable ionman-logger wg-quick@wg0
sudo rm /etc/systemd/system/ionman-logger.service
sudo rm /etc/sudoers.d/ionman
sudo rm /etc/dnsmasq.d/ionman.conf /etc/dnsmasq.d/ionman-blocklist.conf
sudo rm -rf /var/www/html/ionman-dns
sudo mysql -e "DROP DATABASE ionman_dns; DROP USER 'ionman'@'localhost';"
sudo systemctl daemon-reload
```

---

## Troubleshooting

### DNS not working after install

```bash
# Check if dnsmasq is running
sudo systemctl status dnsmasq

# Check if port 53 is in use by another service
sudo lsof -i :53

# If systemd-resolved is blocking port 53
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved
sudo rm /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf

# Restart dnsmasq
sudo systemctl restart dnsmasq
```

### WireGuard peers can't connect

```bash
# Check if WireGuard is running
sudo wg show

# Check if port 51820 is open
sudo ufw status | grep 51820

# If not, open it
sudo ufw allow 51820/udp

# Check IP forwarding
sysctl net.ipv4.ip_forward
# Should return: net.ipv4.ip_forward = 1
```

### Dashboard not loading

```bash
# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check PHP-FPM
sudo systemctl status php*-fpm

# Check query logger
sudo systemctl status ionman-logger
sudo journalctl -u ionman-logger -f
```

### Can't log in (forgot password)

```bash
# Generate a new admin password
NEW_PASS=$(openssl rand -base64 16 | tr -d '/+=\n' | head -c 20)
echo "New password: $NEW_PASS"
HASH=$(php -r "echo password_hash('$NEW_PASS', PASSWORD_BCRYPT);")
mysql ionman_dns -e "UPDATE settings SET setting_value='$HASH' WHERE setting_key='admin_password_hash';"
```

### Check logs

```bash
# Query logger
sudo journalctl -u ionman-logger --no-pager -n 50

# nginx error log
sudo tail -50 /var/log/nginx/error.log

# dnsmasq log
sudo tail -50 /var/log/syslog | grep dnsmasq
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS 3, Recharts, Lucide Icons |
| Backend | PHP 8.x, nginx, MariaDB |
| Engine | Python 3, mysql-connector-python |
| DNS | dnsmasq |
| VPN | WireGuard |
| OS | Ubuntu 22.04+ (Debian-based) |

---

## Support This Project

If IonMan DNS+WireGuard is useful to you, consider supporting its development. Minimum donation: **$10 USD** (~PHP 576).

| Method | Details |
|--------|---------|
| GCash | **09626616298** (IonMan) |
| GitHub Sponsors | [Sponsor on GitHub](https://github.com/sponsors/marcionmanlin-max) |

Your support helps keep the project maintained and free for everyone. Even a star on the repo helps!

---

## License

MIT License. See [LICENSE](LICENSE) for details.
