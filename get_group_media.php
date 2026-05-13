<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once "db.php";

$group_id = (int) ($_GET['group_id'] ?? 0);

if (!$group_id) {
    echo json_encode(["success" => false, "error" => "Invalid group_id"]);
    exit;
}

$sql = "
SELECT
  gm.id AS message_id,
  gm.sender_id,
  u.username AS sender_name,
  gm.message,
  gm.created_at,
  gmed.id AS media_id,
  gmed.media_path,
  gmed.media_type,
  gmed.action AS media_action,
  gmed.screening_result,
  gmed.screened_at
FROM group_messages gm
LEFT JOIN group_media gmed ON gm.media_id = gmed.id
JOIN users u ON gm.sender_id = u.id
WHERE gm.group_id = ?
ORDER BY gm.created_at ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $group_id);
$stmt->execute();
$res = $stmt->get_result();

$baseURL = getBaseURL();
$chat = [];

while ($row = $res->fetch_assoc()) {

    $media = null;

    if (!empty($row['media_id'])) {

        $screening = $row['screening_result']
            ? json_decode($row['screening_result'], true)
            : null;

        $action = $row['media_action'] ?? ($screening['action'] ?? 'allow');
        $relativePath = ltrim($row['media_path'], '/');
        $absolutePath = realpath(__DIR__ . '/' . $relativePath);
        $exists = $absolutePath && file_exists($absolutePath);

        $media = [
            "id" => (int) $row['media_id'], // <-- rename media_id → id
            "type" => $row['media_type'],
            "action" => $action,
            "uri" => ($action === "block" || !$exists)
                ? null
                : getBaseURL() . $relativePath
        ];

    }

    $chat[] = [
        "id" => (int) $row['message_id'],
        "sender_id" => (int) $row['sender_id'],
        "sender_name" => $row['sender_name'],
        "message" => $row['message'],
        "created_at" => $row['created_at'],
        "media" => $media
    ];
}

echo json_encode(["success" => true, "chat" => $chat]);
