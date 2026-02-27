#!/usr/bin/env php
<?php
/**
 * IonMan DNS - Subscription Expiry Cron
 * Run every minute: * * * * * /usr/bin/php /var/www/html/ionman-dns/api/cron_expire.php >> /var/www/html/ionman-dns/logs/cron.log 2>&1
 *
 * - Expires trials past 10 minutes
 * - Expires subscriptions past their end date
 * - Disables WireGuard peers for expired users
 */

// No web output
if (php_sapi_name() !== 'cli') { die('CLI only'); }

// DB connection — credentials loaded from api/config.php (gitignored)
require_once __DIR__ . '/config.php';
$db = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER,
    DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$now = date('Y-m-d H:i:s');
$expired = 0;

// 1. Expire trials
$stmt = $db->prepare("
    SELECT id, email, wg_peer_id FROM subscribers
    WHERE status = 'trial' AND trial_expires_at IS NOT NULL AND trial_expires_at <= ?
");
$stmt->execute([$now]);
$trials = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($trials as $sub) {
    $db->prepare("UPDATE subscribers SET status = 'expired' WHERE id = ?")->execute([$sub['id']]);
    if ($sub['wg_peer_id']) {
        disable_peer($db, $sub['wg_peer_id']);
    }
    echo "[$now] Trial expired: {$sub['email']} (ID {$sub['id']})\n";
    $expired++;
}

// 2. Expire active subscriptions
$stmt = $db->prepare("
    SELECT id, email, wg_peer_id FROM subscribers
    WHERE status = 'active' AND subscription_expires_at IS NOT NULL AND subscription_expires_at <= ?
");
$stmt->execute([$now]);
$actives = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($actives as $sub) {
    $db->prepare("UPDATE subscribers SET status = 'expired' WHERE id = ?")->execute([$sub['id']]);
    if ($sub['wg_peer_id']) {
        disable_peer($db, $sub['wg_peer_id']);
    }
    echo "[$now] Subscription expired: {$sub['email']} (ID {$sub['id']})\n";
    $expired++;
}

// 3. Clean up old tokens
$db->prepare("DELETE FROM subscriber_tokens WHERE expires_at <= ?")->execute([$now]);

if ($expired > 0) {
    echo "[$now] Total expired: $expired\n";
}

/**
 * Disable a WireGuard peer
 */
function disable_peer(PDO $db, int $peerId): void {
    $peer = $db->query("SELECT public_key FROM wg_peers WHERE id = $peerId")->fetch(PDO::FETCH_ASSOC);
    if (!$peer) return;

    // Remove from live interface
    exec("wg set wg0 peer {$peer['public_key']} remove 2>&1", $out, $rc);

    // Mark disabled in DB
    $db->prepare("UPDATE wg_peers SET enabled = 0 WHERE id = ?")->execute([$peerId]);
}
