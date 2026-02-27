<?php
/**
 * IonMan DNS - Query Log API
 */

$conn = db();

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(1000, max(10, (int)($_GET['limit'] ?? 100)));
$offset = ($page - 1) * $limit;

$filter_action = $_GET['action'] ?? '';
$filter_domain = $_GET['domain'] ?? '';
$filter_client = $_GET['client'] ?? '';
$filter_ad_type = $_GET['ad_type'] ?? ''; // youtube, facebook, total
$grouped = isset($_GET['grouped']) && $_GET['grouped'] === '1';

$where = ["logged_at >= NOW() - INTERVAL 24 HOUR"];
$params = [];
$types = '';

if ($filter_action && in_array($filter_action, ['allowed', 'blocked'])) {
    $where[] = 'action = ?';
    $params[] = $filter_action;
    $types .= 's';
}
if ($filter_domain) {
    $where[] = 'domain LIKE ?';
    $params[] = "%$filter_domain%";
    $types .= 's';
}
if ($filter_client) {
    $where[] = 'client_ip = ?';
    $params[] = $filter_client;
    $types .= 's';
}

// Ad type domain filters (match stats.php logic)
if ($filter_ad_type) {
    $yt_ad_domains = "'googleads.g.doubleclick.net','ad.doubleclick.net','pubads.g.doubleclick.net','securepubads.g.doubleclick.net','pagead.l.doubleclick.net','pagead2.googlesyndication.com','tpc.googlesyndication.com','ade.googlesyndication.com','video-ad-stats.googlesyndication.com','ads.youtube.com','imasdk.googleapis.com','manifest.googlevideo.com','s0.2mdn.net','static.doubleclick.net','m.doubleclick.net','partnerad.l.doubleclick.net','www.googleadservices.com','adservice.google.com','adservice.google.com.ph','clientservices.googleapis.com'";
    $fb_ad_domains = "'ads.facebook.com','an.facebook.com','pixel.facebook.com','www.facebook.com/tr','analytics.facebook.com'";

    if ($filter_ad_type === 'youtube') {
        $where[] = "domain IN ($yt_ad_domains)";
        if (!$filter_action) { $where[] = "action = 'blocked'"; }
    } elseif ($filter_ad_type === 'facebook') {
        $where[] = "(domain IN ($fb_ad_domains) OR domain LIKE '%.fbcdn.net' OR domain LIKE '%facebook%tracker%')";
        if (!$filter_action) { $where[] = "action = 'blocked'"; }
    } elseif ($filter_ad_type === 'total') {
        $where[] = "(domain IN ($yt_ad_domains) OR domain IN ($fb_ad_domains) OR domain LIKE '%doubleclick%' OR domain LIKE '%googlesyndication%' OR domain LIKE '%googleadservices%' OR domain LIKE '%googletag%' OR domain LIKE '%google-analytics%' OR domain LIKE '%googletagmanager%' OR domain LIKE '%googletagservices%' OR domain LIKE '%admob%' OR domain LIKE '%2mdn.net' OR domain LIKE '%.fbcdn.net')";
        if (!$filter_action) { $where[] = "action = 'blocked'"; }
    }
}

$where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// WireGuard peer name map (IP -> name)
$wg_client_map = [];
$wg_result = $conn->query("SELECT name, allowed_ips FROM wg_peers WHERE enabled = 1");
if ($wg_result) {
    while ($wg = $wg_result->fetch_assoc()) {
        $ip = explode('/', $wg['allowed_ips'])[0];
        $wg_client_map[$ip] = $wg['name'];
    }
}
if (empty($wg_client_map)) {
    $conf = shell_exec('sudo cat /etc/wireguard/wg0.conf 2>/dev/null');
    if ($conf && preg_match_all('/^#\s*(.+)\n\[Peer\].*?AllowedIPs\s*=\s*([^\s\/]+)/ms', $conf, $m)) {
        for ($i = 0; $i < count($m[1]); $i++) {
            $wg_client_map[trim($m[2][$i])] = trim($m[1][$i]);
        }
    }
}

// Merge client aliases (LAN device names like router, gateway, etc.)
$aliases_file = dirname(__DIR__) . '/config/client_aliases.json';
if (file_exists($aliases_file)) {
    $aliases = json_decode(file_get_contents($aliases_file), true) ?: [];
    $wg_client_map = array_merge($aliases, $wg_client_map);
}

// Grouped mode: aggregate by domain+action with per-client breakdown
if ($grouped) {
    // Get grouped data
    $sql = "SELECT domain, action, client_ip, COUNT(*) as hits, MAX(logged_at) as last_seen
            FROM query_log $where_sql
            GROUP BY domain, action, client_ip
            ORDER BY hits DESC
            LIMIT 500";
    $stmt = $conn->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    // Aggregate: group by domain+action, embed client breakdown
    $domain_map = [];
    while ($row = $result->fetch_assoc()) {
        $key = $row['domain'] . '|' . $row['action'];
        if (!isset($domain_map[$key])) {
            $domain_map[$key] = [
                'domain' => $row['domain'],
                'action' => $row['action'],
                'hits' => 0,
                'last_seen' => $row['last_seen'],
                'clients' => [],
            ];
        }
        $domain_map[$key]['hits'] += (int)$row['hits'];
        if ($row['last_seen'] > $domain_map[$key]['last_seen']) {
            $domain_map[$key]['last_seen'] = $row['last_seen'];
        }
        $domain_map[$key]['clients'][] = [
            'ip' => $row['client_ip'],
            'name' => $wg_client_map[$row['client_ip']] ?? $row['client_ip'],
            'hits' => (int)$row['hits'],
        ];
    }

    // Sort by total hits desc
    $grouped_data = array_values($domain_map);
    usort($grouped_data, fn($a, $b) => $b['hits'] - $a['hits']);

    // Count total
    $count_sql = "SELECT COUNT(*) as cnt FROM query_log $where_sql";
    $count_stmt = $conn->prepare($count_sql);
    if ($params) $count_stmt->bind_param($types, ...$params);
    $count_stmt->execute();
    $total = $count_stmt->get_result()->fetch_assoc()['cnt'];

    json_response([
        'grouped' => $grouped_data,
        'total_queries' => (int)$total,
        'unique_domains' => count($grouped_data),
        'client_names' => $wg_client_map,
    ]);
}

// Count total
$count_sql = "SELECT COUNT(*) as cnt FROM query_log $where_sql";
$count_stmt = $conn->prepare($count_sql);
if ($params) $count_stmt->bind_param($types, ...$params);
$count_stmt->execute();
$total = $count_stmt->get_result()->fetch_assoc()['cnt'];

// Get logs
$sql = "SELECT * FROM query_log $where_sql ORDER BY logged_at DESC LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;
$types .= 'ii';

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$logs = [];
while ($row = $result->fetch_assoc()) {
    $logs[] = $row;
}

json_response([
    'logs' => $logs,
    'total' => (int)$total,
    'page' => $page,
    'pages' => ceil($total / $limit),
    'client_names' => $wg_client_map,
]);
