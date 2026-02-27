<?php
/**
 * IonMan DNS - WireGuard Management API
 */

$conn = db();

switch ($method) {
    case 'GET':
        if ($id === 'status') {
            // WireGuard interface status
            $status = shell_exec('sudo wg show all 2>&1');
            $is_active = trim(shell_exec('systemctl is-active wg-quick@wg0 2>/dev/null')) === 'active';
            json_response([
                'active' => $is_active,
                'status' => $status,
                'interface' => get_setting('wg_interface') ?: 'wg0',
                'listen_port' => get_setting('wg_listen_port') ?: '51820',
                'server_ip' => get_setting('wg_server_ip') ?: '10.0.0.1/24',
            ]);
        }
        
        if ($id === 'config' && $action) {
            // Get peer config for QR code
            $peer_id = (int)$action;
            $stmt = $conn->prepare("SELECT * FROM wg_peers WHERE id = ?");
            $stmt->bind_param('i', $peer_id);
            $stmt->execute();
            $peer = $stmt->get_result()->fetch_assoc();
            if (!$peer) json_error('Peer not found', 404);
            
            $endpoint = get_setting('wg_endpoint') ?: '';
            $listen_port = get_setting('wg_listen_port') ?: '51820';
            $server_pubkey = trim(shell_exec('sudo cat /etc/wireguard/server_public.key 2>/dev/null'));
            
            $config = "[Interface]\n";
            $config .= "PrivateKey = {$peer['private_key']}\n";
            $config .= "Address = {$peer['allowed_ips']}\n";
            $config .= "DNS = {$peer['dns_server']}\n";
            $config .= "MTU = 1380\n\n";
            $config .= "[Peer]\n";
            $config .= "PublicKey = {$server_pubkey}\n";
            if ($peer['preshared_key']) {
                $config .= "PresharedKey = {$peer['preshared_key']}\n";
            }
            $config .= "AllowedIPs = 0.0.0.0/0\n";
            $config .= "Endpoint = {$endpoint}:{$listen_port}\n";
            $config .= "PersistentKeepalive = 25\n";
            
            // Generate QR code as base64
            $qr_png = shell_exec("echo " . escapeshellarg($config) . " | qrencode -t PNG -o - 2>/dev/null | base64 -w 0");
            
            json_response([
                'peer' => $peer,
                'config' => $config,
                'qr_code' => $qr_png ? "data:image/png;base64,{$qr_png}" : null,
            ]);
        }
        
        if ($id) {
            // Get single peer
            $stmt = $conn->prepare("SELECT id, name, public_key, allowed_ips, dns_server, enabled, last_handshake, transfer_rx, transfer_tx, created_at FROM wg_peers WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $peer = $stmt->get_result()->fetch_assoc();
            if (!$peer) json_error('Peer not found', 404);
            json_response($peer);
        }
        
        // List all peers
        $result = $conn->query("SELECT id, name, public_key, allowed_ips, dns_server, enabled, last_handshake, transfer_rx, transfer_tx, created_at FROM wg_peers ORDER BY name");
        $peers = [];
        while ($row = $result->fetch_assoc()) {
            $peers[] = $row;
        }
        
        // Update with live data
        $wg_dump = shell_exec('sudo wg show wg0 dump 2>/dev/null');
        if ($wg_dump) {
            $lines = explode("\n", trim($wg_dump));
            array_shift($lines); // skip interface line
            $live = [];
            foreach ($lines as $line) {
                $parts = explode("\t", $line);
                if (count($parts) >= 8) {
                    $live[$parts[0]] = [
                        'endpoint' => $parts[2] !== '(none)' ? $parts[2] : null,
                        'last_handshake' => $parts[4] != '0' ? date('Y-m-d H:i:s', $parts[4]) : null,
                        'last_handshake_ts' => (int)$parts[4],
                        'transfer_rx' => (int)$parts[5],
                        'transfer_tx' => (int)$parts[6],
                    ];
                }
            }
            foreach ($peers as &$peer) {
                if (isset($live[$peer['public_key']])) {
                    $peer = array_merge($peer, $live[$peer['public_key']]);
                }
            }
        }
        
        json_response($peers);
        break;

    case 'POST':
        if ($id === 'setup') {
            // Initial WireGuard setup
            $output = shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py setup 2>&1");
            json_response(['message' => 'WireGuard setup initiated', 'output' => $output]);
        }
        
        $data = get_json_body();
        if (empty($data['name'])) json_error('Peer name required');
        
        // Generate keys
        $private_key = trim(shell_exec('sudo wg genkey'));
        $public_key = trim(shell_exec("echo " . escapeshellarg($private_key) . " | sudo wg pubkey"));
        $preshared_key = trim(shell_exec('sudo wg genpsk'));
        
        // Find next available IP
        $last_ip = $conn->query("SELECT allowed_ips FROM wg_peers ORDER BY id DESC LIMIT 1")->fetch_assoc();
        if ($last_ip) {
            $last_num = (int)explode('.', explode('/', $last_ip['allowed_ips'])[0])[3];
            $next_num = $last_num + 1;
        } else {
            $next_num = 2; // .1 is server
        }
        $allowed_ips = "10.0.0.{$next_num}/32";
        $dns_server = get_setting('wg_dns') ?: '10.0.0.1';
        $endpoint = get_setting('wg_endpoint') ?: '';
        
        $stmt = $conn->prepare("INSERT INTO wg_peers (name, public_key, private_key, preshared_key, allowed_ips, dns_server, endpoint) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('sssssss', $data['name'], $public_key, $private_key, $preshared_key, $allowed_ips, $dns_server, $endpoint);
        $stmt->execute();
        $peer_id = $conn->insert_id;
        
        // Auto-create default blocking rules for new peer
        // Load categories from JSON to get all available category keys
        $cats_file = dirname(__DIR__) . '/config/categories.json';
        $cats_data = json_decode(file_get_contents($cats_file), true) ?: [];
        // Always-on categories (ads) are always enabled; social (TikTok) enabled by default
        $always_on = ['ads'];
        $default_enabled = ['social', 'ads'];
        $cat_stmt = $conn->prepare("INSERT INTO client_blocking_rules (target_type, target_id, rule_type, rule_key, enabled) VALUES ('peer', ?, 'category', ?, ?)");
        foreach (array_keys($cats_data) as $cat_key) {
            $en = in_array($cat_key, $default_enabled) ? 1 : 0;
            // Always-on categories are forced enabled
            if (in_array($cat_key, $always_on)) $en = 1;
            $cat_stmt->bind_param('isi', $peer_id, $cat_key, $en);
            $cat_stmt->execute();
        }
        
        // Auto-create default port blocking rules for new peer
        $peer_ip = explode('/', $allowed_ips)[0];
        $games_file = dirname(__DIR__) . '/config/game_ports.json';
        $games_data = json_decode(file_get_contents($games_file), true) ?: [];
        $port_stmt = $conn->prepare("INSERT INTO port_blocking_rules (client_ip, game_key, enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)");
        foreach ($games_data as $game_key => $game_info) {
            $en = ($game_info['default_blocked'] ?? false) ? 1 : 0;
            $port_stmt->bind_param('ssi', $peer_ip, $game_key, $en);
            $port_stmt->execute();
        }
        // Sync iptables
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/port_manager.py sync 2>&1 &");
        
        // Add peer to WireGuard - write preshared key to temp file (shell_exec uses /bin/sh which doesn't support <())
        $psk_file = tempnam('/tmp', 'wg_psk_');
        file_put_contents($psk_file, $preshared_key . "\n");
        chmod($psk_file, 0600);
        shell_exec("sudo wg set wg0 peer " . escapeshellarg($public_key) . " preshared-key " . escapeshellarg($psk_file) . " allowed-ips " . escapeshellarg($allowed_ips) . " 2>&1");
        unlink($psk_file);
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
        
        json_response(['message' => 'Peer created', 'id' => $peer_id], 201);
        break;

    case 'PUT':
        if (!$id) json_error('Peer ID required');
        $data = get_json_body();
        
        $stmt = $conn->prepare("SELECT * FROM wg_peers WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $peer = $stmt->get_result()->fetch_assoc();
        if (!$peer) json_error('Peer not found', 404);
        
        if (isset($data['name'])) {
            $stmt = $conn->prepare("UPDATE wg_peers SET name = ? WHERE id = ?");
            $stmt->bind_param('si', $data['name'], $id);
            $stmt->execute();
        }
        
        json_response(['message' => 'Peer updated']);
        break;

    case 'DELETE':
        if (!$id) json_error('Peer ID required');
        
        $stmt = $conn->prepare("SELECT public_key FROM wg_peers WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $peer = $stmt->get_result()->fetch_assoc();
        if (!$peer) json_error('Peer not found', 404);
        
        // Remove from WireGuard
        shell_exec("sudo wg set wg0 peer {$peer['public_key']} remove 2>&1");
        
        $stmt = $conn->prepare("DELETE FROM wg_peers WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
        
        json_response(['message' => 'Peer deleted']);
        break;

    default:
        json_error('Method not allowed', 405);
}
