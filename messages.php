<?php
header("Content-Type: application/json");
include "db.php";

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    // -------------------- GET PRIVATE MESSAGES --------------------
    case "GET":
        if (!isset($_GET['sender_id']) || !isset($_GET['receiver_id'])) {
            echo json_encode(["error" => "Missing sender_id or receiver_id"]);
            exit;
        }

        $sender_id   = intval($_GET['sender_id']);
        $receiver_id = intval($_GET['receiver_id']);
        $limit  = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
        $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

        if ($limit <= 0 || $limit > 100) $limit = 20;
        if ($offset < 0) $offset = 0;

        $sql = "
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at,
                   u.username AS sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        ";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param("iiiiii", $sender_id, $receiver_id, $receiver_id, $sender_id, $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();

        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }
        $stmt->close();

        echo json_encode([
            "sender_id"   => $sender_id,
            "receiver_id" => $receiver_id,
            "limit"       => $limit,
            "offset"      => $offset,
            "messages"    => $messages
        ]);
        break;

    // -------------------- SEND PRIVATE MESSAGE --------------------
    case "POST":
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !isset($data['sender_id'], $data['receiver_id'], $data['message'])) {
            echo json_encode(["success" => false, "error" => "Invalid input"]);
            exit;
        }

        $sender_id   = intval($data['sender_id']);
        $receiver_id = intval($data['receiver_id']);
        $message     = $data['message'];

        $stmt = $conn->prepare("INSERT INTO messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->bind_param("iis", $sender_id, $receiver_id, $message);

        if ($stmt->execute()) {
            echo json_encode(["success" => true, "message_id" => $stmt->insert_id]);
        } else {
            echo json_encode(["success" => false, "error" => $stmt->error]);
        }
        $stmt->close();
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
}

$conn->close();
?>

