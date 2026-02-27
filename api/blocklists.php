<?php
/**
 * IonMan DNS - Blocklists Management API
 */

$conn = db();

switch ($method) {
    case 'GET':
        if ($id) {
            // Get single blocklist
            $stmt = $conn->prepare("SELECT * FROM blocklists WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            if (!$result) json_error('Blocklist not found', 404);
            json_response($result);
        }
        // Get all blocklists with hit counts from query_log
        $result = $conn->query("
            SELECT b.*,
                COALESCE(h.hits, 0) as hits
            FROM blocklists b
            LEFT JOIN (
                SELECT bd.source_list_id, COUNT(*) as hits
                FROM blocked_domains bd
                INNER JOIN query_log q ON q.domain = bd.domain AND q.action = 'blocked'
                WHERE q.logged_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY bd.source_list_id
            ) h ON h.source_list_id = b.id
            ORDER BY b.name
        ");
        $lists = [];
        while ($row = $result->fetch_assoc()) {
            $row['hits'] = (int)$row['hits'];
            $lists[] = $row;
        }
        json_response($lists);
        break;

    case 'POST':
        $data = get_json_body();
        
        if ($id && $action === 'update') {
            // Trigger blocklist update via Python
            $output = shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/blocklist_updater.py --list-id=$id 2>&1");
            json_response(['message' => 'Update triggered', 'output' => $output]);
        }
        
        if ($id && $action === 'toggle') {
            $stmt = $conn->prepare("UPDATE blocklists SET enabled = NOT enabled WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            // Regenerate dnsmasq config
            shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
            json_response(['message' => 'Blocklist toggled']);
        }

        if (!isset($data['name']) || !isset($data['url'])) {
            json_error('Name and URL required');
        }
        
        $stmt = $conn->prepare("INSERT INTO blocklists (name, url) VALUES (?, ?)");
        $stmt->bind_param('ss', $data['name'], $data['url']);
        $stmt->execute();
        $new_id = $conn->insert_id;
        
        // Immediately fetch the list
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/blocklist_updater.py --list-id=$new_id 2>&1");
        
        json_response(['message' => 'Blocklist added', 'id' => $new_id], 201);
        break;

    case 'PUT':
        if (!$id) json_error('Blocklist ID required');
        $data = get_json_body();
        
        $updates = [];
        $params = [];
        $types = '';
        
        if (isset($data['name'])) { $updates[] = 'name = ?'; $params[] = $data['name']; $types .= 's'; }
        if (isset($data['url'])) { $updates[] = 'url = ?'; $params[] = $data['url']; $types .= 's'; }
        if (isset($data['enabled'])) { $updates[] = 'enabled = ?'; $params[] = (int)$data['enabled']; $types .= 'i'; }
        
        if (empty($updates)) json_error('Nothing to update');
        
        $params[] = (int)$id;
        $types .= 'i';
        
        $stmt = $conn->prepare("UPDATE blocklists SET " . implode(', ', $updates) . " WHERE id = ?");
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        
        json_response(['message' => 'Blocklist updated']);
        break;

    case 'DELETE':
        if (!$id) json_error('Blocklist ID required');
        
        // Delete associated domains first
        $stmt = $conn->prepare("DELETE FROM blocked_domains WHERE source_list_id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        
        $stmt = $conn->prepare("DELETE FROM blocklists WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        
        // Regenerate dnsmasq config
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        
        json_response(['message' => 'Blocklist deleted']);
        break;

    default:
        json_error('Method not allowed', 405);
}
