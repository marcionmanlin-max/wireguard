<?php
/**
 * IonMan DNS - API Configuration
 * Copy this to config.php and update values for your environment.
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'ionman');
define('DB_PASS', 'CHANGE_ME');
define('DB_NAME', 'ionman_dns');

define('DNSMASQ_CONFIG_DIR', '/etc/dnsmasq.d');
define('DNSMASQ_BLOCKLIST_FILE', '/etc/dnsmasq.d/ionman-blocklist.conf');
define('IONMAN_DATA_DIR', '/var/www/html/ionman-dns/data');
define('IONMAN_LOG_DIR', '/var/www/html/ionman-dns/logs');
define('IONMAN_ENGINE_DIR', '/var/www/html/ionman-dns/engine');

define('WG_CONFIG_DIR', '/etc/wireguard');
define('WG_INTERFACE', 'wg0');

// CORS headers for React frontend
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function db(): mysqli {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            http_response_code(500);
            die(json_encode(['error' => 'Database connection failed']));
        }
        $conn->set_charset('utf8mb4');
    }
    return $conn;
}

function json_response($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT);
    exit;
}

function json_error(string $message, int $code = 400): void {
    json_response(['error' => $message], $code);
}

function get_json_body(): array {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?: [];
}

function get_setting(string $key): ?string {
    $stmt = db()->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return $row ? $row['setting_value'] : null;
}

function set_setting(string $key, string $value): void {
    $stmt = db()->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param('sss', $key, $value, $value);
    $stmt->execute();
}
