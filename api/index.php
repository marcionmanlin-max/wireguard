<?php
/**
 * IonMan DNS - API Router
 */
require_once __DIR__ . '/config.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Strip /dns/api/ prefix
$path = preg_replace('#^/dns/api/?#', '', $uri);
$path = trim($path, '/');
$segments = explode('/', $path);
$resource = $segments[0] ?? '';
$id = $segments[1] ?? null;
$action = $segments[2] ?? null;

// Auth middleware - protect all endpoints except auth/login, subscribe/*, and OPTIONS
if ($method !== 'OPTIONS' && !($resource === 'auth' && $id === 'login') && $resource !== 'subscribe') {
    $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($token) {
        $auth_conn = db();
        $auth_stmt = $auth_conn->prepare("SELECT id FROM auth_tokens WHERE token = ? AND expires_at > NOW()");
        if ($auth_stmt) {
            $auth_stmt->bind_param('s', $token);
            $auth_stmt->execute();
            $auth_valid = $auth_stmt->get_result()->fetch_assoc();
            if (!$auth_valid) {
                json_response(['error' => 'Unauthorized', 'authenticated' => false], 401);
            }
        }
    } else if ($resource !== 'auth' && $resource !== '') {
        // Check if auth is set up (has any password hash)
        $has_auth = get_setting('admin_password_hash');
        if ($has_auth) {
            json_response(['error' => 'Unauthorized', 'authenticated' => false], 401);
        }
    }
}

switch ($resource) {
    case 'auth':
        require_once __DIR__ . '/auth.php';
        break;
    case 'stats':
        require_once __DIR__ . '/stats.php';
        break;
    case 'blocklists':
        require_once __DIR__ . '/blocklists.php';
        break;
    case 'domains':
        require_once __DIR__ . '/domains.php';
        break;
    case 'querylog':
        require_once __DIR__ . '/querylog.php';
        break;
    case 'settings':
        require_once __DIR__ . '/settings.php';
        break;
    case 'wireguard':
        require_once __DIR__ . '/wireguard.php';
        break;
    case 'control':
        require_once __DIR__ . '/control.php';
        break;
    case 'system':
        require_once __DIR__ . '/system.php';
        break;
    case 'public-ip':
        require_once __DIR__ . '/public_ip.php';
        break;
    case 'categories':
        require_once __DIR__ . '/categories.php';
        break;
    case 'peer-blocking':
        require_once __DIR__ . '/peer_blocking.php';
        break;
    case 'port-blocking':
        require_once __DIR__ . '/port_blocking.php';
        break;
    case 'regex':
        require_once __DIR__ . '/regex.php';
        break;
    case 'subscribe':
        require_once __DIR__ . '/subscribe.php';
        break;
    case 'subscribers':
        require_once __DIR__ . '/subscribers.php';
        break;
    case 'resolver':
        require_once __DIR__ . '/resolver.php';
        break;
    default:
        json_response([
            'name' => 'IonMan DNS+WG+Resolver',
            'version' => '2.1.0',
            'status' => 'running',
            'endpoints' => [
                'GET /api/stats',
                'GET|POST /api/blocklists',
                'GET|POST|DELETE /api/domains/{type}',
                'GET /api/querylog',
                'GET|PUT /api/settings',
                'GET|POST|DELETE /api/wireguard',
                'POST /api/control/{action}',
                'GET /api/system',
                'GET /api/public-ip',
                'GET|PUT /api/categories',
                'GET|POST|PUT|DELETE /api/regex',
                'GET|PUT|POST|DELETE /api/port-blocking',
                'GET /api/subscribe/plans',
                'POST /api/subscribe/register',
                'POST /api/subscribe/login',
                'GET /api/subscribe/status',
                'POST /api/subscribe/payment',
                'GET /api/subscribe/config',
                'GET|POST /api/subscribers',
            ]
        ]);
}
