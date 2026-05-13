<?php

function getBaseURL(): string {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    return $protocol . "://" . $host . $scriptDir . "/";
}

ini_set('display_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once "db.php";
require_once __DIR__ . "/media_screening/MediaScreeningService.php";

/* ================= VALIDATION ================= */
if (
    !isset($_FILES['file'], $_POST['sender_id'], $_POST['receiver_id'])
) {
    echo json_encode(["success" => false, "error" => "Invalid request"]);
    exit;
}

$sender_id   = (int) $_POST['sender_id'];
$receiver_id = (int) $_POST['receiver_id'];
$file        = $_FILES['file'];

/* ================= MIME ================= */
$mimeType = mime_content_type($file['tmp_name']);

$allowedImage = ["image/jpeg", "image/png", "image/jpg"];
$allowedVideo = ["video/mp4", "video/quicktime"];

if (in_array($mimeType, $allowedImage)) {
    $fileType = "image";
    $cleanDir = "uploadsPrivate/clean/images/";
    $flaggedDir = "uploadsPrivate/flagged/images/";
    $blockedDir = "uploadsPrivate/blocked/images/";
} elseif (in_array($mimeType, $allowedVideo)) {
    $fileType = "video";
    $cleanDir = "uploadsPrivate/clean/videos/";
    $flaggedDir = "uploadsPrivate/flagged/videos/";
    $blockedDir = "uploadsPrivate/blocked/videos/";
} else {
    echo json_encode(["success" => false, "error" => "Unsupported file"]);
    exit;
}

/* ================= DIR ================= */
foreach ([$cleanDir, $flaggedDir, $blockedDir] as $dir) {
    $abs = __DIR__ . "/" . $dir;
    if (!is_dir($abs)) mkdir($abs, 0777, true);
}

/* ================= MOVE ================= */
$filename = uniqid("media_", true) . "_" . basename($file['name']);
$absolutePath = __DIR__ . "/" . $cleanDir . $filename;
$relativePath = $cleanDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
    echo json_encode(["success" => false, "error" => "Upload failed"]);
    exit;
}

/* ================= INSERT MEDIA ================= */
$stmt = $conn->prepare("
  INSERT INTO message_media
  (sender_id, file_path, file_type, action, created_at)
  VALUES (?, ?, ?, 'allow', NOW())
");
$stmt->bind_param("iss", $sender_id, $relativePath, $fileType);
$stmt->execute();

if ($stmt->affected_rows === 0) {
    echo json_encode(["success" => false, "error" => "Media DB insert failed"]);
    exit;
}

$mediaId = $stmt->insert_id;

/* ================= SCREEN ================= */
$screening = new MediaScreeningService();
$result = $screening->screen([
    "name" => $file['name'],
    "path" => $absolutePath,
    "type" => $fileType
]);

$action = "allow";
$reason = null;

if (!empty($result['is_flagged'])) {
    $action = $result['action'];
    $reason = $result['category'] ?? null;

    $newDir = $action === "blur" ? $flaggedDir : $blockedDir;
    if ($action !== "allow") {
        $newAbsolute = __DIR__ . "/" . $newDir . $filename;
        rename($absolutePath, $newAbsolute);
        $relativePath = $newDir . $filename;
    }
}


file_put_contents(
  __DIR__ . "/screening_debug.log",
  json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL,
  FILE_APPEND
);


/* ================= UPDATE MEDIA ================= */
$update = $conn->prepare("
  UPDATE message_media
  SET action = ?, screening_result = ?, screened_at = NOW(), file_path = ?
  WHERE id = ?
");
$update->bind_param("sssi", $action, json_encode($result), $relativePath, $mediaId);
$update->execute();

/* ================= INSERT MESSAGE ================= */
$msg = $conn->prepare("
  INSERT INTO messages
  (sender_id, receiver_id, message, media_id, created_at)
  VALUES (?, ?, '', ?, NOW())
");
$msg->bind_param("iii", $sender_id, $receiver_id, $mediaId);
$msg->execute();

echo json_encode([
    "success" => true,
    "media_id" => $mediaId,
    "action" => $action,
    "media_url" => $action === "block" ? null : getBaseURL() . $relativePath
]);
