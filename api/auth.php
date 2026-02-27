<?php
/**
 * IonMan DNS - Authentication API
 * Simple password-only auth with session tokens
 */

$conn = db();

switch ($method) {
    case 'POST':
        if ($id === 'login') {
            $data = get_json_body();
            $password = $data['password'] ?? '';
            
            // Get stored password hash, or use default
            $stored_hash = get_setting('admin_password_hash');
            if (!$stored_hash) {
                // No password set — reject login until installer sets one
                json_error('No admin password configured. Run the installer first.', 403);
            }
            
            if (password_verify($password, $stored_hash)) {
                // Generate session token
                $token = bin2hex(random_bytes(32));
                $expires = date('Y-m-d H:i:s', strtotime('+7 days'));
                
                // Store token
                $conn->query("CREATE TABLE IF NOT EXISTS auth_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token VARCHAR(64) NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL
                )");
                
                // Clean expired tokens
                $conn->query("DELETE FROM auth_tokens WHERE expires_at < NOW()");
                
                $stmt = $conn->prepare("INSERT INTO auth_tokens (token, expires_at) VALUES (?, ?)");
                $stmt->bind_param('ss', $token, $expires);
                $stmt->execute();
                
                json_response([
                    'authenticated' => true,
                    'token' => $token,
                    'expires' => $expires,
                ]);
            } else {
                json_error('Invalid password', 401);
            }
        }
        
        if ($id === 'logout') {
            $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
            if ($token) {
                $stmt = $conn->prepare("DELETE FROM auth_tokens WHERE token = ?");
                $stmt->bind_param('s', $token);
                $stmt->execute();
            }
            json_response(['message' => 'Logged out']);
        }
        
        if ($id === 'change-password') {
            // Verify current auth
            $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
            $stmt = $conn->prepare("SELECT id FROM auth_tokens WHERE token = ? AND expires_at > NOW()");
            $stmt->bind_param('s', $token);
            $stmt->execute();
            if (!$stmt->get_result()->fetch_assoc()) {
                json_error('Unauthorized', 401);
            }
            
            $data = get_json_body();
            $new_password = $data['new_password'] ?? '';
            if (strlen($new_password) < 6) {
                json_error('Password must be at least 6 characters');
            }
            
            $hash = password_hash($new_password, PASSWORD_BCRYPT);
            set_setting('admin_password_hash', $hash);
            
            // Invalidate all tokens
            $conn->query("DELETE FROM auth_tokens");
            
            json_response(['message' => 'Password changed. Please log in again.']);
        }
        break;
        
    case 'GET':
        // Verify token
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (!$token) {
            json_response(['authenticated' => false], 401);
        }
        
        $stmt = $conn->prepare("SELECT id, expires_at FROM auth_tokens WHERE token = ? AND expires_at > NOW()");
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        
        if ($row) {
            json_response(['authenticated' => true, 'expires' => $row['expires_at']]);
        } else {
            json_response(['authenticated' => false], 401);
        }
        break;
        
    default:
        json_error('Method not allowed', 405);
}
