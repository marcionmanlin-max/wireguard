<?php
/**
 * IonMan DNS - System Statistics API
 */

// CPU load
$load = sys_getloadavg();
$cpu_count = substr_count(file_get_contents('/proc/cpuinfo'), 'processor');
$cpu_percent = $cpu_count > 0 ? round(($load[0] / $cpu_count) * 100, 1) : 0;
if ($cpu_percent > 100) $cpu_percent = 100;

// Memory
$meminfo = file_get_contents('/proc/meminfo');
preg_match('/MemTotal:\s+(\d+)/', $meminfo, $m_total);
preg_match('/MemAvailable:\s+(\d+)/', $meminfo, $m_avail);
$mem_total = isset($m_total[1]) ? (int)$m_total[1] * 1024 : 0;
$mem_available = isset($m_avail[1]) ? (int)$m_avail[1] * 1024 : 0;
$mem_used = $mem_total - $mem_available;

// Disk
$disk_total = disk_total_space('/');
$disk_free = disk_free_space('/');
$disk_used = $disk_total - $disk_free;

// Uptime
$uptime_parts = explode(' ', trim(file_get_contents('/proc/uptime')));
$uptime_sec = (float)$uptime_parts[0];

// Hostname and OS
$hostname = gethostname();
$os = php_uname('s') . ' ' . php_uname('r');

// Temperature (optional)
$temp = null;
if (file_exists('/sys/class/thermal/thermal_zone0/temp')) {
    $temp = round((int)file_get_contents('/sys/class/thermal/thermal_zone0/temp') / 1000, 1);
}

// Network interfaces
$net_interfaces = [];
$ifdata = shell_exec("ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' 2>/dev/null");
if ($ifdata) {
    $net_interfaces = array_filter(explode("\n", trim($ifdata)));
}

// dnsmasq & wireguard status
$dnsmasq_active = trim(shell_exec('systemctl is-active dnsmasq 2>/dev/null')) === 'active';
$wg_active = trim(shell_exec('systemctl is-active wg-quick@wg0 2>/dev/null')) === 'active';

json_response([
    'hostname' => $hostname,
    'os' => $os,
    'cpu_count' => $cpu_count,
    'load_1' => round($load[0], 2),
    'load_5' => round($load[1], 2),
    'load_15' => round($load[2], 2),
    'cpu_percent' => $cpu_percent,
    'mem_total' => (int)$mem_total,
    'mem_used' => (int)$mem_used,
    'mem_available' => (int)$mem_available,
    'mem_percent' => $mem_total > 0 ? round(($mem_used / $mem_total) * 100, 1) : 0,
    'disk_total' => (int)$disk_total,
    'disk_used' => (int)$disk_used,
    'disk_free' => (int)$disk_free,
    'disk_percent' => $disk_total > 0 ? round(($disk_used / $disk_total) * 100, 1) : 0,
    'uptime_seconds' => (int)$uptime_sec,
    'temperature' => $temp,
    'network' => $net_interfaces,
    'services' => [
        'dnsmasq' => $dnsmasq_active,
        'wireguard' => $wg_active,
    ],
]);
