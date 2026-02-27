<?php
/**
 * IonMan DNS - Public IP Auto-detection
 */

// Try multiple sources
$ip = null;
$sources = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com',
];

$ctx = stream_context_create(['http' => ['timeout' => 3]]);

foreach ($sources as $src) {
    $result = @file_get_contents($src, false, $ctx);
    if ($result && filter_var(trim($result), FILTER_VALIDATE_IP)) {
        $ip = trim($result);
        break;
    }
}

json_response([
    'ip' => $ip,
    'detected' => $ip !== null,
]);
