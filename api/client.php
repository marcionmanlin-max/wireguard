<?php
/**
 * Client dashboard API — authenticated via subscriber token
 * GET /api/client/stats   - stats for this subscriber's peer IP
 * GET /api/client/queries - recent query log for their IP
 * GET /api/client/me      - subscriber profile + subscription info
 */

$conn = db();

// Authenticate via subscriber token (passed as Bearer or ?token=)
$token = '';
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($auth_header) {
    $token = str_replace('Bearer ', '', $auth_header);
} elseif (!empty($_GET['token'])) {
    $token = trim($_GET['token']);
}

if (!$token) {
    json_response(['error' => 'Token required'], 401);
}

// Validate token
$stmt = $conn->prepare("
    SELECT st.subscriber_id, st.expires_at, s.email, s.full_name, s.status,
           s.plan, s.trial_expires_at, s.subscription_expires_at, s.wg_peer_id
    FROM subscriber_tokens st
    JOIN subscribers s ON s.id = st.subscriber_id
    WHERE st.token = ? AND st.expires_at > NOW()
");
$stmt->bind_param('s', $token);
$stmt->execute();
$sub = $stmt->get_result()->fetch_assoc();

if (!$sub) {
    json_response(['error' => 'Invalid or expired token. Please login again in the app.'], 401);
}

// Get peer IP for this subscriber
$peer_ip = null;
if ($sub['wg_peer_id']) {
    $ps = $conn->prepare("SELECT allowed_ips FROM wg_peers WHERE id = ?");
    $ps->bind_param('i', $sub['wg_peer_id']);
    $ps->execute();
    $peer = $ps->get_result()->fetch_assoc();
    if ($peer) {
        // Extract IP from CIDR e.g. 10.0.0.13/32 → 10.0.0.13
        $peer_ip = explode('/', $peer['allowed_ips'])[0];
    }
}

$action = $segments[1] ?? 'me';

switch ($action) {
    case 'me':
        // Subscription expiry
        $expires = null;
        $active  = false;
        if ($sub['status'] === 'trial') {
            $expires = $sub['trial_expires_at'];
            $active  = $expires && strtotime($expires) > time();
        } elseif ($sub['status'] === 'active') {
            $expires = $sub['subscription_expires_at'];
            $active  = $expires && strtotime($expires) > time();
        }

        $days_left = $expires ? max(0, ceil((strtotime($expires) - time()) / 86400)) : 0;

        json_response([
            'name'       => $sub['full_name'],
            'email'      => $sub['email'],
            'status'     => $sub['status'],
            'active'     => $active,
            'plan'       => $sub['plan'],
            'expires_at' => $expires,
            'days_left'  => $days_left,
            'peer_ip'    => $peer_ip,
        ]);
        break;

    case 'stats':
        $today = date('Y-m-d');
        $where_ip = $peer_ip ? "AND client_ip = '$peer_ip'" : '';

        $total   = $conn->query("SELECT COUNT(*) as c FROM query_log WHERE DATE(logged_at) = '$today' $where_ip")->fetch_assoc()['c'];
        $blocked = $conn->query("SELECT COUNT(*) as c FROM query_log WHERE DATE(logged_at) = '$today' AND action = 'blocked' $where_ip")->fetch_assoc()['c'];
        $allowed = $total - $blocked;

        // Hourly for chart (last 24h)
        $hourly_q = $conn->query("
            SELECT DATE_FORMAT(logged_at,'%H:00') as hour,
                   SUM(CASE WHEN action='allowed' THEN 1 ELSE 0 END) as allowed,
                   SUM(CASE WHEN action='blocked' THEN 1 ELSE 0 END) as blocked
            FROM query_log
            WHERE logged_at >= NOW() - INTERVAL 24 HOUR $where_ip
            GROUP BY hour ORDER BY hour
        ");
        $hourly = [];
        while ($r = $hourly_q->fetch_assoc()) $hourly[] = $r;

        // Top blocked domains
        $top_q = $conn->query("
            SELECT domain, COUNT(*) as count
            FROM query_log
            WHERE action='blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR $where_ip
            GROUP BY domain ORDER BY count DESC LIMIT 8
        ");
        $top_blocked = [];
        while ($r = $top_q->fetch_assoc()) $top_blocked[] = $r;

        json_response([
            'total'       => (int)$total,
            'blocked'     => (int)$blocked,
            'allowed'     => (int)$allowed,
            'block_rate'  => $total > 0 ? round($blocked / $total * 100, 1) : 0,
            'hourly'      => $hourly,
            'top_blocked' => $top_blocked,
            'peer_ip'     => $peer_ip,
        ]);
        break;

    case 'queries':
        $where_ip = $peer_ip ? "AND client_ip = '$peer_ip'" : '';
        $limit    = min((int)($_GET['limit'] ?? 50), 200);
        $q = $conn->query("
            SELECT domain, action, logged_at, client_ip
            FROM query_log
            WHERE 1=1 $where_ip
            ORDER BY logged_at DESC
            LIMIT $limit
        ");
        $rows = [];
        while ($r = $q->fetch_assoc()) $rows[] = $r;
        json_response(['queries' => $rows, 'peer_ip' => $peer_ip]);
        break;

    default:
        json_response(['error' => 'Unknown action'], 404);
}
