<?php
/**
 * IonMan DNS - Subscription Plans CRUD API
 * Admin-only endpoints for managing subscription plans
 *
 * GET    /plans          - List all plans
 * GET    /plans/{id}     - Get single plan
 * POST   /plans          - Create new plan
 * PUT    /plans/{id}     - Update plan
 * DELETE /plans/{id}     - Delete plan (soft: deactivate)
 */

$conn = db();

switch ($method) {
    case 'GET':
        if ($id) {
            // Single plan
            $stmt = $conn->prepare("SELECT * FROM subscription_plans WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $plan = $stmt->get_result()->fetch_assoc();
            if (!$plan) json_error('Plan not found', 404);
            $plan['features'] = json_decode($plan['features'] ?? '[]', true);
            $plan['price_php'] = (float)$plan['price_php'];
            $plan['price_usd'] = (float)$plan['price_usd'];
            $plan['id'] = (int)$plan['id'];
            $plan['duration_value'] = (int)$plan['duration_value'];
            $plan['speed_limit_mbps'] = $plan['speed_limit_mbps'] ? (int)$plan['speed_limit_mbps'] : null;
            $plan['is_trial'] = (bool)$plan['is_trial'];
            $plan['is_active'] = (bool)$plan['is_active'];
            $plan['is_recommended'] = (bool)$plan['is_recommended'];
            $plan['sort_order'] = (int)$plan['sort_order'];
            json_response(['success' => true, 'plan' => $plan]);
        } else {
            // List all plans
            $show_all = isset($_GET['all']) && $_GET['all'] === '1';
            $sql = "SELECT * FROM subscription_plans";
            if (!$show_all) $sql .= " WHERE is_active = 1";
            $sql .= " ORDER BY sort_order ASC";
            $result = $conn->query($sql);
            $plans = [];
            while ($row = $result->fetch_assoc()) {
                $row['features'] = json_decode($row['features'] ?? '[]', true);
                $row['price_php'] = (float)$row['price_php'];
                $row['price_usd'] = (float)$row['price_usd'];
                $row['id'] = (int)$row['id'];
                $row['duration_value'] = (int)$row['duration_value'];
                $row['speed_limit_mbps'] = $row['speed_limit_mbps'] ? (int)$row['speed_limit_mbps'] : null;
                $row['is_trial'] = (bool)$row['is_trial'];
                $row['is_active'] = (bool)$row['is_active'];
                $row['is_recommended'] = (bool)$row['is_recommended'];
                $row['sort_order'] = (int)$row['sort_order'];
                $plans[] = $row;
            }
            json_response(['success' => true, 'plans' => $plans]);
        }
        break;

    case 'POST':
        $data = get_json_body();
        
        if (empty($data['name'])) json_error('Plan name is required');
        
        // Generate slug from name
        $slug = $data['slug'] ?? strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim($data['name'])));
        
        // Check for duplicate slug
        $check = $conn->prepare("SELECT id FROM subscription_plans WHERE slug = ?");
        $check->bind_param('s', $slug);
        $check->execute();
        if ($check->get_result()->fetch_assoc()) {
            json_error('A plan with this slug already exists');
        }
        
        $name = $data['name'];
        $duration_type = $data['duration_type'] ?? 'month';
        $duration_value = (int)($data['duration_value'] ?? 1);
        $price_php = (float)($data['price_php'] ?? 0);
        $price_usd = (float)($data['price_usd'] ?? 0);
        $speed = isset($data['speed_limit_mbps']) && $data['speed_limit_mbps'] !== '' ? (int)$data['speed_limit_mbps'] : null;
        $description = $data['description'] ?? '';
        $features = json_encode($data['features'] ?? []);
        $is_trial = (int)($data['is_trial'] ?? 0);
        $is_active = (int)($data['is_active'] ?? 1);
        $is_recommended = (int)($data['is_recommended'] ?? 0);
        $sort_order = (int)($data['sort_order'] ?? 0);
        
        $stmt = $conn->prepare("INSERT INTO subscription_plans (slug, name, duration_type, duration_value, price_php, price_usd, speed_limit_mbps, description, features, is_trial, is_active, is_recommended, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('sssiddissiii', $slug, $name, $duration_type, $duration_value, $price_php, $price_usd, $speed, $description, $features, $is_trial, $is_active, $is_recommended, $sort_order);
        
        if ($stmt->execute()) {
            json_response(['success' => true, 'message' => 'Plan created', 'id' => $conn->insert_id], 201);
        } else {
            json_error('Failed to create plan: ' . $conn->error);
        }
        break;

    case 'PUT':
        if (!$id) json_error('Plan ID is required');
        $data = get_json_body();
        
        // Verify plan exists
        $check = $conn->prepare("SELECT id FROM subscription_plans WHERE id = ?");
        $check->bind_param('i', $id);
        $check->execute();
        if (!$check->get_result()->fetch_assoc()) {
            json_error('Plan not found', 404);
        }
        
        // Build dynamic UPDATE
        $fields = [];
        $types = '';
        $values = [];
        
        $allowed = [
            'name'            => 's',
            'slug'            => 's',
            'duration_type'   => 's',
            'duration_value'  => 'i',
            'price_php'       => 'd',
            'price_usd'      => 'd',
            'speed_limit_mbps'=> 'i',
            'description'     => 's',
            'is_trial'        => 'i',
            'is_active'       => 'i',
            'is_recommended'  => 'i',
            'sort_order'      => 'i',
        ];
        
        foreach ($allowed as $field => $type) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = ?";
                $types .= $type;
                $val = $data[$field];
                if ($field === 'speed_limit_mbps' && ($val === '' || $val === null)) $val = null;
                $values[] = $val;
            }
        }
        
        if (isset($data['features'])) {
            $fields[] = "features = ?";
            $types .= 's';
            $values[] = json_encode($data['features']);
        }
        
        if (empty($fields)) json_error('No fields to update');
        
        $types .= 'i';
        $values[] = $id;
        
        $sql = "UPDATE subscription_plans SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$values);
        
        if ($stmt->execute()) {
            json_response(['success' => true, 'message' => 'Plan updated']);
        } else {
            json_error('Failed to update plan: ' . $conn->error);
        }
        break;

    case 'DELETE':
        if (!$id) json_error('Plan ID is required');
        
        // Don't allow deleting if subscribers are using this plan
        $check = $conn->prepare("SELECT sp.slug FROM subscription_plans sp WHERE sp.id = ?");
        $check->bind_param('i', $id);
        $check->execute();
        $plan = $check->get_result()->fetch_assoc();
        if (!$plan) json_error('Plan not found', 404);
        
        $sub_check = $conn->prepare("SELECT COUNT(*) as cnt FROM subscribers WHERE plan = ?");
        $sub_check->bind_param('s', $plan['slug']);
        $sub_check->execute();
        $count = $sub_check->get_result()->fetch_assoc()['cnt'];
        
        if ($count > 0) {
            // Soft delete - deactivate instead
            $stmt = $conn->prepare("UPDATE subscription_plans SET is_active = 0 WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            json_response(['success' => true, 'message' => "Plan deactivated (has {$count} active subscriber(s))"]);
        } else {
            $stmt = $conn->prepare("DELETE FROM subscription_plans WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            json_response(['success' => true, 'message' => 'Plan deleted']);
        }
        break;

    default:
        json_error('Method not allowed', 405);
}
