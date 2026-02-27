<?php
/**
 * IonMan DNS - DNS Control API (enable/disable/restart)
 */

switch ($id) {
    case 'enable':
        set_setting('blocking_enabled', '1');
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        shell_exec("sudo systemctl restart dnsmasq 2>&1");
        json_response(['message' => 'Blocking enabled']);
        break;

    case 'disable':
        set_setting('blocking_enabled', '0');
        shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/dnsmasq_config.py 2>&1");
        shell_exec("sudo systemctl restart dnsmasq 2>&1");
        json_response(['message' => 'Blocking disabled']);
        break;

    case 'restart':
        shell_exec("sudo systemctl restart dnsmasq 2>&1");
        shell_exec("sudo systemctl restart ionman-dns-proxy 2>&1");
        json_response(['message' => 'DNS service restarted']);
        break;

    case 'update':
        // Update all blocklists
        $output = shell_exec("sudo python3 " . IONMAN_ENGINE_DIR . "/blocklist_updater.py --all 2>&1");
        json_response(['message' => 'Blocklist update triggered', 'output' => $output]);
        break;

    case 'flush':
        // Flush query log older than retention
        $days = get_setting('log_retention_days') ?: '30';
        $conn = db();
        $stmt = $conn->prepare("DELETE FROM query_log WHERE logged_at < NOW() - INTERVAL ? DAY");
        $stmt->bind_param('i', $days);
        $stmt->execute();
        $deleted = $stmt->affected_rows;
        json_response(['message' => "$deleted log entries flushed"]);
        break;

    case 'wg-restart':
        shell_exec("sudo systemctl restart wg-quick@wg0 2>&1");
        json_response(['message' => 'WireGuard restarted']);
        break;

    default:
        json_error('Unknown action. Available: enable, disable, restart, update, flush, wg-restart');
}
