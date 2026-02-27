<?php
/**
 * IonMan DNS+WireGuard - Subscription API
 * Public endpoints (no admin auth required)
 * 
 * POST /subscribe/register    - Register new subscriber (10-min trial)
 * POST /subscribe/login       - Subscriber login
 * GET  /subscribe/status      - Check subscription status (subscriber token)
 * POST /subscribe/payment     - Submit GCash payment proof
 * GET  /subscribe/plans       - Get available plans & pricing
 * GET  /subscribe/config      - Get WireGuard config (active subscribers only)
 */

$conn = db();

// Pricing
$plans = [
    'trial' => [
        'name'         => 'Free Trial',
        'price_usd'    => 0,
        'price_php'    => 0,
        'duration'     => '10 minutes',
        'duration_sec' => 600,
        'features'     => ['DNS ad blocking', 'WireGuard VPN', 'Category blocking', '10-minute trial']
    ],
    'client' => [
        'name'         => 'Client (Use Our Server)',
        'price_usd'    => 25,
        'price_php'    => 1441,
        'duration'     => '1 month',
        'duration_sec' => 2592000,
        'features'     => ['DNS ad blocking', 'WireGuard VPN', 'Category blocking', 'All features', 'Priority support']
    ],
    'selfhost' => [
        'name'         => 'Self-Hosted Installation',
        'price_usd'    => 50,
        'price_php'    => 2882,
        'duration'     => '1 month',
        'duration_sec' => 2592000,
        'features'     => ['Full server installation', 'Your own domain', 'Unlimited peers', 'All features', 'Installation support']
    ],
];

// Helper: authenticate subscriber by token
function auth_subscriber($conn) {
    $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!$token) return null;
    $stmt = $conn->prepare("SELECT s.* FROM subscribers s JOIN subscriber_tokens st ON s.id = st.subscriber_id WHERE st.token = ? AND st.expires_at > NOW()");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

// Helper: create a WireGuard peer for subscriber
function create_subscriber_peer($conn, $subscriber) {
    // Generate keys
    $private_key = trim(shell_exec('sudo wg genkey'));
    $public_key = trim(shell_exec("echo " . escapeshellarg($private_key) . " | sudo wg pubkey"));
    $preshared_key = trim(shell_exec('sudo wg genpsk'));
    
    // Find next available IP
    $last_ip = $conn->query("SELECT allowed_ips FROM wg_peers ORDER BY id DESC LIMIT 1")->fetch_assoc();
    $next_num = $last_ip ? (int)explode('.', explode('/', $last_ip['allowed_ips'])[0])[3] + 1 : 2;
    $allowed_ips = "10.0.0.{$next_num}/32";
    $dns_server = get_setting('wg_dns') ?: '10.0.0.1';
    $endpoint = get_setting('wg_endpoint') ?: '';
    
    $name = 'sub-' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $subscriber['full_name'])) . '-' . $subscriber['id'];
    
    $stmt = $conn->prepare("INSERT INTO wg_peers (name, public_key, private_key, preshared_key, allowed_ips, dns_server, endpoint) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssssss', $name, $public_key, $private_key, $preshared_key, $allowed_ips, $dns_server, $endpoint);
    $stmt->execute();
    $peer_id = $conn->insert_id;
    
    // Add peer to WireGuard
    $psk_file = tempnam('/tmp', 'wg_psk_');
    file_put_contents($psk_file, $preshared_key . "\n");
    chmod($psk_file, 0600);
    shell_exec("sudo wg set wg0 peer " . escapeshellarg($public_key) . " preshared-key " . escapeshellarg($psk_file) . " allowed-ips " . escapeshellarg($allowed_ips) . " 2>&1");
    unlink($psk_file);
    shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
    
    // Link peer to subscriber
    $stmt = $conn->prepare("UPDATE subscribers SET wg_peer_id = ? WHERE id = ?");
    $stmt->bind_param('ii', $peer_id, $subscriber['id']);
    $stmt->execute();
    
    return $peer_id;
}

// Helper: get WireGuard config for a peer
function get_peer_config($conn, $peer_id) {
    $stmt = $conn->prepare("SELECT * FROM wg_peers WHERE id = ?");
    $stmt->bind_param('i', $peer_id);
    $stmt->execute();
    $peer = $stmt->get_result()->fetch_assoc();
    if (!$peer) return null;
    
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
    
    return $config;
}

// Helper: disable a subscriber's WireGuard peer
function disable_subscriber_peer($conn, $subscriber_id) {
    $stmt = $conn->prepare("SELECT wg_peer_id FROM subscribers WHERE id = ?");
    $stmt->bind_param('i', $subscriber_id);
    $stmt->execute();
    $sub = $stmt->get_result()->fetch_assoc();
    if ($sub && $sub['wg_peer_id']) {
        $stmt2 = $conn->prepare("SELECT public_key FROM wg_peers WHERE id = ?");
        $stmt2->bind_param('i', $sub['wg_peer_id']);
        $stmt2->execute();
        $peer = $stmt2->get_result()->fetch_assoc();
        if ($peer) {
            shell_exec("sudo wg set wg0 peer " . escapeshellarg($peer['public_key']) . " remove 2>&1");
            shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
        }
    }
}

// Guard: when included from subscribers.php, only expose functions — skip routing
if (defined('SUBSCRIBE_FUNCTIONS_ONLY')) return;

switch ($id) {
    // ─── GET PLANS ─────────────────────────────────
    case 'plans':
        if ($method !== 'GET') json_error('Method not allowed', 405);
        json_response([
            'plans'   => $plans,
            'gcash'   => [
                'number' => get_setting('gcash_number') ?: '09626616298',
                'name'   => get_setting('gcash_name') ?: 'IonMan',
            ],
            'minimum_usd' => 10,
            'currency_rate' => 57.646,
            'note' => 'All prices are monthly. Trial is 10 minutes free.'
        ]);
        break;

    // ─── REGISTER ──────────────────────────────────
    case 'register':
        if ($method !== 'POST') json_error('Method not allowed', 405);
        $data = get_json_body();
        
        $required = ['email', 'password', 'full_name', 'phone'];
        foreach ($required as $field) {
            if (empty($data[$field])) json_error("$field is required");
        }
        
        // Validate email
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            json_error('Invalid email address');
        }
        
        // Check if email already exists
        $stmt = $conn->prepare("SELECT id FROM subscribers WHERE email = ?");
        $stmt->bind_param('s', $data['email']);
        $stmt->execute();
        if ($stmt->get_result()->fetch_assoc()) {
            json_error('Email already registered. Please login instead.');
        }
        
        // Create subscriber with 10-min trial
        $password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $trial_expires = date('Y-m-d H:i:s', time() + 600); // 10 minutes
        $now = date('Y-m-d H:i:s');
        
        $stmt = $conn->prepare("INSERT INTO subscribers (email, full_name, phone, address, city, barangay, province, region, plan, status, trial_started_at, trial_expires_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trial', 'trial', ?, ?, ?)");
        $address = $data['address'] ?? '';
        $city = $data['city'] ?? '';
        $barangay = $data['barangay'] ?? '';
        $province = $data['province'] ?? '';
        $region = $data['region'] ?? '';
        $stmt->bind_param('sssssssssss', $data['email'], $data['full_name'], $data['phone'], $address, $city, $barangay, $province, $region, $now, $trial_expires, $password_hash);
        $stmt->execute();
        $subscriber_id = $conn->insert_id;
        
        // Create auth token (10 min for trial)
        $token = bin2hex(random_bytes(32));
        $stmt = $conn->prepare("INSERT INTO subscriber_tokens (subscriber_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->bind_param('iss', $subscriber_id, $token, $trial_expires);
        $stmt->execute();
        
        // Create WireGuard peer
        $sub = ['id' => $subscriber_id, 'full_name' => $data['full_name']];
        $peer_id = create_subscriber_peer($conn, $sub);
        
        // Get WG config
        $config = get_peer_config($conn, $peer_id);
        
        json_response([
            'message'        => 'Registration successful! Your 10-minute free trial has started.',
            'token'          => $token,
            'plan'           => 'trial',
            'status'         => 'trial',
            'trial_expires'  => $trial_expires,
            'wg_config'      => $config,
            'subscriber_id'  => $subscriber_id,
        ], 201);
        break;

    // ─── LOGIN ─────────────────────────────────────
    case 'login':
        if ($method !== 'POST') json_error('Method not allowed', 405);
        $data = get_json_body();
        
        if (empty($data['email']) || empty($data['password'])) {
            json_error('Email and password required');
        }
        
        $stmt = $conn->prepare("SELECT * FROM subscribers WHERE email = ?");
        $stmt->bind_param('s', $data['email']);
        $stmt->execute();
        $subscriber = $stmt->get_result()->fetch_assoc();
        
        if (!$subscriber || !password_verify($data['password'], $subscriber['password_hash'])) {
            json_error('Invalid email or password', 401);
        }
        
        // Check status
        $active = false;
        $expires = null;
        if ($subscriber['status'] === 'trial') {
            if (strtotime($subscriber['trial_expires_at']) > time()) {
                $active = true;
                $expires = $subscriber['trial_expires_at'];
            } else {
                // Trial expired → update status
                $conn->query("UPDATE subscribers SET status='expired' WHERE id={$subscriber['id']}");
                $subscriber['status'] = 'expired';
            }
        } elseif ($subscriber['status'] === 'active') {
            if (strtotime($subscriber['subscription_expires_at']) > time()) {
                $active = true;
                $expires = $subscriber['subscription_expires_at'];
            } else {
                $conn->query("UPDATE subscribers SET status='expired' WHERE id={$subscriber['id']}");
                $subscriber['status'] = 'expired';
                disable_subscriber_peer($conn, $subscriber['id']);
            }
        }
        
        // Create token
        $token_exp = $active ? $expires : date('Y-m-d H:i:s', time() + 3600); // 1hr for expired (to see status page)
        $token = bin2hex(random_bytes(32));
        $stmt = $conn->prepare("INSERT INTO subscriber_tokens (subscriber_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->bind_param('iss', $subscriber['id'], $token, $token_exp);
        $stmt->execute();
        
        $response = [
            'token'    => $token,
            'plan'     => $subscriber['plan'],
            'status'   => $subscriber['status'],
            'active'   => $active,
            'name'     => $subscriber['full_name'],
        ];
        
        if ($active && $subscriber['wg_peer_id']) {
            $response['wg_config'] = get_peer_config($conn, $subscriber['wg_peer_id']);
            $response['expires'] = $expires;
        }
        
        if (!$active) {
            $response['message'] = 'Your subscription has expired. Please renew via GCash to continue.';
            $response['gcash'] = [
                'number' => get_setting('gcash_number') ?: '09626616298',
                'name'   => get_setting('gcash_name') ?: 'IonMan',
            ];
            $response['plans'] = $plans;
        }
        
        json_response($response);
        break;

    // ─── STATUS ────────────────────────────────────
    case 'status':
        if ($method !== 'GET') json_error('Method not allowed', 405);
        $subscriber = auth_subscriber($conn);
        if (!$subscriber) json_error('Not authenticated', 401);
        
        // Check if still active
        $active = false;
        $expires = null;
        if ($subscriber['status'] === 'trial') {
            $active = strtotime($subscriber['trial_expires_at']) > time();
            $expires = $subscriber['trial_expires_at'];
            if (!$active) {
                $conn->query("UPDATE subscribers SET status='expired' WHERE id={$subscriber['id']}");
                disable_subscriber_peer($conn, $subscriber['id']);
            }
        } elseif ($subscriber['status'] === 'active') {
            $active = strtotime($subscriber['subscription_expires_at']) > time();
            $expires = $subscriber['subscription_expires_at'];
            if (!$active) {
                $conn->query("UPDATE subscribers SET status='expired' WHERE id={$subscriber['id']}");
                disable_subscriber_peer($conn, $subscriber['id']);
            }
        }
        
        // Get payment history
        $stmt = $conn->prepare("SELECT id, amount_usd, amount_php, status, period_start, period_end, created_at FROM payments WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 10");
        $stmt->bind_param('i', $subscriber['id']);
        $stmt->execute();
        $payments = [];
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) $payments[] = $row;
        
        $remaining = $active ? max(0, strtotime($expires) - time()) : 0;
        
        json_response([
            'subscriber' => [
                'name'   => $subscriber['full_name'],
                'email'  => $subscriber['email'],
                'phone'  => $subscriber['phone'],
                'plan'   => $subscriber['plan'],
            ],
            'status'         => $active ? ($subscriber['status'] === 'trial' ? 'trial' : 'active') : 'expired',
            'active'         => $active,
            'expires'        => $expires,
            'remaining_sec'  => $remaining,
            'remaining_text' => $remaining > 86400 ? floor($remaining/86400) . ' days' : ($remaining > 3600 ? floor($remaining/3600) . ' hours' : floor($remaining/60) . ' minutes'),
            'payments'       => $payments,
            'wg_peer_id'     => $subscriber['wg_peer_id'],
        ]);
        break;

    // ─── SUBMIT PAYMENT ────────────────────────────
    case 'payment':
        if ($method !== 'POST') json_error('Method not allowed', 405);
        $subscriber = auth_subscriber($conn);
        if (!$subscriber) json_error('Not authenticated', 401);
        
        $data = get_json_body();
        if (empty($data['plan'])) json_error('Plan selection is required');
        if (!isset($plans[$data['plan']]) || $data['plan'] === 'trial') json_error('Invalid plan');
        
        // Detect payment method: gcash or card
        $payment_method = 'gcash';
        if (!empty($data['card_number'])) {
            $payment_method = 'card';
            // Validate card fields
            if (empty($data['card_number']) || empty($data['card_expiry']) || empty($data['card_cvv'])) {
                json_error('Card number, expiry, and CVV are required');
            }
        } else {
            if (empty($data['gcash_reference'])) json_error('GCash reference number is required');
        }
        
        $plan = $plans[$data['plan']];
        $period_start = date('Y-m-d');
        $period_end = date('Y-m-d', time() + $plan['duration_sec']);
        $now = date('Y-m-d H:i:s');
        
        // Record payment — auto-verified (instant activation)
        $gcash_ref = $data['gcash_reference'] ?? '';
        $sender_name = $data['gcash_sender_name'] ?? $subscriber['full_name'];
        $sender_number = $data['gcash_sender_number'] ?? $subscriber['phone'];
        
        // For card payments, store last 4 digits only as reference
        if ($payment_method === 'card') {
            $gcash_ref = 'CARD-****' . substr(preg_replace('/\D/', '', $data['card_number']), -4);
            $sender_name = $subscriber['full_name'];
            $sender_number = $subscriber['phone'];
        }
        
        $stmt = $conn->prepare("INSERT INTO payments (subscriber_id, amount_usd, amount_php, payment_method, gcash_reference, gcash_sender_name, gcash_sender_number, status, period_start, period_end, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?)");
        $stmt->bind_param('iddsssssss', $subscriber['id'], $plan['price_usd'], $plan['price_php'], $payment_method, $gcash_ref, $sender_name, $sender_number, $period_start, $period_end, $now);
        $stmt->execute();
        $payment_id = $conn->insert_id;
        
        // Auto-activate subscription immediately
        $sub_expires = date('Y-m-d H:i:s', time() + $plan['duration_sec']);
        $stmt = $conn->prepare("UPDATE subscribers SET plan = ?, status = 'active', subscription_started_at = ?, subscription_expires_at = ? WHERE id = ?");
        $stmt->bind_param('sssi', $data['plan'], $now, $sub_expires, $subscriber['id']);
        $stmt->execute();
        
        // Re-enable WireGuard peer if it was disabled
        if ($subscriber['wg_peer_id']) {
            $stmt = $conn->prepare("SELECT public_key, private_key, preshared_key, allowed_ips FROM wg_peers WHERE id = ?");
            $stmt->bind_param('i', $subscriber['wg_peer_id']);
            $stmt->execute();
            $peer = $stmt->get_result()->fetch_assoc();
            if ($peer) {
                // Re-add peer to WireGuard
                $psk_file = tempnam('/tmp', 'wg_psk_');
                file_put_contents($psk_file, $peer['preshared_key'] . "\n");
                chmod($psk_file, 0600);
                shell_exec("sudo wg set wg0 peer " . escapeshellarg($peer['public_key']) . " preshared-key " . escapeshellarg($psk_file) . " allowed-ips " . escapeshellarg($peer['allowed_ips']) . " 2>&1");
                unlink($psk_file);
                $conn->prepare("UPDATE wg_peers SET enabled = 1 WHERE id = ?")->execute([$subscriber['wg_peer_id']]);
            }
        } elseif (!$subscriber['wg_peer_id']) {
            // Create peer if they don't have one
            create_subscriber_peer($conn, $subscriber);
        }
        
        // Extend subscriber token expiry
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if ($token) {
            $conn->prepare("UPDATE subscriber_tokens SET expires_at = ? WHERE token = ?")->execute([$sub_expires, $token]);
        }
        
        // Get WG config to return
        $sub_refresh = $conn->query("SELECT * FROM subscribers WHERE id = {$subscriber['id']}")->fetch_assoc();
        $wg_config = $sub_refresh['wg_peer_id'] ? get_peer_config($conn, $sub_refresh['wg_peer_id']) : null;
        
        json_response([
            'message'    => 'Payment confirmed! Your subscription is now active.',
            'payment_id' => $payment_id,
            'status'     => 'active',
            'plan'       => $data['plan'],
            'expires'    => $sub_expires,
            'wg_config'  => $wg_config,
        ]);
        break;

    // ─── GET WIREGUARD CONFIG ──────────────────────
    case 'config':
        if ($method !== 'GET') json_error('Method not allowed', 405);
        $subscriber = auth_subscriber($conn);
        if (!$subscriber) json_error('Not authenticated', 401);
        
        // Check active
        $active = false;
        if ($subscriber['status'] === 'trial') {
            $active = strtotime($subscriber['trial_expires_at']) > time();
        } elseif ($subscriber['status'] === 'active') {
            $active = strtotime($subscriber['subscription_expires_at']) > time();
        }
        
        if (!$active) {
            json_error('Subscription expired. Please renew to get your WireGuard config.', 403);
        }
        
        if (!$subscriber['wg_peer_id']) {
            // Create peer if missing
            $peer_id = create_subscriber_peer($conn, $subscriber);
        } else {
            $peer_id = $subscriber['wg_peer_id'];
        }
        
        $config = get_peer_config($conn, $peer_id);
        $qr_png = shell_exec("echo " . escapeshellarg($config) . " | qrencode -t PNG -o - 2>/dev/null | base64 -w 0");
        
        json_response([
            'config'  => $config,
            'qr_code' => $qr_png ? "data:image/png;base64,{$qr_png}" : null,
        ]);
        break;

    case 'apk':
        // Serve the latest APK file for download
        $apk_dir = __DIR__ . '/../public/apk';
        $apk_files = glob($apk_dir . '/IonManDNS*.apk');
        if (!$apk_files) {
            // Try any .apk file
            $apk_files = glob($apk_dir . '/*.apk');
        }
        if (!$apk_files) {
            json_error('APK not available yet. Please check back later.', 404);
        }
        // Sort by modification time descending → latest first
        usort($apk_files, fn($a, $b) => filemtime($b) - filemtime($a));
        $apk = $apk_files[0];
        $filename = basename($apk);
        header('Content-Type: application/vnd.android.package-archive');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Content-Length: ' . filesize($apk));
        header('Cache-Control: no-cache');
        readfile($apk);
        exit;

    default:
        json_error('Unknown subscribe endpoint. Use: plans, register, login, status, payment, config, apk', 404);
}
