<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

// 1. Check Database Connection
$db_status = "Down";
$db_latency = 0;
$msgs_per_min = 0;
$avg_msg_size = 0;
try {
    $start = microtime(true);
    // Suppress errors to handle them gracefully
    $conn = @new mysqli("localhost", "root", "", "chatkita");
    if ($conn->connect_error) {
        $db_status = "Down";
    } else {
        if ($conn->query("SELECT 1")) {
            $db_status = "OK";
            $db_latency = round((microtime(true) - $start) * 1000);

            // Calculate Msgs/Min (Count messages in last 1 minute)
            $res = $conn->query("
                SELECT 
                    (SELECT COUNT(*) FROM messages WHERE created_at >= NOW() - INTERVAL 1 MINUTE) +
                    (SELECT COUNT(*) FROM group_messages WHERE created_at >= NOW() - INTERVAL 1 MINUTE) as count
            ");
            if ($res && $row = $res->fetch_assoc()) {
                $msgs_per_min = intval($row['count']);
            }

            // Calculate Avg Msg Size (Average length of message text in bytes)
            $res = $conn->query("
                SELECT 
                    (SELECT SUM(LENGTH(message)) FROM messages) as len1,
                    (SELECT COUNT(*) FROM messages) as count1,
                    (SELECT SUM(LENGTH(message)) FROM group_messages) as len2,
                    (SELECT COUNT(*) FROM group_messages) as count2
            ");
            if ($res && $row = $res->fetch_assoc()) {
                $total_len = intval($row['len1']) + intval($row['len2']);
                $total_count = intval($row['count1']) + intval($row['count2']);
                if ($total_count > 0) {
                    $avg_msg_size = round($total_len / $total_count);
                }
            }
        }
        $conn->close();
    }
} catch (Exception $e) {
    $db_status = "Down";
}

// 2. System Stats (CPU & Memory for Windows/XAMPP)
$cpu_usage = 0;
$memory_usage = 0;

if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    // Get CPU Load
    // This command gets the load percentage of the CPU
    @exec("wmic cpu get loadpercentage", $cpu_output);
    if (isset($cpu_output[1])) {
        $cpu_usage = intval($cpu_output[1]);
    }

    // Get Memory Usage
    // This command gets Free and Total memory
    @exec("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value", $mem_output);
    $mem_info = [];
    foreach ($mem_output as $line) {
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line);
            $mem_info[trim($key)] = trim($val);
        }
    }
    
    if (isset($mem_info['TotalVisibleMemorySize']) && isset($mem_info['FreePhysicalMemory'])) {
        $total = intval($mem_info['TotalVisibleMemorySize']);
        $free = intval($mem_info['FreePhysicalMemory']);
        $used = $total - $free;
        if ($total > 0) {
            $memory_usage = round(($used / $total) * 100);
        }
    }
} else {
    // Fallback for non-Windows (Linux servers)
    $load = sys_getloadavg();
    $cpu_usage = isset($load[0]) ? $load[0] * 100 : 0;
}

// 3. Disk Usage
$disk_total = disk_total_space(".");
$disk_free = disk_free_space(".");
$disk_usage = ($disk_total > 0) ? round((($disk_total - $disk_free) / $disk_total) * 100) : 0;

echo json_encode([
    "success" => true,
    "backend" => "Connected",
    "database" => $db_status,
    "db_latency" => $db_latency,
    "cpu" => $cpu_usage,
    "memory" => $memory_usage,
    "disk" => $disk_usage,
    "msgs_per_min" => $msgs_per_min,
    "avg_msg_size" => $avg_msg_size
]);
?>