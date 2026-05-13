<?php

function getBaseURL(): string {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    return $protocol . "://" . $host . "/simplechat/";
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
if (!isset($_FILES['file'], $_POST['sender_id'], $_POST['group_id'])) {
    echo json_encode(["success" => false, "error" => "Invalid request"]);
    exit;
}

$sender_id = (int) $_POST['sender_id'];
$group_id  = (int) $_POST['group_id'];
$file      = $_FILES['file'];

/* ================= MIME ================= */
$mimeType = mime_content_type($file['tmp_name']);

$allowedImage = ["image/jpeg", "image/png", "image/jpg"];
$allowedVideo = ["video/mp4", "video/quicktime"];

if (in_array($mimeType, $allowedImage)) {
    $fileType = "image";
    $cleanDir   = "uploadsGroup/clean/images/";
    $flaggedDir = "uploadsGroup/flagged/images/";
    $blockedDir = "uploadsGroup/blocked/images/";
} elseif (in_array($mimeType, $allowedVideo)) {
    $fileType = "video";
    $cleanDir   = "uploadsGroup/clean/videos/";
    $flaggedDir = "uploadsGroup/flagged/videos/";
    $blockedDir = "uploadsGroup/blocked/videos/";
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

/* ================= INSERT GROUP MEDIA ================= */
$stmt = $conn->prepare("
  INSERT INTO group_media
  (group_id, sender_id, media_path, media_type, screening_result, created_at)
  VALUES (?, ?, ?, ?, NULL, NOW())
");
$stmt->bind_param("iiss", $group_id, $sender_id, $relativePath, $fileType);
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

if (!empty($result['is_flagged'])) {
    $action = $result['action'];
    $newDir = $action === "blur" ? $flaggedDir : $blockedDir;

    if ($action !== "allow") {
        $newAbsolute = __DIR__ . "/" . $newDir . $filename;
        rename($absolutePath, $newAbsolute);
        $relativePath = $newDir . $filename;
    }
}

/* ================= UPDATE GROUP MEDIA ================= */
$update = $conn->prepare("
  UPDATE group_media
  SET screening_result = ?, screened_at = NOW(), media_path = ?
  WHERE id = ?
");
$update->bind_param("ssi", json_encode($result), $relativePath, $mediaId);
$update->execute();

/* ================= INSERT GROUP MESSAGE ================= */
$msg = $conn->prepare("
  INSERT INTO group_messages
  (group_id, sender_id, message, media_id, created_at)
  VALUES (?, ?, '', ?, NOW())
");
$msg->bind_param("iii", $group_id, $sender_id, $mediaId);
$msg->execute();

echo json_encode([
    "success" => true,
    "media_id" => $mediaId,
    "action" => $action,
    "media_url" => $action === "block" ? null : getBaseURL() . $relativePath
]);
