<?php
header("Content-Type: application/json");
include "db.php";

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    // -------------------- GET MESSAGES (with pagination) --------------------
    case "GET":
        if (!isset($_GET['group_id'])) {
            echo json_encode(["error" => "Missing group_id"]);
            exit;
        }

        $group_id = intval($_GET['group_id']);
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
        $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

        // ✅ validate limit/offset (avoid crazy values)
        if ($limit <= 0 || $limit > 100) $limit = 20;
        if ($offset < 0) $offset = 0;

        // Group info
        $group_sql = "SELECT group_name FROM groups WHERE id = ?";
        $stmt = $conn->prepare($group_sql);
        $stmt->bind_param("i", $group_id);
        $stmt->execute();
        $stmt->bind_result($group_name);
        if (!$stmt->fetch()) {
            echo json_encode(["error" => "Group not found"]);
            $stmt->close();
            exit;
        }
        $stmt->close();

        // Messages with pagination
        $msg_sql = "
            SELECT gm.id, gm.group_id, gm.message, gm.created_at, 
                   u.id AS sender_id, u.username AS sender_name
            FROM group_messages gm
            JOIN users u ON gm.sender_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.created_at ASC
            LIMIT ? OFFSET ?
        ";
        $msg_stmt = $conn->prepare($msg_sql);
        $msg_stmt->bind_param("iii", $group_id, $limit, $offset);
        $msg_stmt->execute();
        $result = $msg_stmt->get_result();

        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }
        $msg_stmt->close();

        // ✅ also count total messages
        $count_sql = "SELECT COUNT(*) as total FROM group_messages WHERE group_id=?";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param("i", $group_id);
        $count_stmt->execute();
        $count_stmt->bind_result($totalMessages);
        $count_stmt->fetch();
        $count_stmt->close();

        echo json_encode([
            "group_name" => $group_name,
            "total_messages" => $totalMessages,
            "limit" => $limit,
            "offset" => $offset,
            "messages" => $messages
        ]);
        break;

    // -------------------- SEND MESSAGE --------------------
    case "POST":
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !isset($data['group_id'], $data['sender_id'], $data['message'])) {
            echo json_encode(["error" => "Invalid input"]);
            exit;
        }

        $group = intval($data['group_id']);
        $sender = intval($data['sender_id']);
        $message = $conn->real_escape_string($data['message']);

        $sql = "INSERT INTO group_messages (group_id, sender_id, message) VALUES ($group, $sender, '$message')";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true, "message" => "Message sent"]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
}
$conn->close();
?>
