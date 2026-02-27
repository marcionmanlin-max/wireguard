<?php
/**
 * IonMan DNS - Port Blocking API
 * Per-peer/client game port blocking via iptables
 *
 * GET    /port-blocking                     — List all clients with their port block rules
 * GET    /port-blocking/games               — List available games with port definitions
 * GET    /port-blocking/{client_ip}         — Get port blocks for a specific client
 * PUT    /port-blocking/{client_ip}         — Set port blocks for a specific client
 * POST   /port-blocking/bulk               — Set port blocks for multiple clients
 * POST   /port-blocking/sync               — Force iptables sync
 *
 * GET    /port-blocking/clients             — List all known clients (WG + LAN)
 * POST   /port-blocking/clients             — Add/update a LAN client
 * DELETE /port-blocking/clients/{id}        — Remove a LAN client
 */

$conn = db();

// Load game definitions
$game_ports_file = dirname(__DIR__) . '/config/game_ports.json';
$categories_file = dirname(__DIR__) . '/config/categories.json';
$game_ports = json_decode(file_get_contents($game_ports_file), true) ?: [];

// Helper: trigger port manager sync
function trigger_port_sync() {
    shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/port_manager.py sync 2>&1 &");
}

// Helper: trigger auto-detect
function trigger_detect() {
    $output = shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/port_manager.py detect 2>&1");
    return trim($output);
}

// Helper: get all clients (WG peers + LAN clients)
function get_all_clients($conn) {
    $clients = [];

    // WireGuard peers
    $res = $conn->query("SELECT id, name, allowed_ips FROM wg_peers ORDER BY id");
    while ($row = $res->fetch_assoc()) {
        $ip = explode('/', $row['allowed_ips'])[0];
        $clients[] = [
            'ip' => $ip,
            'name' => $row['name'],
            'type' => 'wireguard',
            'peer_id' => (int)$row['id'],
        ];
    }

    // LAN clients
    $res = $conn->query("SELECT id, ip_address, name, mac_address, device_type FROM lan_clients ORDER BY ip_address");
    while ($row = $res->fetch_assoc()) {
        $clients[] = [
            'ip' => $row['ip_address'],
            'name' => $row['name'] ?: $row['ip_address'],
            'type' => 'lan',
            'lan_id' => (int)$row['id'],
            'mac_address' => $row['mac_address'],
            'device_type' => $row['device_type'],
        ];
    }

    return $clients;
}

// Helper: get port blocking rules for a client IP
function get_client_port_rules($conn, $client_ip) {
    $stmt = $conn->prepare("SELECT game_key, enabled FROM port_blocking_rules WHERE client_ip = ?");
    $stmt->bind_param('s', $client_ip);
    $stmt->execute();
    $result = $stmt->get_result();
    $rules = [];
    while ($row = $result->fetch_assoc()) {
        $rules[$row['game_key']] = (bool)$row['enabled'];
    }
    return $rules;
}

// Helper: get global port block settings
function get_global_port_blocks($conn) {
    $result = $conn->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'port_block_%'");
    $globals = [];
    while ($row = $result->fetch_assoc()) {
        $key = str_replace('port_block_', '', $row['setting_key']);
        $globals[$key] = $row['setting_value'] === '1';
    }
    return $globals;
}

switch ($method) {
    case 'GET':
        // GET /port-blocking/games — list available games
        if ($id === 'games') {
            $games = [];
            foreach ($game_ports as $key => $info) {
                $games[] = [
                    'key' => $key,
                    'label' => $info['label'] ?? $key,
                    'icon' => $info['icon'] ?? 'Gamepad2',
                    'color' => $info['color'] ?? '#666',
                    'description' => $info['description'] ?? '',
                    'default_blocked' => $info['default_blocked'] ?? false,
                    'port_count' => count($info['ports'] ?? []),
                    'ports' => $info['ports'] ?? [],
                    'server_ips' => $info['server_ips'] ?? [],
                    'domains' => $info['domains'] ?? [],
                    'dns_only' => empty($info['ports']),
                    'auto_detected' => $info['auto_detected'] ?? false,
                ];
            }
            json_response(['games' => $games]);
        }

        // GET /port-blocking/detect — auto-detect new games from categories
        if ($id === 'detect') {
            $output = trigger_detect();
            // Reload game_ports after detection
            $game_ports = json_decode(file_get_contents($game_ports_file), true) ?: [];
            $games = [];
            foreach ($game_ports as $key => $info) {
                if (!empty($info['auto_detected'])) {
                    $games[] = [
                        'key' => $key,
                        'label' => $info['label'] ?? $key,
                        'domains' => $info['domains'] ?? [],
                    ];
                }
            }
            json_response(['message' => $output, 'auto_detected' => $games]);
        }

        // GET /port-blocking/clients — list all clients
        if ($id === 'clients') {
            $clients = get_all_clients($conn);
            json_response(['clients' => $clients]);
        }

        // GET /port-blocking/{client_ip} — get rules for specific client
        if ($id && preg_match('/^\d+\.\d+\.\d+\.\d+$/', $id)) {
            $rules = get_client_port_rules($conn, $id);
            $globals = get_global_port_blocks($conn);

            // Build effective state per game
            $games = [];
            foreach ($game_ports as $key => $info) {
                $has_rule = isset($rules[$key]);
                $enabled = $has_rule ? $rules[$key] : ($globals[$key] ?? ($info['default_blocked'] ?? false));
                $games[$key] = [
                    'key' => $key,
                    'label' => $info['label'],
                    'enabled' => $enabled,
                    'has_override' => $has_rule,
                    'global_default' => $globals[$key] ?? ($info['default_blocked'] ?? false),
                ];
            }
            json_response(['client_ip' => $id, 'games' => $games]);
        }

        // GET /port-blocking — list all clients with their rules
        if (!$id) {
            $clients = get_all_clients($conn);
            $globals = get_global_port_blocks($conn);

            foreach ($clients as &$client) {
                $rules = get_client_port_rules($conn, $client['ip']);
                $client['port_blocks'] = [];
                foreach ($game_ports as $key => $info) {
                    $has_rule = isset($rules[$key]);
                    $enabled = $has_rule ? $rules[$key] : ($globals[$key] ?? ($info['default_blocked'] ?? false));
                    $client['port_blocks'][$key] = $enabled;
                }
            }
            unset($client);

            // Game definitions with 24h hit counts
            $game_list = [];
            foreach ($game_ports as $key => $info) {
                $hits_24h = 0;
                if (!empty($info['domains'])) {
                    $escaped = array_map(fn($d) => "'" . $conn->real_escape_string($d) . "'", $info['domains']);
                    $in = implode(',', $escaped);
                    $hr = $conn->query("SELECT COUNT(*) as cnt FROM query_log WHERE logged_at >= NOW() - INTERVAL 24 HOUR AND domain IN ($in)");
                    $hits_24h = (int)($hr ? $hr->fetch_assoc()['cnt'] : 0);
                }
                $game_list[] = [
                    'key' => $key,
                    'label' => $info['label'],
                    'icon' => $info['icon'] ?? 'Gamepad2',
                    'color' => $info['color'] ?? '#666',
                    'description' => $info['description'] ?? '',
                    'default_blocked' => $info['default_blocked'] ?? false,
                    'port_count' => count($info['ports'] ?? []),
                    'dns_only' => empty($info['ports']),
                    'ports' => $info['ports'] ?? [],
                    'domains' => $info['domains'] ?? [],
                    'auto_detected' => $info['auto_detected'] ?? false,
                    'hits_24h' => $hits_24h,
                ];
            }

            json_response([
                'clients' => $clients,
                'games' => $game_list,
                'global_blocks' => $globals,
            ]);
        }
        break;

    case 'PUT':
        // PUT /port-blocking/global — update global game defaults
        if ($id === 'global') {
            $data = get_json_body();
            $games = $data['games'] ?? [];
            foreach ($games as $game_key => $enabled) {
                if (!isset($game_ports[$game_key])) continue;
                $setting_key = 'port_block_' . $game_key;
                $val = $enabled ? '1' : '0';
                set_setting($setting_key, $val);
            }
            trigger_port_sync();
            json_response(['message' => 'Global port block settings updated']);
        }

        // PUT /port-blocking/{client_ip} — set rules for specific client  
        if ($id && preg_match('/^\d+\.\d+\.\d+\.\d+$/', $id)) {
            $data = get_json_body();
            $games = $data['games'] ?? [];

            if (empty($games)) {
                json_error('games object required');
            }

            foreach ($games as $game_key => $enabled) {
                if (!isset($game_ports[$game_key])) continue;
                $en = $enabled ? 1 : 0;
                $stmt = $conn->prepare(
                    "INSERT INTO port_blocking_rules (client_ip, game_key, enabled) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)"
                );
                $stmt->bind_param('ssi', $id, $game_key, $en);
                $stmt->execute();
            }

            trigger_port_sync();
            json_response(['message' => "Port blocking updated for $id"]);
        }
        break;

    case 'POST':
        // POST /port-blocking/sync — force iptables sync
        if ($id === 'sync') {
            $output = shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/port_manager.py sync 2>&1");
            json_response(['message' => 'Port rules synced', 'output' => trim($output)]);
        }

        // POST /port-blocking/bulk — set for multiple clients
        if ($id === 'bulk') {
            $data = get_json_body();
            $client_ips = $data['client_ips'] ?? [];
            $games = $data['games'] ?? [];

            if (empty($client_ips) || empty($games)) {
                json_error('client_ips and games required');
            }

            foreach ($client_ips as $ip) {
                $ip = trim($ip);
                if (!preg_match('/^\d+\.\d+\.\d+\.\d+$/', $ip)) continue;
                foreach ($games as $game_key => $enabled) {
                    if (!isset($game_ports[$game_key])) continue;
                    $en = $enabled ? 1 : 0;
                    $stmt = $conn->prepare(
                        "INSERT INTO port_blocking_rules (client_ip, game_key, enabled) VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)"
                    );
                    $stmt->bind_param('ssi', $ip, $game_key, $en);
                    $stmt->execute();
                }
            }

            trigger_port_sync();
            json_response(['message' => 'Bulk port blocking updated for ' . count($client_ips) . ' clients']);
        }

        // POST /port-blocking/clients — add/update LAN client
        if ($id === 'clients') {
            $data = get_json_body();
            $ip = $data['ip_address'] ?? '';
            $name = $data['name'] ?? '';
            $mac = $data['mac_address'] ?? null;
            $device_type = $data['device_type'] ?? 'other';

            if (!$ip || !preg_match('/^\d+\.\d+\.\d+\.\d+$/', $ip)) {
                json_error('Valid IP address required');
            }
            if (!$name) {
                json_error('Name required');
            }

            // Don't allow adding WG peer IPs as LAN clients
            $stmt = $conn->prepare("SELECT id FROM wg_peers WHERE SUBSTRING_INDEX(allowed_ips, '/', 1) = ?");
            $stmt->bind_param('s', $ip);
            $stmt->execute();
            if ($stmt->get_result()->fetch_assoc()) {
                json_error('This IP belongs to a WireGuard peer');
            }

            $stmt = $conn->prepare(
                "INSERT INTO lan_clients (ip_address, name, mac_address, device_type) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), mac_address = VALUES(mac_address), device_type = VALUES(device_type)"
            );
            $stmt->bind_param('ssss', $ip, $name, $mac, $device_type);
            $stmt->execute();

            $client_id = $conn->insert_id ?: null;
            if (!$client_id) {
                $stmt2 = $conn->prepare("SELECT id FROM lan_clients WHERE ip_address = ?");
                $stmt2->bind_param('s', $ip);
                $stmt2->execute();
                $row = $stmt2->get_result()->fetch_assoc();
                $client_id = $row ? $row['id'] : null;
            }

            json_response(['message' => 'LAN client saved', 'id' => $client_id], 201);
        }
        break;

    case 'DELETE':
        // DELETE /port-blocking/clients/{id} — remove LAN client
        if ($id === 'clients' && $action && is_numeric($action)) {
            $lan_id = (int)$action;
            // Get IP first to clean up rules
            $stmt = $conn->prepare("SELECT ip_address FROM lan_clients WHERE id = ?");
            $stmt->bind_param('i', $lan_id);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            if (!$row) json_error('LAN client not found', 404);

            $ip = $row['ip_address'];

            // Delete port blocking rules for this IP
            $stmt = $conn->prepare("DELETE FROM port_blocking_rules WHERE client_ip = ?");
            $stmt->bind_param('s', $ip);
            $stmt->execute();

            // Delete the LAN client
            $stmt = $conn->prepare("DELETE FROM lan_clients WHERE id = ?");
            $stmt->bind_param('i', $lan_id);
            $stmt->execute();

            trigger_port_sync();
            json_response(['message' => 'LAN client removed']);
        }
        break;

    default:
        json_error('Method not allowed', 405);
}
