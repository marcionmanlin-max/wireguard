<?php
/**
 * IonMan DNS+WireGuard - Subscription Admin API
 * Admin-only endpoints (requires admin auth token)
 *
 * GET  /subscribers                  - List all subscribers
 * GET  /subscribers/{id}             - Get subscriber details
 * POST /subscribers/verify-payment   - Verify a payment & activate subscription
 * POST /subscribers/reject-payment   - Reject a payment
 * POST /subscribers/suspend/{id}     - Suspend a subscriber
 * POST /subscribers/activate/{id}    - Manually activate a subscriber
 */

$conn = db();

switch ($method) {
    case 'GET':
        if ($id) {
            // Single subscriber with payments
            $stmt = $conn->prepare("SELECT id, email, full_name, phone, address, city, barangay, province, region, plan, status, trial_started_at, trial_expires_at, subscription_started_at, subscription_expires_at, wg_peer_id, created_at FROM subscribers WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $sub = $stmt->get_result()->fetch_assoc();
            if (!$sub) json_error('Subscriber not found', 404);
            
            $stmt2 = $conn->prepare("SELECT * FROM payments WHERE subscriber_id = ? ORDER BY created_at DESC");
            $stmt2->bind_param('i', $id);
            $stmt2->execute();
            $payments = [];
            $result = $stmt2->get_result();
            while ($row = $result->fetch_assoc()) $payments[] = $row;
            
            $sub['payments'] = $payments;
            json_response($sub);
        }
        
        // List all subscribers
        $status_filter = $_GET['status'] ?? '';
        $sql = "SELECT id, email, full_name, phone, plan, status, trial_expires_at, subscription_expires_at, wg_peer_id, created_at FROM subscribers";
        if ($status_filter) {
            $sql .= " WHERE status = '" . $conn->real_escape_string($status_filter) . "'";
        }
        $sql .= " ORDER BY created_at DESC";
        
        $result = $conn->query($sql);
        $subscribers = [];
        while ($row = $result->fetch_assoc()) {
            // Count pending payments
            $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM payments WHERE subscriber_id = ? AND status = 'pending'");
            $stmt->bind_param('i', $row['id']);
            $stmt->execute();
            $row['pending_payments'] = $stmt->get_result()->fetch_assoc()['cnt'];
            $subscribers[] = $row;
        }
        
        // Pending payments summary
        $pending = $conn->query("SELECT p.*, s.full_name, s.email, s.phone FROM payments p JOIN subscribers s ON p.subscriber_id = s.id WHERE p.status = 'pending' ORDER BY p.created_at DESC");
        $pending_payments = [];
        while ($row = $pending->fetch_assoc()) $pending_payments[] = $row;
        
        json_response([
            'subscribers'      => $subscribers,
            'total'            => count($subscribers),
            'pending_payments' => $pending_payments,
        ]);
        break;

    case 'POST':
        $data = get_json_body();
        
        if ($id === 'verify-payment') {
            if (empty($data['payment_id'])) json_error('payment_id required');
            
            $stmt = $conn->prepare("SELECT p.*, s.id as sub_id, s.plan as current_plan, s.wg_peer_id FROM payments p JOIN subscribers s ON p.subscriber_id = s.id WHERE p.id = ?");
            $stmt->bind_param('i', $data['payment_id']);
            $stmt->execute();
            $payment = $stmt->get_result()->fetch_assoc();
            if (!$payment) json_error('Payment not found', 404);
            if ($payment['status'] !== 'pending') json_error('Payment already processed');
            
            // Verify payment
            $now = date('Y-m-d H:i:s');
            $stmt = $conn->prepare("UPDATE payments SET status = 'verified', verified_at = ? WHERE id = ?");
            $stmt->bind_param('si', $now, $data['payment_id']);
            $stmt->execute();
            
            // Determine plan from payment amount
            $plan = $payment['amount_usd'] >= 50 ? 'selfhost' : 'client';
            $expires = date('Y-m-d H:i:s', strtotime($payment['period_end']) + 86400); // end of period_end day
            
            // Activate subscriber
            $stmt = $conn->prepare("UPDATE subscribers SET plan = ?, status = 'active', subscription_started_at = ?, subscription_expires_at = ? WHERE id = ?");
            $stmt->bind_param('sssi', $plan, $now, $expires, $payment['sub_id']);
            $stmt->execute();
            
            // Re-enable WireGuard peer if it was disabled
            if ($payment['wg_peer_id']) {
                $stmt = $conn->prepare("SELECT * FROM wg_peers WHERE id = ?");
                $stmt->bind_param('i', $payment['wg_peer_id']);
                $stmt->execute();
                $peer = $stmt->get_result()->fetch_assoc();
                if ($peer) {
                    $psk_file = tempnam('/tmp', 'wg_psk_');
                    file_put_contents($psk_file, $peer['preshared_key'] . "\n");
                    chmod($psk_file, 0600);
                    shell_exec("sudo wg set wg0 peer " . escapeshellarg($peer['public_key']) . " preshared-key " . escapeshellarg($psk_file) . " allowed-ips " . escapeshellarg($peer['allowed_ips']) . " 2>&1");
                    unlink($psk_file);
                    shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
                }
            } else {
                // Create peer
                $sub = ['id' => $payment['sub_id'], 'full_name' => 'subscriber'];
                $stmt_name = $conn->prepare("SELECT full_name FROM subscribers WHERE id = ?");
                $stmt_name->bind_param('i', $payment['sub_id']);
                $stmt_name->execute();
                $name_row = $stmt_name->get_result()->fetch_assoc();
                if ($name_row) $sub['full_name'] = $name_row['full_name'];
                
                // Load peer creation function from subscribe.php (guard to prevent its routing from executing)
                if (!defined('SUBSCRIBE_FUNCTIONS_ONLY')) define('SUBSCRIBE_FUNCTIONS_ONLY', true);
                require_once __DIR__ . '/subscribe.php';
                create_subscriber_peer($conn, $sub);
            }
            
            // Update subscriber token expiry
            $conn->query("UPDATE subscriber_tokens SET expires_at = '{$expires}' WHERE subscriber_id = {$payment['sub_id']}");
            
            json_response(['message' => 'Payment verified, subscriber activated', 'plan' => $plan, 'expires' => $expires]);
        }
        
        if ($id === 'reject-payment') {
            if (empty($data['payment_id'])) json_error('payment_id required');
            $stmt = $conn->prepare("UPDATE payments SET status = 'rejected', notes = ? WHERE id = ? AND status = 'pending'");
            $notes = $data['reason'] ?? 'Rejected by admin';
            $stmt->bind_param('si', $notes, $data['payment_id']);
            $stmt->execute();
            if ($stmt->affected_rows === 0) json_error('Payment not found or already processed');
            json_response(['message' => 'Payment rejected']);
        }
        
        if ($id === 'suspend' && $action) {
            $sub_id = (int)$action;
            $conn->query("UPDATE subscribers SET status = 'suspended' WHERE id = {$sub_id}");
            // Remove WireGuard peer
            $stmt = $conn->prepare("SELECT wg_peer_id FROM subscribers WHERE id = ?");
            $stmt->bind_param('i', $sub_id);
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
            json_response(['message' => 'Subscriber suspended']);
        }
        
        if ($id === 'activate' && $action) {
            $sub_id = (int)$action;
            $days = (int)($data['days'] ?? 30);
            $expires = date('Y-m-d H:i:s', time() + ($days * 86400));
            $now = date('Y-m-d H:i:s');
            $plan = $data['plan'] ?? 'client';
            $stmt = $conn->prepare("UPDATE subscribers SET plan = ?, status = 'active', subscription_started_at = ?, subscription_expires_at = ? WHERE id = ?");
            $stmt->bind_param('sssi', $plan, $now, $expires, $sub_id);
            $stmt->execute();
            json_response(['message' => 'Subscriber activated', 'expires' => $expires]);
        }

        // ─── CREATE SUBSCRIBER (admin) ─────────────────
        if ($id === 'create') {
            $required = ['email', 'password', 'full_name', 'phone'];
            foreach ($required as $field) {
                if (empty($data[$field])) json_error("$field is required");
            }
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                json_error('Invalid email address');
            }
            $stmt = $conn->prepare("SELECT id FROM subscribers WHERE email = ?");
            $stmt->bind_param('s', $data['email']);
            $stmt->execute();
            if ($stmt->get_result()->fetch_assoc()) {
                json_error('Email already registered');
            }

            $password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
            $now = date('Y-m-d H:i:s');
            $plan = $data['plan'] ?? 'client';
            $status = $data['status'] ?? 'active';
            $days = (int)($data['days'] ?? 30);
            $expires = date('Y-m-d H:i:s', time() + ($days * 86400));

            $address  = $data['address'] ?? '';
            $city     = $data['city'] ?? '';
            $barangay = $data['barangay'] ?? '';
            $province = $data['province'] ?? '';
            $region   = $data['region'] ?? '';

            $stmt = $conn->prepare("INSERT INTO subscribers (email, full_name, phone, address, city, barangay, province, region, plan, status, subscription_started_at, subscription_expires_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param('sssssssssssss', $data['email'], $data['full_name'], $data['phone'], $address, $city, $barangay, $province, $region, $plan, $status, $now, $expires, $password_hash);
            $stmt->execute();
            $subscriber_id = $conn->insert_id;

            // Create auth token
            $token = bin2hex(random_bytes(32));
            $stmt = $conn->prepare("INSERT INTO subscriber_tokens (subscriber_id, token, expires_at) VALUES (?, ?, ?)");
            $stmt->bind_param('iss', $subscriber_id, $token, $expires);
            $stmt->execute();

            // Create WireGuard peer (define guard before including subscribe.php to prevent its routing from running)
            if (!defined('SUBSCRIBE_FUNCTIONS_ONLY')) define('SUBSCRIBE_FUNCTIONS_ONLY', true);
            require_once __DIR__ . '/subscribe.php';
            $sub = ['id' => $subscriber_id, 'full_name' => $data['full_name']];
            $peer_id = create_subscriber_peer($conn, $sub);

            json_response(['message' => 'Subscriber created', 'subscriber_id' => $subscriber_id, 'plan' => $plan, 'expires' => $expires], 201);
        }

        if ($id === 'update' && $action) {
            $sub_id = (int)$action;
            $allowed = ['full_name', 'phone', 'email', 'address', 'city', 'barangay', 'province', 'region', 'plan', 'status'];
            $sets = [];
            $types = '';
            $vals = [];
            foreach ($allowed as $f) {
                if (isset($data[$f])) {
                    $sets[] = "$f = ?";
                    $types .= 's';
                    $vals[] = $data[$f];
                }
            }
            if (empty($sets)) json_error('No fields to update');
            // Handle password change
            if (!empty($data['password'])) {
                $sets[] = 'password_hash = ?';
                $types .= 's';
                $vals[] = password_hash($data['password'], PASSWORD_BCRYPT);
            }
            $types .= 'i';
            $vals[] = $sub_id;
            $stmt = $conn->prepare("UPDATE subscribers SET " . implode(', ', $sets) . " WHERE id = ?");
            $stmt->bind_param($types, ...$vals);
            $stmt->execute();
            json_response(['message' => 'Subscriber updated']);
        }

        json_error('Unknown action', 404);
        break;

    case 'DELETE':
        if (!$id || !ctype_digit($id)) json_error('Subscriber ID required', 400);
        $sub_id = (int)$id;
        // Fetch WG peer ID before deleting
        $stmt = $conn->prepare("SELECT wg_peer_id FROM subscribers WHERE id = ?");
        $stmt->bind_param('i', $sub_id);
        $stmt->execute();
        $sub = $stmt->get_result()->fetch_assoc();
        if (!$sub) json_error('Subscriber not found', 404);
        // Remove WireGuard peer
        if ($sub['wg_peer_id']) {
            $stmt2 = $conn->prepare("SELECT public_key FROM wg_peers WHERE id = ?");
            $stmt2->bind_param('i', $sub['wg_peer_id']);
            $stmt2->execute();
            $peer = $stmt2->get_result()->fetch_assoc();
            if ($peer) {
                shell_exec("sudo wg set wg0 peer " . escapeshellarg($peer['public_key']) . " remove 2>&1");
                shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/wireguard_manager.py sync 2>&1");
            }
            $conn->query("DELETE FROM wg_peers WHERE id = {$sub['wg_peer_id']}");
        }
        // Delete subscriber tokens and payments
        $conn->query("DELETE FROM subscriber_tokens WHERE subscriber_id = $sub_id");
        $conn->query("DELETE FROM payments WHERE subscriber_id = $sub_id");
        $conn->query("DELETE FROM subscribers WHERE id = $sub_id");
        json_response(['message' => 'Subscriber deleted']);
        break;

    default:
        json_error('Method not allowed', 405);
}
