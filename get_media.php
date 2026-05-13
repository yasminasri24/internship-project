<?php

function getBaseURL(): string {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    return $protocol . "://" . $host . $scriptDir . "/";
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once "db.php";

$sender = (int) ($_GET['sender_id'] ?? 0);
$receiver = (int) ($_GET['receiver_id'] ?? 0);

if (!$sender || !$receiver) {
    echo json_encode(["success" => false, "error" => "Invalid params"]);
    exit;
}

$sql = "
SELECT
  m.id AS message_id,
  m.sender_id,
  m.receiver_id,
  m.message,
  m.created_at,
  mm.id AS media_id,
  mm.file_path,
  mm.file_type,
  mm.action,
  mm.screening_result,
  mm.screened_at
FROM messages m
LEFT JOIN message_media mm ON m.media_id = mm.id
WHERE
  (m.sender_id = ? AND m.receiver_id = ?)
   OR
  (m.sender_id = ? AND m.receiver_id = ?)
ORDER BY m.created_at ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("iiii", $sender, $receiver, $receiver, $sender);
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

        $flagReason = $screening['category'] ?? null;
        $relativePath = ltrim($row['file_path'], '/');
        $absolutePath = __DIR__ . '/' . $relativePath;
        $exists = file_exists($absolutePath);

        $media = [
            "media_id" => (int) $row['media_id'],
            "type" => $row['file_type'],
            "action" => $row['action'],
            "blocked" => $row['action'] === "block" || !$exists,
            "flag_reason" => $flagReason,
            "screened_at" => $row['screened_at'],
            "uri" => ($row['action'] === "block" || !$exists)
                ? null
                : $baseURL . $relativePath
        ];
    }

    $chat[] = [
        "id" => (int) $row['message_id'],
        "sender_id" => (int) $row['sender_id'],
        "receiver_id" => (int) $row['receiver_id'],
        "message" => $row['message'],
        "created_at" => $row['created_at'],
        "media" => $media
    ];
}

echo json_encode(["success" => true, "chat" => $chat]);
