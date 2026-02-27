<?php
/**
 * IonMan DNS - Custom Domain Management API (whitelist/blacklist)
 */

$conn = db();
$type = $id; // /api/domains/whitelist or /api/domains/blacklist
$domain_id = $action; // /api/domains/whitelist/123

if (!in_array($type, ['whitelist', 'blacklist'])) {
    json_error('Invalid type. Use whitelist or blacklist');
}

$table = $type === 'whitelist' ? 'whitelist' : 'custom_blacklist';

switch ($method) {
    case 'GET':
        $search = $_GET['search'] ?? '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        
        $action_filter = $table === 'whitelist' ? 'allowed' : 'blocked';
        if ($search) {
            $search_param = "%$search%";
            $stmt = $conn->prepare("
                SELECT d.*,
                    COALESCE((SELECT COUNT(*) FROM query_log q WHERE q.domain = d.domain AND q.action = '$action_filter'), 0) as hits
                FROM $table d WHERE d.domain LIKE ? ORDER BY d.created_at DESC LIMIT ? OFFSET ?");
            $stmt->bind_param('sii', $search_param, $limit, $offset);
            $count_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM $table WHERE domain LIKE ?");
            $count_stmt->bind_param('s', $search_param);
        } else {
            $stmt = $conn->prepare("
                SELECT d.*,
                    COALESCE((SELECT COUNT(*) FROM query_log q WHERE q.domain = d.domain AND q.action = '$action_filter'), 0) as hits
                FROM $table d ORDER BY d.created_at DESC LIMIT ? OFFSET ?");
            $stmt->bind_param('ii', $limit, $offset);
            $count_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM $table");
        }
        
        $count_stmt->execute();
        $total = $count_stmt->get_result()->fetch_assoc()['cnt'];
        
        $stmt->execute();
        $result = $stmt->get_result();
        $domains = [];
        while ($row = $result->fetch_assoc()) {
            $domains[] = $row;
        }
        
        json_response([
            'domains' => $domains,
            'total' => (int)$total,
            'page' => $page,
            'pages' => ceil($total / $limit),
        ]);
        break;

    case 'POST':
        $data = get_json_body();
        
        if (empty($data['domain'])) json_error('Domain required');
        
        // Support bulk add (comma or newline separated)
        $raw = $data['domain'];
        $domains = preg_split('/[\s,]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
        $comment = $data['comment'] ?? '';
        $added = 0;
        $errors = [];
        
        foreach ($domains as $domain) {
            $domain = strtolower(trim($domain));
            // Basic domain validation
            if (!preg_match('/^[a-z0-9]([a-z0-9\-]*\.)+[a-z]{2,}$/', $domain)) {
                $errors[] = "$domain: invalid format";
                continue;
            }
            
            $stmt = $conn->prepare("INSERT IGNORE INTO $table (domain, comment) VALUES (?, ?)");
            $stmt->bind_param('ss', $domain, $comment);
            if ($stmt->execute() && $stmt->affected_rows > 0) {
                $added++;
            } else {
                $errors[] = "$domain: already exists";
            }
        }
        
        // Regenerate dnsmasq config
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        
        json_response([
            'message' => "$added domain(s) added to $type",
            'added' => $added,
            'errors' => $errors,
        ], 201);
        break;

    case 'DELETE':
        if (!$domain_id) json_error('Domain ID required');
        
        $stmt = $conn->prepare("DELETE FROM $table WHERE id = ?");
        $stmt->bind_param('i', $domain_id);
        $stmt->execute();
        
        if ($stmt->affected_rows === 0) json_error('Domain not found', 404);
        
        // Regenerate dnsmasq config
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        
        json_response(['message' => 'Domain removed']);
        break;

    default:
        json_error('Method not allowed', 405);
}
