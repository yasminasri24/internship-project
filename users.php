<?php
header("Content-Type: application/json");
include "db.php";

function getUsernameById($conn, $userId) {
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $stmt->close();
        return $row['username'];
    }
    $stmt->close();
    return 'N/A';
}

/*
|--------------------------------------------------------------------------
| ADMIN ACTIONS (SUSPEND / ACTIVATE)
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['action']) || !isset($data['user_id'])) {
        echo json_encode(["success" => false, "message" => "Missing input"]);
        exit;
    }

    $userId = intval($data['user_id']);
    $action = $data['action'];
    $adminId = isset($data['admin_id']) ? intval($data['admin_id']) : 0;

    // suspended
    if ($action === 'suspend') {
        $newStatus = 'suspended';
    } elseif ($action === 'activate') {
        $newStatus = 'active';
    } elseif ($action === 'delete') {
        // Handle delete action
        $newStatus = 'deleted'; // Placeholder, logic below handles deletion
    } else {
        echo json_encode(["success" => false, "message" => "Invalid action"]);
        exit;
    }

    if ($action === 'delete') {
        $conn->begin_transaction();
        try {
        // Get username before deleting for logging purposes
        $targetUsername = getUsernameById($conn, $userId);

        // Now, log the delete action
        if ($adminId > 0) {
            $logAction = 'remove';
            $newStatus = 'deleted';
            $logStmt = $conn->prepare("INSERT INTO user_moderation_logs (user_id, admin_id, action, resulting_status, target_name) VALUES (?, ?, ?, ?, ?)");
            $logStmt->bind_param("iisss", $userId, $adminId, $logAction, $newStatus, $targetUsername);
            $logStmt->execute();
            $logStmt->close();
        }
        // Get groups the user is in to check for empty groups later
        $userGroups = [];
        $stmtGroups = $conn->prepare("SELECT group_id FROM group_members WHERE user_id = ?");
        $stmtGroups->bind_param("i", $userId);
        $stmtGroups->execute();
        $resGroups = $stmtGroups->get_result();
        while ($row = $resGroups->fetch_assoc()) {
            $userGroups[] = $row['group_id'];
        }
        $stmtGroups->close();

        // Delete related data first to avoid foreign key constraints
        $delMembers = $conn->prepare("DELETE FROM group_members WHERE user_id = ?");
        $delMembers->bind_param("i", $userId);
        $delMembers->execute();
        $delMembers->close();

        // Remove empty groups
        foreach ($userGroups as $groupId) {
            $checkMembers = $conn->prepare("SELECT COUNT(*) as count FROM group_members WHERE group_id = ?");
            $checkMembers->bind_param("i", $groupId);
            $checkMembers->execute();
            $resCount = $checkMembers->get_result();
            $count = $resCount->fetch_assoc()['count'];
            $checkMembers->close();

            if ($count == 0) {
                $delAllGroupMsgs = $conn->prepare("DELETE FROM group_messages WHERE group_id = ?");
                $delAllGroupMsgs->bind_param("i", $groupId);
                $delAllGroupMsgs->execute();
                $delAllGroupMsgs->close();

                $delGroup = $conn->prepare("DELETE FROM groups WHERE id = ?");
                $delGroup->bind_param("i", $groupId);
                $delGroup->execute();
                $delGroup->close();
            }
        }

        $delGroupMsgs = $conn->prepare("DELETE FROM group_messages WHERE sender_id = ?");
        $delGroupMsgs->bind_param("i", $userId);
        $delGroupMsgs->execute();
        $delGroupMsgs->close();

        $delMsgs = $conn->prepare("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?");
        $delMsgs->bind_param("ii", $userId, $userId);
        $delMsgs->execute();
        $delMsgs->close();

        $delUser = $conn->prepare("DELETE FROM users WHERE id = ?");
        $delUser->bind_param("i", $userId);
        $delUser->execute();
        $delUser->close();

        $conn->commit();
        echo json_encode(["success" => true, "message" => "Action successful"]);
        exit;
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    } elseif ($action === 'suspend') {
        $reason = isset($data['reason']) ? $data['reason'] : null;
        $duration = isset($data['duration']) ? intval($data['duration']) : 0;
        
        if ($duration > 0) {
            $endDate = date('Y-m-d H:i:s', strtotime("+$duration days"));
        } else {
            $endDate = null;
        }

        $stmt = $conn->prepare("INSERT INTO user_status_details (user_id, status, suspension_reason, suspension_end_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), suspension_reason = VALUES(suspension_reason), suspension_end_date = VALUES(suspension_end_date)");
        $stmt->bind_param("isss", $userId, $newStatus, $reason, $endDate);

        if ($adminId > 0) {
            $targetUsername = getUsernameById($conn, $userId);
            $logAction = 'suspend';
            $logStmt = $conn->prepare("INSERT INTO user_moderation_logs (user_id, admin_id, action, resulting_status, reason, target_name) VALUES (?, ?, ?, ?, ?, ?)");
            $logStmt->bind_param("iissss", $userId, $adminId, $logAction, $newStatus, $reason, $targetUsername);
            $logStmt->execute();
            $logStmt->close();
        }
    } elseif ($action === 'activate') {
        $stmt = $conn->prepare("INSERT INTO user_status_details (user_id, status, suspension_reason, suspension_end_date) VALUES (?, ?, NULL, NULL) ON DUPLICATE KEY UPDATE status = VALUES(status), suspension_reason = NULL, suspension_end_date = NULL");
        $stmt->bind_param("is", $userId, $newStatus);

        if ($adminId > 0) {
            $targetUsername = getUsernameById($conn, $userId);
            $logAction = 'unsuspend';
            $logStmt = $conn->prepare("INSERT INTO user_moderation_logs (user_id, admin_id, action, resulting_status, reason, target_name) VALUES (?, ?, ?, ?, NULL, ?)");
            $logStmt->bind_param("iisss", $userId, $adminId, $logAction, $newStatus, $targetUsername);
            $logStmt->execute();
            $logStmt->close();
        }
    }

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Action successful"]);
    } else {
        echo json_encode(["success" => false, "message" => "Database error: " . $stmt->error]);
    }
    exit;
}

/*
|--------------------------------------------------------------------------
| FETCH MODERATION LOGS
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === "GET" && isset($_GET['fetch_logs']) && isset($_GET['user_id'])) {
    $userId = intval($_GET['user_id']);
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 15;
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $offset = ($page - 1) * $limit;

    // Get total count for pagination
    $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM user_moderation_logs WHERE user_id = ?");
    $countStmt->bind_param("i", $userId);
    $countStmt->execute();
    $totalLogs = $countStmt->get_result()->fetch_assoc()['total'];
    $countStmt->close();
    
    $stmt = $conn->prepare("
        SELECT l.action, l.resulting_status, l.reason, l.created_at, u.username as admin_name
        FROM user_moderation_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->bind_param("iii", $userId, $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
    }
    $stmt->close();

    $has_more = ($offset + count($logs)) < $totalLogs;
    
    echo json_encode(["success" => true, "logs" => $logs, "has_more" => $has_more, "total" => $totalLogs]);
    exit;
}

/*
|--------------------------------------------------------------------------
| FETCH RECENT USERS (DASHBOARD)
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === "GET" && isset($_GET['fetch_recent_users'])) {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 5;
    
    $stmt = $conn->prepare("
        SELECT id, username, created_at
        FROM users u
        WHERE role = 'user'
        ORDER BY created_at DESC
        LIMIT ?
    ");
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode(["success" => true, "users" => $users]);
    exit;
}

/*
|--------------------------------------------------------------------------
| FETCH RECENT GLOBAL LOGS (DASHBOARD)
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === "GET" && isset($_GET['fetch_recent_logs'])) {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 5;
    
    $stmt = $conn->prepare("
        SELECT l.action, l.resulting_status, l.reason, l.created_at, 
               u_admin.username as admin_name, COALESCE(u_target.username, l.target_name, 'N/A') as target_name
        FROM user_moderation_logs l
        LEFT JOIN users u_admin ON l.admin_id = u_admin.id
        LEFT JOIN users u_target ON l.user_id = u_target.id
        ORDER BY l.created_at DESC
        LIMIT ?
    ");
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
    }
    
    echo json_encode(["success" => true, "logs" => $logs]);
    exit;
}

/*
|--------------------------------------------------------------------------
| SUPERADMIN MODE
| URL: users.php?admin=1
|--------------------------------------------------------------------------
| Returns all users with role & status
*/
if ($_SERVER['REQUEST_METHOD'] === "GET" && isset($_GET['admin'])) {

    $result = $conn->query("
        SELECT u.id, u.username, u.role, COALESCE(s.status, 'active') as status, s.suspension_reason, s.suspension_end_date, u.created_at
        FROM users u
        LEFT JOIN user_status_details s ON u.id = s.user_id
        WHERE u.role = 'user'
        ORDER BY u.id ASC
    ");

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    echo json_encode([
        "success" => true,
        "users" => $users
    ]);

    exit; // IMPORTANT: stop here
}

/*
|--------------------------------------------------------------------------
| NORMAL USER MODE (CHAT / GROUP FEATURE)
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === "GET") {

    if (!isset($_GET['id'])) {
        echo json_encode([
            "success" => false,
            "message" => "Missing id"
        ]);
        exit;
    }

    $id = intval($_GET['id']);
    $group_id = isset($_GET['group_id']) ? intval($_GET['group_id']) : null;

    try {

        if ($group_id) {
            // Case 1: Add members to existing group
            $stmt = $conn->prepare("
                SELECT u.id, u.username
                FROM users u
                WHERE u.id != ?
                AND u.id NOT IN (
                    SELECT gm.user_id
                    FROM group_members gm
                    WHERE gm.group_id = ?
                )
            ");
            $stmt->bind_param("ii", $id, $group_id);
        } else {
            // Case 2: Normal contact list
            $stmt = $conn->prepare("
                SELECT u.id, u.username
                FROM users u
                WHERE u.id != ?
            ");
            $stmt->bind_param("i", $id);
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        echo json_encode([
            "success" => true,
            "users" => $users
        ]);

        $stmt->close();
        $conn->close();

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "message" => "Error: " . $e->getMessage()
        ]);
    }

} else {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
}
?>
