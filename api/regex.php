<?php
/**
 * IonMan DNS - Regex/Wildcard Blocking API
 * Manage regex patterns for domain blocking (like Pi-hole/AdGuard)
 * 
 * GET    /regex         - List all regex patterns
 * POST   /regex         - Add new pattern
 * PUT    /regex/{id}    - Update pattern
 * DELETE /regex/{id}    - Delete pattern
 * POST   /regex/{id}/toggle  - Toggle enabled/disabled
 * POST   /regex/apply   - Apply regex patterns to blocklist
 */

$conn = db();

switch ($method) {
    case 'GET':
        $stmt = $conn->query("SELECT * FROM regex_blocklist ORDER BY created_at DESC");
        $patterns = $stmt->fetch_all(MYSQLI_ASSOC);
        
        // Count how many domains each regex matches (sample from blocklist)
        foreach ($patterns as &$p) {
            $p['id'] = (int)$p['id'];
            $p['is_wildcard'] = (bool)$p['is_wildcard'];
            $p['enabled'] = (bool)$p['enabled'];
        }
        
        json_response([
            'patterns' => $patterns,
            'total' => count($patterns),
            'enabled' => count(array_filter($patterns, fn($p) => $p['enabled'])),
        ]);
        break;
    
    case 'POST':
        if ($id === 'apply') {
            // Apply regex patterns: scan known domains and add matches to blocked
            $result = apply_regex_patterns($conn);
            json_response($result);
            break;
        }
        
        if ($action === 'toggle' && $id) {
            $stmt = $conn->prepare("UPDATE regex_blocklist SET enabled = NOT enabled WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            
            if ($stmt->affected_rows === 0) {
                json_error('Pattern not found', 404);
            }
            
            // Re-apply regex patterns
            apply_regex_patterns($conn);
            
            json_response(['message' => 'Pattern toggled', 'id' => (int)$id]);
            break;
        }
        
        $data = get_json_body();
        $pattern = trim($data['pattern'] ?? '');
        $comment = trim($data['comment'] ?? '');
        $is_wildcard = (bool)($data['is_wildcard'] ?? false);
        
        if (empty($pattern)) {
            json_error('Pattern is required');
        }
        
        // Validate regex
        if (!$is_wildcard) {
            if (@preg_match("/$pattern/", '') === false) {
                json_error('Invalid regex pattern: ' . preg_last_error_msg());
            }
        }
        
        // Check duplicate
        $stmt = $conn->prepare("SELECT id FROM regex_blocklist WHERE pattern = ?");
        $stmt->bind_param('s', $pattern);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            json_error('Pattern already exists');
        }
        
        $stmt = $conn->prepare("INSERT INTO regex_blocklist (pattern, is_wildcard, comment) VALUES (?, ?, ?)");
        $wc = $is_wildcard ? 1 : 0;
        $stmt->bind_param('sis', $pattern, $wc, $comment);
        $stmt->execute();
        $newId = $stmt->insert_id;
        
        // Apply the new pattern
        apply_regex_patterns($conn);
        
        json_response(['message' => 'Pattern added', 'id' => $newId], 201);
        break;
    
    case 'PUT':
        if (!$id) json_error('Pattern ID required');
        
        $data = get_json_body();
        $pattern = trim($data['pattern'] ?? '');
        $comment = trim($data['comment'] ?? '');
        $is_wildcard = (bool)($data['is_wildcard'] ?? false);
        $enabled = isset($data['enabled']) ? (bool)$data['enabled'] : true;
        
        if (empty($pattern)) {
            json_error('Pattern is required');
        }
        
        if (!$is_wildcard) {
            if (@preg_match("/$pattern/", '') === false) {
                json_error('Invalid regex pattern: ' . preg_last_error_msg());
            }
        }
        
        $stmt = $conn->prepare("UPDATE regex_blocklist SET pattern = ?, is_wildcard = ?, comment = ?, enabled = ? WHERE id = ?");
        $wc = $is_wildcard ? 1 : 0;
        $en = $enabled ? 1 : 0;
        $stmt->bind_param('sisii', $pattern, $wc, $comment, $en, $id);
        $stmt->execute();
        
        if ($stmt->affected_rows === 0) {
            json_error('Pattern not found', 404);
        }
        
        apply_regex_patterns($conn);
        
        json_response(['message' => 'Pattern updated']);
        break;
    
    case 'DELETE':
        if (!$id) json_error('Pattern ID required');
        
        $stmt = $conn->prepare("DELETE FROM regex_blocklist WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        
        if ($stmt->affected_rows === 0) {
            json_error('Pattern not found', 404);
        }
        
        // Clean up domains added by regex
        $stmt = $conn->prepare("DELETE FROM custom_blacklist WHERE comment LIKE 'Regex:%'");
        $stmt->execute();
        
        // Re-apply remaining patterns
        apply_regex_patterns($conn);
        
        json_response(['message' => 'Pattern deleted']);
        break;
    
    default:
        json_error('Method not allowed', 405);
}


function apply_regex_patterns($conn) {
    // Get all enabled patterns
    $stmt = $conn->query("SELECT * FROM regex_blocklist WHERE enabled = 1");
    $patterns = $stmt->fetch_all(MYSQLI_ASSOC);
    
    if (empty($patterns)) {
        // Remove all regex-added domains
        $conn->query("DELETE FROM custom_blacklist WHERE comment LIKE 'Regex:%'");
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        return ['message' => 'No patterns to apply', 'matched' => 0];
    }
    
    // Get unique domains from query_log to test against
    $stmt = $conn->query("SELECT DISTINCT domain FROM query_log WHERE logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) UNION SELECT DISTINCT domain FROM blocked_domains LIMIT 50000");
    $domains = [];
    while ($row = $stmt->fetch_assoc()) {
        $domains[] = $row['domain'];
    }
    
    // Also get some from recent logs if available
    $logFile = '/var/log/dnsmasq-ionman.log';
    if (file_exists($logFile)) {
        $lines = array_slice(file($logFile), -5000);
        foreach ($lines as $line) {
            if (preg_match('/query\[\w+\]\s+(\S+)/', $line, $m)) {
                $domains[] = strtolower($m[1]);
            }
        }
    }
    $domains = array_unique($domains);
    
    // Remove old regex-added domains
    $conn->query("DELETE FROM custom_blacklist WHERE comment LIKE 'Regex:%'");
    
    $matched = 0;
    $matchedDomains = [];
    
    foreach ($patterns as $pat) {
        $regex = $pat['pattern'];
        
        // Convert wildcard to regex
        if ($pat['is_wildcard']) {
            $regex = str_replace('.', '\\.', $regex);
            $regex = str_replace('*', '.*', $regex);
            $regex = "^{$regex}$";
        }
        
        foreach ($domains as $domain) {
            if (@preg_match("/{$regex}/i", $domain)) {
                $matchedDomains[$domain] = "Regex: {$pat['pattern']}";
            }
        }
    }
    
    // Don't add domains that are already in blocklists
    $existingStmt = $conn->query("SELECT domain FROM custom_blacklist WHERE comment NOT LIKE 'Regex:%'");
    $existing = [];
    while ($row = $existingStmt->fetch_assoc()) {
        $existing[$row['domain']] = true;
    }
    
    // Insert matched domains
    if (!empty($matchedDomains)) {
        $stmt = $conn->prepare("INSERT IGNORE INTO custom_blacklist (domain, comment) VALUES (?, ?)");
        foreach ($matchedDomains as $domain => $comment) {
            if (!isset($existing[$domain])) {
                $stmt->bind_param('ss', $domain, $comment);
                $stmt->execute();
                $matched++;
            }
        }
    }
    
    // Regenerate dnsmasq config
    shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
    
    return [
        'message' => "Applied {$matched} regex-matched domains",
        'matched' => $matched,
        'patterns_count' => count($patterns),
    ];
}
