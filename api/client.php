<?php
/**
 * Client dashboard API
 * Subscriber mode:  Bearer token or ?token=   → subscriber auth
 * Peer mode:        ?peer_ip=10.0.0.X          → no auth (WireGuard peer direct access)
 *
 * Actions (GET /api/client/<action>):
 *   me       – profile / subscription / peer info
 *   stats    – DNS stats for today + hourly chart + top blocked
 *   queries  – recent queries (filterable: ?filter=all|allowed|blocked &search= &date= &limit=)
 *   grouped  – queries grouped by domain (?filter= &search= &date= &limit=)
 */

$conn = db();

// ── Auth ─────────────────────────────────────────────────────────────────────
// Peer mode: ?peer_ip=10.0.0.X  (no account needed)
$peer_mode    = false;
$peer_ip      = null;
$peer_name    = null;
$peer_speed   = null;
$sub          = null;

$raw_peer_ip = trim($_GET['peer_ip'] ?? '');
if ($raw_peer_ip && preg_match('/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/', $raw_peer_ip)) {
    // Look up peer in DB by allowed_ips
    $esc = $conn->real_escape_string($raw_peer_ip);
    $row = $conn->query("SELECT id, name, speed_limit_kbps FROM wg_peers
                          WHERE allowed_ips LIKE '$esc/%' OR allowed_ips = '$esc' LIMIT 1")->fetch_assoc();
    if ($row) {
        $peer_mode  = true;
        $peer_ip    = $raw_peer_ip;
        $peer_name  = $row['name'];
        $peer_speed = $row['speed_limit_kbps'];
    } else {
        json_response(['error' => 'Peer not found'], 404);
    }
} else {
    // Subscriber token mode
    $token = '';
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($auth_header) $token = str_replace('Bearer ', '', trim($auth_header));
    elseif (!empty($_GET['token'])) $token = trim($_GET['token']);
    if (!$token) json_response(['error' => 'Token or peer_ip required'], 401);

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
    if (!$sub) json_response(['error' => 'Invalid or expired token. Please login again.'], 401);

    if ($sub['wg_peer_id']) {
        $ps = $conn->prepare("SELECT allowed_ips, name, speed_limit_kbps FROM wg_peers WHERE id = ?");
        $ps->bind_param('i', $sub['wg_peer_id']);
        $ps->execute();
        $peer = $ps->get_result()->fetch_assoc();
        if ($peer) {
            $peer_ip    = explode('/', $peer['allowed_ips'])[0];
            $peer_name  = $peer['name'];
            $peer_speed = $peer['speed_limit_kbps'];
        }
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function build_where(mysqli $conn, ?string $peer_ip, string $extra_ip_col = 'client_ip'): string {
    $w = [];
    if ($peer_ip) $w[] = "$extra_ip_col = '".$conn->real_escape_string($peer_ip)."'";
    return $w ? 'AND '.implode(' AND ', $w) : '';
}

function apply_filters(mysqli $conn, string $base_where): string {
    $parts = [$base_where];
    $filter = trim($_GET['filter'] ?? 'all');
    if ($filter === 'allowed') $parts[] = "AND action = 'allowed'";
    elseif ($filter === 'blocked') $parts[] = "AND action = 'blocked'";

    $search = trim($_GET['search'] ?? '');
    if ($search !== '') {
        $esc = $conn->real_escape_string($search);
        $parts[] = "AND domain LIKE '%$esc%'";
    }

    $date = trim($_GET['date'] ?? '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $esc = $conn->real_escape_string($date);
        $parts[] = "AND DATE(logged_at) = '$esc'";
    } else {
        $parts[] = "AND DATE(logged_at) = CURDATE()";
    }
    return implode(' ', $parts);
}

// ── Action routing ────────────────────────────────────────────────────────────
global $segments;
$action = $segments[1] ?? 'me';

switch ($action) {

    // ─── me ──────────────────────────────────────────────────────────────────
    case 'me':
        if ($peer_mode) {
            json_response([
                'mode'        => 'peer',
                'peer_name'   => $peer_name,
                'peer_ip'     => $peer_ip,
                'speed_limit' => $peer_speed ? format_speed($peer_speed) : null,
                'speed_kbps'  => $peer_speed,
                'dns_server'  => '10.0.0.1',
                'server'      => 'dns.makoyot.xyz',
            ]);
        }

        // Subscriber
        $expires = null; $active = false;
        if ($sub['status'] === 'trial') {
            $expires = $sub['trial_expires_at'];
            $active  = $expires && strtotime($expires) > time();
        } elseif ($sub['status'] === 'active') {
            $expires = $sub['subscription_expires_at'];
            $active  = $expires && strtotime($expires) > time();
        }
        $days_left = $expires ? max(0, ceil((strtotime($expires) - time()) / 86400)) : 0;

        json_response([
            'mode'        => 'subscriber',
            'name'        => $sub['full_name'],
            'email'       => $sub['email'],
            'status'      => $sub['status'],
            'active'      => $active,
            'plan'        => $sub['plan'],
            'expires_at'  => $expires,
            'days_left'   => $days_left,
            'peer_ip'     => $peer_ip,
            'peer_name'   => $peer_name,
            'speed_limit' => $peer_speed ? format_speed($peer_speed) : null,
            'speed_kbps'  => $peer_speed,
            'dns_server'  => '10.0.0.1',
            'server'      => 'dns.makoyot.xyz',
        ]);
        break;

    // ─── stats ───────────────────────────────────────────────────────────────
    case 'stats':
        $base = build_where($conn, $peer_ip);
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'] ?? '')
              ? $conn->real_escape_string($_GET['date']) : date('Y-m-d');

        $dr = $conn->query("SELECT
                COUNT(*) as total,
                SUM(action='blocked') as blocked,
                SUM(action='allowed') as allowed
             FROM query_log WHERE DATE(logged_at)='$date' $base")->fetch_assoc();
        $total   = (int)($dr['total'] ?? 0);
        $blocked = (int)($dr['blocked'] ?? 0);
        $allowed = (int)($dr['allowed'] ?? 0);

        // Hourly for last 24h
        $hq = $conn->query("
            SELECT DATE_FORMAT(logged_at,'%H:00') as hour,
                   SUM(action='allowed') as allowed,
                   SUM(action='blocked') as blocked
            FROM query_log WHERE logged_at >= NOW() - INTERVAL 24 HOUR $base
            GROUP BY hour ORDER BY hour
        ");
        $hourly = [];
        while ($r = $hq->fetch_assoc()) $hourly[] = $r;

        // Top blocked
        $tq = $conn->query("
            SELECT domain, COUNT(*) as count
            FROM query_log WHERE action='blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR $base
            GROUP BY domain ORDER BY count DESC LIMIT 10
        ");
        $top_blocked = [];
        while ($r = $tq->fetch_assoc()) $top_blocked[] = $r;

        json_response([
            'total'       => $total,
            'blocked'     => $blocked,
            'allowed'     => $allowed,
            'block_rate'  => $total > 0 ? round($blocked / $total * 100, 1) : 0,
            'hourly'      => $hourly,
            'top_blocked' => $top_blocked,
            'peer_ip'     => $peer_ip,
            'date'        => $date,
        ]);
        break;

    // ─── queries (list with filters) ─────────────────────────────────────────
    case 'queries':
        $base   = build_where($conn, $peer_ip);
        $where  = apply_filters($conn, $base);
        $limit  = min((int)($_GET['limit'] ?? 100), 500);
        $q = $conn->query("
            SELECT domain, action, logged_at, client_ip
            FROM query_log WHERE 1=1 $where
            ORDER BY logged_at DESC LIMIT $limit
        ");
        $rows = [];
        while ($r = $q->fetch_assoc()) $rows[] = $r;
        json_response(['queries' => $rows, 'peer_ip' => $peer_ip, 'count' => count($rows)]);
        break;

    // ─── grouped (aggregate by domain) ───────────────────────────────────────
    case 'grouped':
        $base   = build_where($conn, $peer_ip);
        $where  = apply_filters($conn, $base);
        $limit  = min((int)($_GET['limit'] ?? 100), 500);
        $q = $conn->query("
            SELECT domain,
                   COUNT(*) as total,
                   SUM(action='blocked') as blocked,
                   SUM(action='allowed') as allowed,
                   MAX(logged_at) as last_seen
            FROM query_log WHERE 1=1 $where
            GROUP BY domain
            ORDER BY total DESC LIMIT $limit
        ");
        $rows = [];
        while ($r = $q->fetch_assoc()) $rows[] = $r;
        json_response(['grouped' => $rows, 'peer_ip' => $peer_ip, 'count' => count($rows)]);
        break;

    default:
        json_response(['error' => 'Unknown action'], 404);
}

function format_speed(int $kbps): string {
    if ($kbps >= 1024 * 1024) return round($kbps / (1024*1024), 1).' Gbps';
    if ($kbps >= 1024) return round($kbps / 1024, 1).' Mbps';
    return $kbps.' Kbps';
}
