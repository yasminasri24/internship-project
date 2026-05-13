<?php
header("Content-Type: application/json");
include "db.php";

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // -------------------- GET MEMBERS --------------------
    case "GET":
        if (!isset($_GET['group_id'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "group_id required"]);
            exit;
        }

        $group_id = (int)$_GET['group_id'];

        $sql = "SELECT u.id, u.username, u.created_at, gm.role
                FROM group_members gm
                INNER JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = ?
                ORDER BY FIELD(gm.role,'Admin','Member'), u.username";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => $conn->error]);
            exit;
        }
        $stmt->bind_param("i", $group_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $members = [];
        while ($row = $result->fetch_assoc()) $members[] = $row;

        echo json_encode(["success" => true, "group_id" => $group_id, "members" => $members]);
        break;

    // -------------------- ADD MEMBERS --------------------
    case "POST":
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !isset($data['group_id'], $data['user_ids'], $data['logged_in_user'])) {
            echo json_encode(["success" => false, "error" => "group_id, user_ids, and logged_in_user required"]);
            exit;
        }

        $group_id = intval($data['group_id']);
        $loggedInid = intval($data['logged_in_user']);
        $addedUsers = [];
        $errors = [];

        // check admin
        $adminCheck = $conn->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
        $adminCheck->bind_param("ii", $group_id, $loggedInid);
        $adminCheck->execute();
        $role = $adminCheck->get_result()->fetch_assoc()['role'] ?? 'Member';
        if ($role !== 'Admin') {
            echo json_encode(["success" => false, "error" => "Only admins can add members"]);
            exit;
        }

        foreach ($data['user_ids'] as $user_id) {
            $user_id = intval($user_id);
            if ($user_id === $loggedInid) {
                $errors[] = "Cannot add yourself";
                continue;
            }

            $check = $conn->prepare("SELECT id FROM group_members WHERE group_id=? AND user_id=?");
            $check->bind_param("ii", $group_id, $user_id);
            $check->execute();
            if ($check->get_result()->num_rows > 0) {
                $errors[] = "User $user_id already in group";
                continue;
            }

            $stmt = $conn->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'Member')");
            $stmt->bind_param("ii", $group_id, $user_id);
            if ($stmt->execute()) $addedUsers[] = $user_id;
            else $errors[] = "Failed to add user $user_id: " . $conn->error;
        }

        echo json_encode(["success" => count($addedUsers) > 0, "added" => $addedUsers, "errors" => $errors]);
        break;

    // -------------------- TOGGLE ROLE --------------------
    case "PUT":
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !isset($data['group_id'], $data['user_id'], $data['logged_in_user'])) {
            echo json_encode(["success" => false, "error" => "group_id, user_id, and logged_in_user required"]);
            exit;
        }

        $group_id = intval($data['group_id']);
        $user_id = intval($data['user_id']);
        $loggedInid = intval($data['logged_in_user']);

        // Cannot toggle self
        if ($user_id === $loggedInid) {
            echo json_encode(["success" => false, "error" => "Cannot toggle your own role"]);
            exit;
        }

        // Only admins can toggle
        $adminCheck = $conn->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
        $adminCheck->bind_param("ii", $group_id, $loggedInid);
        $adminCheck->execute();
        $currentRole = $adminCheck->get_result()->fetch_assoc()['role'] ?? 'Member';
        if ($currentRole !== 'Admin') {
            echo json_encode(["success" => false, "error" => "Only admins can toggle roles"]);
            exit;
        }

        // Fetch target user
        $check = $conn->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
        $check->bind_param("ii", $group_id, $user_id);
        $check->execute();
        $result = $check->get_result();
        if ($result->num_rows === 0) {
            echo json_encode(["success" => false, "error" => "User not in group"]);
            exit;
        }
        $targetRole = $result->fetch_assoc()['role'];

        // If demoting admin, ensure at least 1 admin remains
        if ($targetRole === 'Admin') {
            $adminCountRes = $conn->prepare("SELECT COUNT(*) as total FROM group_members WHERE group_id=? AND role='Admin'");
            $adminCountRes->bind_param("i", $group_id);
            $adminCountRes->execute();
            $adminCount = $adminCountRes->get_result()->fetch_assoc()['total'];
            if ($adminCount <= 1) {
                echo json_encode(["success" => false, "error" => "At least one admin must remain"]);
                exit;
            }
        }

        // Toggle role
        $newRole = $targetRole === 'Admin' ? 'Member' : 'Admin';
        $stmt = $conn->prepare("UPDATE group_members SET role=? WHERE group_id=? AND user_id=?");
        $stmt->bind_param("sii", $newRole, $group_id, $user_id);

        if ($stmt->execute()) {
            echo json_encode(["success" => true, "user_id" => $user_id, "new_role" => $newRole]);
        } else {
            echo json_encode(["success" => false, "error" => $conn->error]);
        }
        break;

    // -------------------- REMOVE MEMBERS / EXIT --------------------
    case "DELETE":
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !isset($data['group_id'], $data['user_ids'], $data['logged_in_user'])) {
            echo json_encode(["success" => false, "error" => "group_id, user_ids, and logged_in_user required"]);
            exit;
        }

        $group_id = intval($data['group_id']);
        $loggedInid = intval($data['logged_in_user']);
        $removedUsers = [];
        $errors = [];

        foreach ($data['user_ids'] as $user_id) {
            $user_id = intval($user_id);

            // Check last admin if exiting
            $checkRole = $conn->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
            $checkRole->bind_param("ii", $group_id, $user_id);
            $checkRole->execute();
            $roleRow = $checkRole->get_result()->fetch_assoc();
            $role = $roleRow['role'] ?? null;

            if ($role === 'Admin') {
                $adminCountRes = $conn->prepare("SELECT COUNT(*) as total FROM group_members WHERE group_id=? AND role='Admin'");
                $adminCountRes->bind_param("i", $group_id);
                $adminCountRes->execute();
                $adminCount = $adminCountRes->get_result()->fetch_assoc()['total'];
                if ($adminCount <= 1) {
                    $errors[] = "Cannot remove last admin";
                    continue;
                }
            }

            $stmt = $conn->prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?");
            $stmt->bind_param("ii", $group_id, $user_id);
            if ($stmt->execute()) $removedUsers[] = $user_id;
            else $errors[] = "Failed to remove user $user_id: " . $conn->error;
        }

        echo json_encode(["success" => count($removedUsers) > 0, "removed" => $removedUsers, "errors" => $errors]);
        break;

    default:
        http_response_code(405);
        echo json_encode(["success" => false, "message" => "Method not allowed"]);
}
?>
