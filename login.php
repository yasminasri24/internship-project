<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

include 'db.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['username']) || !isset($data['password'])) {
    echo json_encode(["success" => false, "message" => "Missing username or password"]);
    exit;
}

$username = $data['username'];
$password = $data['password'];

// Updated query: JOIN user_status_details to get the 'status' column
$stmt = $conn->prepare("
    SELECT u.id, u.password, u.role, s.status, s.suspension_reason, s.suspension_end_date
    FROM users u 
    LEFT JOIN user_status_details s ON u.id = s.user_id 
    WHERE u.username = ?
");

if (!$stmt) {
    echo json_encode(["success" => false, "message" => "Database error: " . $conn->error]);
    exit;
}

$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    if (password_verify($password, $user['password'])) {
        
        // Check if user is suspended or blocked
        if ($user['status'] === 'suspended') {
             // Check if suspension has expired
             if ($user['suspension_end_date'] && strtotime($user['suspension_end_date']) < time()) {
                 // Auto-lift suspension
                 $liftStmt = $conn->prepare("UPDATE user_status_details SET status = 'active', suspension_reason = NULL, suspension_end_date = NULL WHERE user_id = ?");
                 $liftStmt->bind_param("i", $user['id']);
                 $liftStmt->execute();
                 $liftStmt->close();
                 // Allow login to proceed
                 $user['status'] = 'active';
             } else {
             echo json_encode([
                 "success" => false, 
                 "status" => "suspended",
                 "message" => "Your account is suspended.",
                 "reason" => $user['suspension_reason'],
                 "end_date" => $user['suspension_end_date']
                ]);
             exit;
             }
        }
        if ($user['status'] === 'blocked') {
             echo json_encode(["success" => false, "message" => "Your account is blocked."]);
             exit;
        }

        echo json_encode([
            "success" => true, 
            "user" => [
                "id" => $user['id'],
                "username" => $username,
                "role" => $user['role'],
                "status" => $user['status'] ?? 'active' // Default to active if record missing
            ]
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Invalid password"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "User not found"]);
}

$stmt->close();
$conn->close();
?>
