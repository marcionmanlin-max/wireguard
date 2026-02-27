<?php
/**
 * IonMan DNS - Settings API
 */

$conn = db();

switch ($method) {
    case 'GET':
        $result = $conn->query("SELECT setting_key, setting_value FROM settings ORDER BY setting_key");
        $settings = [];
        while ($row = $result->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        json_response($settings);
        break;

    case 'PUT':
        $data = get_json_body();
        if (empty($data)) json_error('No settings provided');
        
        $allowed_keys = [
            'upstream_dns', 'dns_port', 'blocking_enabled', 'blocking_mode',
            'log_queries', 'log_retention_days', 'cache_size',
            'wg_interface', 'wg_listen_port', 'wg_server_ip', 'wg_endpoint', 'wg_dns',
            'dns_upstream_1', 'dns_upstream_2',
            'block_social', 'block_streaming', 'block_gaming',
            'block_gambling', 'block_porn', 'block_dating',
        ];
        
        $updated = 0;
        foreach ($data as $key => $value) {
            if (!in_array($key, $allowed_keys)) continue;
            set_setting($key, $value);
            $updated++;
        }
        
        // Regenerate dnsmasq config if DNS settings changed
        $dns_keys = ['upstream_dns', 'dns_port', 'blocking_enabled', 'blocking_mode', 'cache_size'];
        if (array_intersect(array_keys($data), $dns_keys)) {
            shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
            // Restart IonMan Resolver so it picks up new upstream_dns from resolver.json
            if (isset($data['upstream_dns'])) {
                shell_exec('systemctl restart ionman-resolver 2>&1');
            }
        }
        
        json_response(['message' => "$updated setting(s) updated"]);
        break;

    default:
        json_error('Method not allowed', 405);
}
