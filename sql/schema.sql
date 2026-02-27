-- IonMan DNS Database Schema
USE ionman_dns;

-- Blocklist sources (Pi-hole, AdGuard compatible)
CREATE TABLE IF NOT EXISTS blocklists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    type ENUM('hosts','domains','adblock') NOT NULL DEFAULT 'hosts',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    domain_count INT NOT NULL DEFAULT 0,
    last_updated DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Blocked domains from lists
CREATE TABLE IF NOT EXISTS blocked_domains (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    blocklist_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_domain (domain),
    INDEX idx_blocklist (blocklist_id),
    FOREIGN KEY (blocklist_id) REFERENCES blocklists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Custom whitelist
CREATE TABLE IF NOT EXISTS whitelist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    comment VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Custom blacklist (user-added)
CREATE TABLE IF NOT EXISTS custom_blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    comment VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- DNS query log
CREATE TABLE IF NOT EXISTS query_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    query_type VARCHAR(10) NOT NULL DEFAULT 'A',
    client_ip VARCHAR(45) NOT NULL,
    action ENUM('allowed','blocked','cached') NOT NULL,
    upstream VARCHAR(100) NULL,
    response_time_ms INT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_domain (domain),
    INDEX idx_client (client_ip),
    INDEX idx_action (action)
) ENGINE=InnoDB;

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- WireGuard peers
CREATE TABLE IF NOT EXISTS wg_peers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    public_key VARCHAR(255) NOT NULL,
    private_key VARCHAR(255) NOT NULL,
    preshared_key VARCHAR(255) NULL,
    allowed_ips VARCHAR(100) NOT NULL,
    dns_server VARCHAR(45) NOT NULL DEFAULT '10.0.0.1',
    endpoint VARCHAR(255) NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    last_handshake DATETIME NULL,
    transfer_rx BIGINT NOT NULL DEFAULT 0,
    transfer_tx BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default settings
INSERT INTO settings (`key`, `value`) VALUES
('dns_upstream_1', '1.1.1.1'),
('dns_upstream_2', '8.8.8.8'),
('dns_port', '53'),
('blocking_enabled', '1'),
('log_queries', '1'),
('log_retention_days', '30'),
('wg_interface', 'wg0'),
('wg_listen_port', '51820'),
('wg_server_ip', '10.0.0.1/24'),
('wg_endpoint', ''),
('wg_dns', '10.0.0.1');

-- Default blocklists (Pi-hole + AdGuard compatible)
INSERT IGNORE INTO blocklists (name, url, type) VALUES
('Steven Black Hosts', 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', 'hosts'),
('AdGuard DNS Filter', 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt', 'adblock'),
('Pi-hole Exact Blocklist', 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts', 'hosts'),
('AdAway Default', 'https://adaway.org/hosts.txt', 'hosts'),
('Malware Domain List', 'https://raw.githubusercontent.com/RPiList/specials/master/Blocklisten/malware', 'domains'),
('Tracking & Telemetry', 'https://v.firebog.net/hosts/Easyprivacy.txt', 'domains'),
('OISD Basic', 'https://raw.githubusercontent.com/sjhgvr/oisd/main/domainswild_basic.txt', 'domains'),
('Phishing Army', 'https://phishing.army/download/phishing_army_blocklist.txt', 'domains');
