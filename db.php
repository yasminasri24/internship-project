<?php
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "chatkita";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}

if (!function_exists('getBaseURL')) {
    function getBaseURL(): string {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'];
        $scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
        return $protocol . "://" . $host . $scriptDir . "/";
    }
}
?>
