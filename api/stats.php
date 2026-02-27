<?php
/**
 * IonMan DNS - Dashboard Statistics API
 */

$conn = db();

// Total domains blocked
$total_blocked = $conn->query("SELECT COUNT(DISTINCT domain) as cnt FROM blocked_domains")->fetch_assoc()['cnt'];

// Total blocklists
$total_lists = $conn->query("SELECT COUNT(*) as cnt FROM blocklists WHERE enabled = 1")->fetch_assoc()['cnt'];

// Queries today
$today = date('Y-m-d');
$queries_today = $conn->query("SELECT COUNT(*) as cnt FROM query_log WHERE DATE(logged_at) = '$today'")->fetch_assoc()['cnt'];
$blocked_today = $conn->query("SELECT COUNT(*) as cnt FROM query_log WHERE DATE(logged_at) = '$today' AND action = 'blocked'")->fetch_assoc()['cnt'];
$allowed_today = $queries_today - $blocked_today;
$block_percentage = $queries_today > 0 ? round(($blocked_today / $queries_today) * 100, 1) : 0;

// Queries last 24h by hour
$hourly = $conn->query("
    SELECT 
        DATE_FORMAT(logged_at, '%Y-%m-%d %H:00:00') as hour,
        SUM(CASE WHEN action = 'allowed' THEN 1 ELSE 0 END) as allowed,
        SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) as blocked
    FROM query_log 
    WHERE logged_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY hour
    ORDER BY hour
");
$hourly_data = [];
while ($row = $hourly->fetch_assoc()) {
    $hourly_data[] = $row;
}

// Top blocked domains
$top_blocked = $conn->query("
    SELECT domain, COUNT(*) as count 
    FROM query_log 
    WHERE action = 'blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY domain 
    ORDER BY count DESC 
    LIMIT 10
");
$top_blocked_data = [];
while ($row = $top_blocked->fetch_assoc()) {
    $top_blocked_data[] = $row;
}

// Top clients
$top_clients = $conn->query("
    SELECT client_ip, COUNT(*) as total,
        SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) as blocked
    FROM query_log 
    WHERE logged_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY client_ip 
    ORDER BY total DESC 
    LIMIT 10
");
$top_clients_data = [];
while ($row = $top_clients->fetch_assoc()) {
    $top_clients_data[] = $row;
}

// WireGuard peer name map (IP -> name)
$wg_client_map = [];
$wg_result = $conn->query("SELECT name, allowed_ips FROM wg_peers WHERE enabled = 1");
if ($wg_result) {
    while ($wg = $wg_result->fetch_assoc()) {
        $ip = explode('/', $wg['allowed_ips'])[0];
        $wg_client_map[$ip] = $wg['name'];
    }
}
// Fallback: parse wg0.conf for peer names if DB is empty
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
    // Aliases are lower priority — WireGuard peer names take precedence
    $wg_client_map = array_merge($aliases, $wg_client_map);
}

// Client type map (IP -> type: wireguard, lan, server)
$client_types = [];
foreach (array_keys($wg_client_map) as $ip) {
    $client_types[$ip] = 'wireguard';
}
// Also map WireGuard IPs not in peer DB
foreach ($top_clients_data as $tc) {
    $ip = $tc['client_ip'];
    if (!isset($client_types[$ip])) {
        if (str_starts_with($ip, '10.0.0.')) {
            $client_types[$ip] = 'wireguard';
        } elseif ($ip === '127.0.0.1' || $ip === '::1') {
            $client_types[$ip] = 'server';
        } else {
            $client_types[$ip] = 'lan';
        }
    }
}

// YouTube & Facebook Ad blocking stats (last 24h)
$yt_ad_domains = "'googleads.g.doubleclick.net','ad.doubleclick.net','pubads.g.doubleclick.net','securepubads.g.doubleclick.net','pagead.l.doubleclick.net','pagead2.googlesyndication.com','tpc.googlesyndication.com','ade.googlesyndication.com','video-ad-stats.googlesyndication.com','ads.youtube.com','imasdk.googleapis.com','manifest.googlevideo.com','s0.2mdn.net','static.doubleclick.net','m.doubleclick.net','partnerad.l.doubleclick.net','www.googleadservices.com','adservice.google.com','adservice.google.com.ph','clientservices.googleapis.com'";
$fb_ad_domains = "'ads.facebook.com','an.facebook.com','pixel.facebook.com','www.facebook.com/tr','analytics.facebook.com'";
$admob_domains = "'admob.com','media.admob.com','googleads.g.doubleclick.net'";

$yt_ads_blocked = (int)$conn->query("
    SELECT COUNT(*) as cnt FROM query_log 
    WHERE action = 'blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR 
    AND domain IN ($yt_ad_domains)
")->fetch_assoc()['cnt'];

$fb_ads_blocked = (int)$conn->query("
    SELECT COUNT(*) as cnt FROM query_log 
    WHERE action = 'blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR 
    AND (domain IN ($fb_ad_domains) OR domain LIKE '%.fbcdn.net' OR domain LIKE '%facebook%tracker%')
")->fetch_assoc()['cnt'];

$total_ads_blocked = (int)$conn->query("
    SELECT COUNT(*) as cnt FROM query_log
    WHERE action = 'blocked' AND logged_at >= NOW() - INTERVAL 24 HOUR
    AND (
        domain IN ($yt_ad_domains)
        OR domain IN ($fb_ad_domains)
        OR domain IN ($admob_domains)
        OR domain LIKE '%doubleclick%'
        OR domain LIKE '%googlesyndication%'
        OR domain LIKE '%googleadservices%'
        OR domain LIKE '%googletag%'
        OR domain LIKE '%google-analytics%'
        OR domain LIKE '%googletagmanager%'
        OR domain LIKE '%googletagservices%'
        OR domain LIKE '%admob%'
        OR domain LIKE '%2mdn.net'
    )
")->fetch_assoc()['cnt'];

// Top allowed domains
$top_allowed = $conn->query("
    SELECT domain, COUNT(*) as count 
    FROM query_log 
    WHERE action = 'allowed' AND logged_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY domain 
    ORDER BY count DESC 
    LIMIT 10
");
$top_allowed_data = [];
while ($row = $top_allowed->fetch_assoc()) {
    $top_allowed_data[] = $row;
}

// Top games blocked (by DNS hits in last 24h)
$game_ports_file = dirname(__DIR__) . '/config/game_ports.json';
$top_games_data = [];
if (file_exists($game_ports_file)) {
    $game_ports = json_decode(file_get_contents($game_ports_file), true) ?: [];
    foreach ($game_ports as $key => $info) {
        if (empty($info['domains'])) continue;
        $escaped = array_map(fn($d) => "'" . $conn->real_escape_string($d) . "'", $info['domains']);
        $in = implode(',', $escaped);
        $res = $conn->query("SELECT COUNT(*) as cnt FROM query_log WHERE logged_at >= NOW() - INTERVAL 24 HOUR AND domain IN ($in)");
        $hits = (int)($res ? $res->fetch_assoc()['cnt'] : 0);
        if ($hits > 0) {
            $top_games_data[] = [
                'key'   => $key,
                'label' => $info['label'] ?? $key,
                'icon'  => $info['icon'] ?? 'Gamepad2',
                'color' => $info['color'] ?? '#666666',
                'hits'  => $hits,
            ];
        }
    }
    usort($top_games_data, fn($a, $b) => $b['hits'] - $a['hits']);
    $top_games_data = array_slice($top_games_data, 0, 8);
}

// DNS service status
$dnsmasq_running = trim(shell_exec('systemctl is-active dnsmasq 2>/dev/null')) === 'active';
$blocking_enabled = get_setting('blocking_enabled') === '1';

// Whitelist/custom blacklist counts
$whitelist_count = $conn->query("SELECT COUNT(*) as cnt FROM whitelist")->fetch_assoc()['cnt'];
$custom_blacklist_count = $conn->query("SELECT COUNT(*) as cnt FROM custom_blacklist")->fetch_assoc()['cnt'];

json_response([
    'total_blocked_domains' => (int)$total_blocked,
    'total_blocklists' => (int)$total_lists,
    'whitelist_count' => (int)$whitelist_count,
    'custom_blacklist_count' => (int)$custom_blacklist_count,
    'queries_today' => (int)$queries_today,
    'blocked_today' => (int)$blocked_today,
    'allowed_today' => (int)$allowed_today,
    'block_percentage' => $block_percentage,
    'hourly_data' => $hourly_data,
    'top_blocked' => $top_blocked_data,
    'top_allowed' => $top_allowed_data,
    'top_clients' => $top_clients_data,
    'top_games' => $top_games_data,
    'client_names' => $wg_client_map,
    'client_types' => $client_types,
    'dns_running' => $dnsmasq_running,
    'blocking_enabled' => $blocking_enabled,
    'ad_stats' => [
        'youtube_ads_blocked' => $yt_ads_blocked,
        'facebook_ads_blocked' => $fb_ads_blocked,
        'total_ads_blocked' => $total_ads_blocked,
    ],
]);
