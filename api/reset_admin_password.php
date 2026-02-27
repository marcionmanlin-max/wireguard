<?php
// Quick admin password reset for IonMan DNS
// Usage: php reset_admin_password.php <new_password>
require_once __DIR__ . '/config.php';

$password = $argv[1] ?? readline('New admin password: ');
if (!$password) { die("Password cannot be empty.\n"); }
$hash = password_hash($password, PASSWORD_BCRYPT);

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($mysqli->connect_error) {
    die('DB connection failed: ' . $mysqli->connect_error);
}
$stmt = $mysqli->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('admin_password_hash', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
$stmt->bind_param('ss', $hash, $hash);
$stmt->execute();
if ($stmt->affected_rows > 0) {
    echo "Admin password reset successful.";
} else {
    echo "Password reset failed or no change.";
}
$stmt->close();
$mysqli->close();
