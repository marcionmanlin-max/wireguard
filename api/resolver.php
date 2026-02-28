<?php
/**
 * IonMan Resolver API — registered under /dns/api/resolver
 * Auth is handled by index.php before this file is included.
 * Uses helpers: db(), json_response(), json_error(), get_json_body() from config.php
 */

$method  = $_SERVER['REQUEST_METHOD'];
$action  = $_GET['action'] ?? ($id ?? 'status');

$STATUS_FILE = '/tmp/ionman_resolver_status.json';
$CONFIG_FILE = '/var/www/html/ionman-dns/config/resolver.json';

$DEFAULT_CONFIG = [
    'upstreams' => [
        ['host' => '1.1.1.1',  'port' => 53, 'dot' => false, 'name' => 'Cloudflare'],
        ['host' => '8.8.8.8',  'port' => 53, 'dot' => false, 'name' => 'Google'],
        ['host' => '9.9.9.9',  'port' => 53, 'dot' => false, 'name' => 'Quad9'],
    ],
    'cache_size'    => 50000,
    'cache_min_ttl' => 60,
    'cache_max_ttl' => 86400,
    'log_queries'   => true,
    'dot_enabled'   => false,
    'dot_host'      => '1.1.1.1',
    'dot_port'      => 853,
    'timeout'       => 3.0,
];

function resolver_readStatus($file) {
    if (!file_exists($file)) return ['running' => false, 'note' => 'Resolver not started'];
    $age = time() - filemtime($file);
    $data = json_decode(file_get_contents($file), true) ?: [];
    if ($age > 15) { $data['running'] = false; $data['stale'] = true; }
    return $data;
}

function resolver_readConfig($file, $defaults) {
    if (!file_exists($file)) return $defaults;
    $data = json_decode(file_get_contents($file), true);
    return array_merge($defaults, $data ?: []);
}

function resolver_saveConfig($file, $config) {
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return file_put_contents($file, json_encode($config, JSON_PRETTY_PRINT));
}

function resolver_svc($action) {
    $allowed = ['start','stop','restart','status'];
    if (!in_array($action, $allowed)) return '';
    return trim(shell_exec("systemctl $action ionman-resolver.service 2>&1") ?: '');
}

switch ($action) {

    case 'status':
        $status = resolver_readStatus($STATUS_FILE);
        $status['service'] = trim(shell_exec('systemctl is-active ionman-resolver.service 2>/dev/null') ?: 'unknown');
        json_response($status);

    case 'config':
        if ($method === 'GET') {
            json_response(['success' => true, 'config' => resolver_readConfig($CONFIG_FILE, $DEFAULT_CONFIG)]);
        }
        if ($method === 'POST') {
            $body = get_json_body();
            if (!$body) json_error('Invalid JSON');
            $existing = resolver_readConfig($CONFIG_FILE, $DEFAULT_CONFIG);
            foreach (['upstreams','cache_size','cache_min_ttl','cache_max_ttl','log_queries','dot_enabled','dot_host','dot_port','timeout'] as $k) {
                if (isset($body[$k])) $existing[$k] = $body[$k];
            }
            if (resolver_saveConfig($CONFIG_FILE, $existing) !== false) {
                resolver_svc('restart');
                json_response(['success' => true, 'message' => 'Config saved, resolver restarted']);
            }
            json_error('Failed to write config', 500);
        }
        json_error('Method not allowed', 405);

    case 'flush':
        resolver_svc('restart');
        json_response(['success' => true, 'message' => 'Cache flushed, resolver restarted']);

    case 'start':
        $out = resolver_svc('start');
        sleep(1);
        $status = resolver_readStatus($STATUS_FILE);
        $status['service'] = trim(shell_exec('systemctl is-active ionman-resolver.service 2>/dev/null') ?: 'unknown');
        json_response(['success' => true, 'output' => $out, 'service' => $status]);

    case 'stop':
        json_response(['success' => true, 'output' => resolver_svc('stop')]);

    case 'restart':
        $out = resolver_svc('restart');
        sleep(1);
        $status = resolver_readStatus($STATUS_FILE);
        $status['service'] = trim(shell_exec('systemctl is-active ionman-resolver.service 2>/dev/null') ?: 'unknown');
        json_response(['success' => true, 'output' => $out, 'service' => $status]);

    case 'lookup':
        $domain = preg_replace('/[^a-zA-Z0-9.\-]/', '', $_GET['domain'] ?? '');
        $type   = preg_replace('/[^A-Za-z]/', '', $_GET['type'] ?? 'A');
        if (!$domain) json_error('No domain', 400);
        $cmd = 'dig @127.0.0.1 -p 5300 ' . escapeshellarg($domain) . ' ' . escapeshellarg($type) . ' +short +time=3 2>&1';
        json_response(['domain' => $domain, 'type' => strtoupper($type), 'result' => trim(shell_exec($cmd)), 'server' => '127.0.0.1:5300']);

    case 'log':
        $limit = min((int)($_GET['limit'] ?? 50), 500);
        try {
            $mysqli = db();
            $stmt = $mysqli->prepare("SELECT qname, qtype, client_ip, status, cached, upstream_ms, logged_at FROM resolver_log ORDER BY logged_at DESC LIMIT ?");
            $stmt->bind_param('i', $limit);
            $stmt->execute();
            json_response(['success' => true, 'log' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
        } catch (Exception $e) {
            json_response(['success' => true, 'log' => [], 'note' => 'Log table not yet available']);
        }

    case 'log_grouped':
        // Grouped hits by domain — filter: all | cached | forwarded | nxdomain | error
        $filter = $_GET['filter'] ?? 'all';
        $limit  = min((int)($_GET['limit'] ?? 50), 200);
        try {
            $mysqli = db();
            $where = '';
            if ($filter === 'cached')    $where = 'WHERE cached = 1';
            elseif ($filter === 'forwarded') $where = 'WHERE cached = 0 AND status = \'ok\'';
            elseif ($filter === 'nxdomain') $where = 'WHERE status = \'nxdomain\'';
            elseif ($filter === 'error')    $where = 'WHERE status = \'error\'';
            $stmt = $mysqli->prepare(
                "SELECT qname, qtype, COUNT(*) AS hits,
                        SUM(cached) AS cache_hits,
                        ROUND(AVG(upstream_ms),1) AS avg_ms,
                        MAX(logged_at) AS last_seen
                 FROM resolver_log $where
                 GROUP BY qname, qtype
                 ORDER BY hits DESC
                 LIMIT ?"
            );
            $stmt->bind_param('i', $limit);
            $stmt->execute();
            json_response(['success' => true, 'rows' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
        } catch (Exception $e) {
            json_response(['success' => true, 'rows' => [], 'note' => 'Log table not yet available']);
        }

    default:
        json_error("Unknown resolver action: $action", 404);
}
