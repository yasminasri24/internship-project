<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include "db.php";

/*
|--------------------------------------------------------------------------
| POST: SUBMIT REPORT (User/Content Reporting)
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Optional: Debug logging
    // file_put_contents("report_debug.txt", file_get_contents("php://input"));

    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data) {
        echo json_encode(["success" => false, "error" => "Invalid JSON input"]);
        exit();
    }

    /* ---------- FIELDS ---------- */
    $chat_type         = $data["chat_type"] ?? "";
    $report_type       = $data["report_type"] ?? "";
    $reason            = trim($data["reason"] ?? "");

    $reporter_id       = (int)($data["reporter_id"] ?? 0);
    $reported_user_id  = (int)($data["reported_user_id"] ?? 0);

    $private_media_id  = isset($data["private_media_id"]) ? (int)$data["private_media_id"] : null;
    $group_media_id    = isset($data["group_media_id"]) ? (int)$data["group_media_id"] : null;

    $private_chat_id   = isset($data["private_chat_id"]) ? (int)$data["private_chat_id"] : null;
    $group_id          = isset($data["group_id"]) ? (int)$data["group_id"] : null;

    /* ---------- BASIC VALIDATION ---------- */
    if (
        !$chat_type ||
        !$report_type ||
        !$reason ||
        $reporter_id <= 0 ||
        $reported_user_id <= 0
    ) {
        echo json_encode(["success" => false, "error" => "Missing required fields"]);
        exit();
    }

    /* ---------- VALIDATE CHAT TYPE ---------- */
    if (!in_array($chat_type, ["private", "group"])) {
        echo json_encode(["success" => false, "error" => "Invalid chat_type"]);
        exit();
    }

    /* ---------- USER EXISTS ---------- */
    $checkUser = $conn->prepare("SELECT id FROM users WHERE id = ?");
    $checkUser->bind_param("i", $reporter_id);
    $checkUser->execute();
    $checkUser->store_result();
    if ($checkUser->num_rows === 0) {
        echo json_encode(["success" => false, "error" => "Reporter does not exist"]);
        exit();
    }
    $checkUser->close();

    /* ---------- CHAT CONTEXT VALIDATION ---------- */
    if ($chat_type === "group") {

        if (!$group_id) {
            echo json_encode(["success" => false, "error" => "group_id required"]);
            exit();
        }

        $checkGroup = $conn->prepare("SELECT id FROM `groups` WHERE id = ?");
        $checkGroup->bind_param("i", $group_id);
        $checkGroup->execute();
        $checkGroup->store_result();

        if ($checkGroup->num_rows === 0) {
            echo json_encode(["success" => false, "error" => "Group does not exist"]);
            exit();
        }
        $checkGroup->close();

    } else {

        if (!$private_chat_id) {
            echo json_encode(["success" => false, "error" => "private_chat_id required"]);
            exit();
        }
    }

    /* ---------- MEDIA VALIDATION ---------- */
    if (in_array($report_type, ["image", "video"])) {

        if ($chat_type === "group") {

            if (!$group_media_id) {
                echo json_encode(["success" => false, "error" => "group_media_id required"]);
                exit();
            }

            $check = $conn->prepare(
                "SELECT id FROM group_media WHERE id = ?"
            );
            $check->bind_param("i", $group_media_id);

        } else {

            if (!$private_media_id) {
                echo json_encode(["success" => false, "error" => "private_media_id required"]);
                exit();
            }

            $check = $conn->prepare(
                "SELECT id FROM message_media WHERE id = ?"
            );
            $check->bind_param("i", $private_media_id);
        }

        $check->execute();
        $check->store_result();

        if ($check->num_rows === 0) {
            echo json_encode(["success" => false, "error" => "Media not found"]);
            exit();
        }

        $check->close();
    }

    /* ---------- INSERT REPORT ---------- */
    $stmt = $conn->prepare("
        INSERT INTO reports
        (
            chat_type,
            reporter_id,
            reported_user_id,
            private_media_id,
            group_media_id,
            private_chat_id,
            group_id,
            report_type,
            reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->bind_param(
        "siiiiiiss",
        $chat_type,
        $reporter_id,
        $reported_user_id,
        $private_media_id,
        $group_media_id,
        $private_chat_id,
        $group_id,
        $report_type,
        $reason
    );

    /* ---------- EXECUTE ---------- */
    if (!$stmt->execute()) {
        echo json_encode(["success" => false, "error" => $stmt->error]);
        exit();
    }

    $report_id = $stmt->insert_id;
    $stmt->close();

    /* ---------- FLAG MEDIA & MOVE FILE ---------- */
    if (in_array($report_type, ["image", "video"])) {

        if ($chat_type === "group" && $group_media_id) {
            // get current path
            $q = $conn->prepare("SELECT media_path FROM group_media WHERE id = ?");
            $q->bind_param("i", $group_media_id);
            $q->execute();
            $q->bind_result($currentPath);
            if ($q->fetch()) {
                $absCurrent = __DIR__ . '/' . $currentPath;
                $newPath = str_replace('clean/', 'flagged/', $currentPath);
                $absNew = __DIR__ . '/' . $newPath;
                if (file_exists($absCurrent)) {
                    if (!is_dir(dirname($absNew))) mkdir(dirname($absNew), 0777, true);
                    rename($absCurrent, $absNew);
                    $currentPath = $newPath; // update DB with new path
                }
            }
            $q->close();

            // update DB
            $upd = $conn->prepare("UPDATE group_media SET action = 'flagged', media_path = ?, screened_at = NOW() WHERE id = ?");
            $upd->bind_param("si", $currentPath, $group_media_id);
            $upd->execute();
            $upd->close();
        }

        if ($chat_type === "private" && $private_media_id) {
            $q = $conn->prepare("SELECT file_path FROM message_media WHERE id = ?");
            $q->bind_param("i", $private_media_id);
            $q->execute();
            $q->bind_result($currentPath);
            if ($q->fetch()) {
                $absCurrent = __DIR__ . '/' . $currentPath;
                $newPath = str_replace('clean/', 'flagged/', $currentPath);
                $absNew = __DIR__ . '/' . $newPath;
                if (file_exists($absCurrent)) {
                    if (!is_dir(dirname($absNew))) mkdir(dirname($absNew), 0777, true);
                    rename($absCurrent, $absNew);
                    $currentPath = $newPath;
                }
            }
            $q->close();

            $upd = $conn->prepare("UPDATE message_media SET action = 'flagged', file_path = ?, screened_at = NOW() WHERE id = ?");
            $upd->bind_param("si", $currentPath, $private_media_id);
            $upd->execute();
            $upd->close();
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Report submitted successfully",
        "report_id" => $report_id
    ]);
    exit();
}

/*
|--------------------------------------------------------------------------
| GET: ANALYTICS REPORTS
|--------------------------------------------------------------------------
*/
$type = isset($_GET['type']) ? $_GET['type'] : '';
$range = isset($_GET['range']) ? $_GET['range'] : 'daily';

// Helper function to process query results and fill gaps for date-based reports
function get_report_data($conn, $query, $num_points, $date_format, $interval_unit, $start_date = null) {
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        // Return an empty array on failure to prevent frontend errors
        return array_fill(0, $num_points, 0);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $db_data = [];
    while ($row = $result->fetch_assoc()) {
        $db_data[$row['report_period']] = (int)$row['count'];
    }
    $stmt->close();

    $data = [];
    for ($i = 0; $i < $num_points; $i++) {
        $date_key = '';
        $offset = $num_points - 1 - $i;
        if ($start_date && $interval_unit === 'day') {
            $date_key = date($date_format, strtotime("$start_date +$i days"));
        } elseif ($interval_unit === 'day') {
            $date_key = date($date_format, strtotime("-$offset days"));
        } elseif ($interval_unit === 'week') {
            $ts = strtotime("-$offset weeks");
            if ($date_format === 'Y-m-d') {
                $w = date('w', $ts);
                $ts -= $w * 86400;
            }
            $date_key = date($date_format, $ts);
        } elseif ($interval_unit === 'month') {
            $date_key = date($date_format, strtotime("-$offset months"));
        }
        $data[$i] = isset($db_data[$date_key]) ? $db_data[$date_key] : 0;
    }
    return $data;
}

if ($type === 'messages') {
    $query = '';
    $num_points = 0;
    $date_format = '';
    $interval_unit = '';
    $start_date = null;

    if ($range === 'daily') {
        $num_points = 7;
        $date_format = 'Y-m-d';
        $interval_unit = 'day';
        $w = date('w');
        $start_date = date('Y-m-d', strtotime("-$w days"));
        $query = "
            SELECT report_date as report_period, SUM(c) as count FROM (
                SELECT DATE(created_at) as report_date, COUNT(*) as c FROM messages WHERE created_at >= '$start_date 00:00:00' GROUP BY report_date
                UNION ALL
                SELECT DATE(created_at) as report_date, COUNT(*) as c FROM group_messages WHERE created_at >= '$start_date 00:00:00' GROUP BY report_date
            ) as combined_messages
            GROUP BY report_period
        ";
    } elseif ($range === 'weekly') {
        $num_points = 4;
        $date_format = 'Y-m-d';
        $interval_unit = 'week';
        $query = "
            SELECT report_week as report_period, SUM(c) as count FROM (
                SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d') as report_week, COUNT(*) as c FROM messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) GROUP BY report_week
                UNION ALL
                SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d') as report_week, COUNT(*) as c FROM group_messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) GROUP BY report_week
            ) as combined_messages
            GROUP BY report_period
        ";
    } elseif ($range === 'monthly') {
        $num_points = 6;
        $date_format = 'Y-m';
        $interval_unit = 'month';
        $query = "
            SELECT report_month as report_period, SUM(c) as count FROM (
                SELECT DATE_FORMAT(created_at, '%Y-%m') as report_month, COUNT(*) as c FROM messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY report_month
                UNION ALL
                SELECT DATE_FORMAT(created_at, '%Y-%m') as report_month, COUNT(*) as c FROM group_messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY report_month
            ) as combined_messages
            GROUP BY report_period
        ";
    }

    $data = get_report_data($conn, $query, $num_points, $date_format, $interval_unit, $start_date);
    echo json_encode(["success" => true, "data" => $data]);

} elseif ($type === 'users') {
    $query = '';
    $num_points = 0;
    $date_format = '';
    $interval_unit = '';
    $start_date = null;

    if ($range === 'daily') {
        $num_points = 7;
        $date_format = 'Y-m-d';
        $interval_unit = 'day';
        $w = date('w');
        $start_date = date('Y-m-d', strtotime("-$w days"));
        $query = "SELECT DATE(created_at) as report_period, COUNT(*) as count FROM users WHERE created_at >= '$start_date 00:00:00' GROUP BY report_period";
    } elseif ($range === 'weekly') {
        $num_points = 4;
        $date_format = 'Y-m-d';
        $interval_unit = 'week';
        $query = "SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d') as report_period, COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) GROUP BY report_period";
    } elseif ($range === 'monthly') {
        $num_points = 6;
        $date_format = 'Y-m';
        $interval_unit = 'month';
        $query = "SELECT DATE_FORMAT(created_at, '%Y-%m') as report_period, COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY report_period";
    }
    
    $data = get_report_data($conn, $query, $num_points, $date_format, $interval_unit, $start_date);
    echo json_encode(["success" => true, "data" => $data]);

} elseif ($type === 'screenings') {
    // Count of media items processed by AI (where screening_result is not null)
    $query = '';
    $num_points = 0;
    $date_format = '';
    $interval_unit = '';
    $interval_sql = '';
    $start_date = null;

    if ($range === 'daily') {
        $num_points = 7; $date_format = 'Y-m-d'; $interval_unit = 'day';
        $w = date('w');
        $start_date = date('Y-m-d', strtotime("-$w days"));
        $interval_sql = "AND created_at >= '$start_date 00:00:00'";
        $query = "SELECT report_period, SUM(count) as count FROM (
            SELECT DATE(created_at) as report_period, COUNT(*) as count FROM group_media WHERE screening_result IS NOT NULL AND created_at >= '$start_date 00:00:00' GROUP BY report_period
            UNION ALL
            SELECT DATE(created_at) as report_period, COUNT(*) as count FROM message_media WHERE screening_result IS NOT NULL AND created_at >= '$start_date 00:00:00' GROUP BY report_period
        ) as combined GROUP BY report_period";
    } elseif ($range === 'weekly') {
        $num_points = 4; $date_format = 'Y-m-d'; $interval_unit = 'week';
        $interval_sql = "AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)";
        $query = "SELECT report_period, SUM(count) as count FROM (
            SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d') as report_period, COUNT(*) as count FROM group_media WHERE screening_result IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) GROUP BY report_period
            UNION ALL
            SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d') as report_period, COUNT(*) as count FROM message_media WHERE screening_result IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) GROUP BY report_period
        ) as combined GROUP BY report_period";
    } elseif ($range === 'monthly') {
        $num_points = 6; $date_format = 'Y-m'; $interval_unit = 'month';
        $interval_sql = "AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)";
        $query = "SELECT report_period, SUM(count) as count FROM (
            SELECT DATE_FORMAT(created_at, '%Y-%m') as report_period, COUNT(*) as count FROM group_media WHERE screening_result IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY report_period
            UNION ALL
            SELECT DATE_FORMAT(created_at, '%Y-%m') as report_period, COUNT(*) as count FROM message_media WHERE screening_result IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY report_period
        ) as combined GROUP BY report_period";
    }
    
    // Calculate Passed vs Flagged stats for the Pie Chart
    $stats_sql = "SELECT SUM(passed) as passed, SUM(flagged) as flagged FROM (
        SELECT 
            SUM(CASE WHEN screening_result LIKE '%\"action\":\"allow\"%' THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN screening_result LIKE '%\"action\":\"blur\"%' OR screening_result LIKE '%\"action\":\"block\"%' OR action = 'flagged' THEN 1 ELSE 0 END) as flagged
        FROM group_media 
        WHERE screening_result IS NOT NULL $interval_sql
        UNION ALL
        SELECT 
            SUM(CASE WHEN screening_result LIKE '%\"action\":\"allow\"%' THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN screening_result LIKE '%\"action\":\"blur\"%' OR screening_result LIKE '%\"action\":\"block\"%' OR action = 'flagged' THEN 1 ELSE 0 END) as flagged
        FROM message_media 
        WHERE screening_result IS NOT NULL $interval_sql
    ) as combined_stats";
    
    $stats_res = $conn->query($stats_sql);
    $stats = $stats_res ? $stats_res->fetch_assoc() : ['passed' => 0, 'flagged' => 0];

    $data = get_report_data($conn, $query, $num_points, $date_format, $interval_unit, $start_date);
    echo json_encode(["success" => true, "data" => $data, "stats" => $stats]);

} elseif ($type === 'violations') {
    // Breakdown of violations by type (Spam, Offensive, Harassment)
    // We map the 'reason' or 'report_type' to these categories for the chart
    $interval_sql = "";
    $group_sql = "";
    $start_date = null;
    
    if ($range === 'daily') {
        $w = date('w');
        $start_date = date('Y-m-d', strtotime("-$w days"));
        $interval_sql = "AND created_at >= '$start_date 00:00:00'";
        $group_sql = "DATE(created_at)";
        $num_points = 7; $date_format = 'Y-m-d'; $interval_unit = 'day';
    } elseif ($range === 'weekly') {
        $interval_sql = "AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)";
        $group_sql = "DATE_FORMAT(DATE_SUB(created_at, INTERVAL DAYOFWEEK(created_at)-1 DAY), '%Y-%m-%d')";
        $num_points = 4; $date_format = 'Y-m-d'; $interval_unit = 'week';
    } elseif ($range === 'monthly') {
        $interval_sql = "AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)";
        $group_sql = "DATE_FORMAT(created_at, '%Y-%m')";
        $num_points = 6; $date_format = 'Y-m'; $interval_unit = 'month';
    }

    // We fetch raw counts grouped by date and type, then format in PHP
    // Use a subquery to categorize each report exactly once to avoid double counting
    $sql = "SELECT $group_sql as period,
            SUM(CASE WHEN final_category = 'spam' THEN 1 ELSE 0 END) as spam,
            SUM(CASE WHEN final_category = 'offensive' THEN 1 ELSE 0 END) as offensive,
            SUM(CASE WHEN final_category = 'harassment' THEN 1 ELSE 0 END) as harassment
            FROM (
                SELECT created_at,
                CASE
                    WHEN reason LIKE '%spam%' OR reason LIKE '%scam%' OR reason LIKE '%fraud%' OR reason LIKE '%impersonation%' OR reason LIKE '%false%' THEN 'spam'
                    WHEN reason LIKE '%offensive%' OR reason LIKE '%inappropriate%' OR reason LIKE '%nudity%' OR reason LIKE '%sexual%' OR reason LIKE '%violence%' THEN 'offensive'
                    WHEN reason LIKE '%harassment%' OR reason LIKE '%bully%' OR reason LIKE '%hate%' THEN 'harassment'
                    WHEN report_type IN ('image', 'video') THEN 'offensive'
                    WHEN report_type = 'user' THEN 'harassment'
                    ELSE 'spam'
                END as final_category
                FROM reports
                WHERE 1=1 $interval_sql

                UNION ALL

                SELECT created_at, 'offensive' as final_category
                FROM group_media
                WHERE screening_result IS NOT NULL AND action != 'allow' $interval_sql

                UNION ALL

                SELECT created_at, 'offensive' as final_category
                FROM message_media
                WHERE screening_result IS NOT NULL AND action != 'allow' $interval_sql
            ) as categorized
            GROUP BY period";
            
    $result = $conn->query($sql);
    $raw_data = [];
    while($row = $result->fetch_assoc()) {
        $raw_data[$row['period']] = $row;
    }

    // Fill gaps
    $final_data = [];
    for ($i = 0; $i < $num_points; $i++) {
        $offset = $num_points - 1 - $i;
        if ($start_date && $interval_unit === 'day') {
            $key = date($date_format, strtotime("$start_date +$i days"));
        } elseif ($interval_unit === 'day') {
            $key = date($date_format, strtotime("-$offset days"));
        } elseif ($interval_unit === 'week') {
            $ts = strtotime("-$offset weeks");
            if ($date_format === 'Y-m-d') { $w = date('w', $ts); $ts -= $w * 86400; }
            $key = date($date_format, $ts);
        } else {
            $key = date($date_format, strtotime("-$offset months"));
        }
        
        $entry = isset($raw_data[$key]) ? $raw_data[$key] : ['spam' => 0, 'offensive' => 0, 'harassment' => 0];
        $final_data[] = [
            'label' => $key, // Frontend will format this
            'spam' => (int)$entry['spam'],
            'offensive' => (int)$entry['offensive'],
            'harassment' => (int)$entry['harassment']
        ];
    }
    echo json_encode(["success" => true, "data" => $final_data]);

} elseif ($type === 'top_violators') {
    // Top 5 users with most reports against them in the range
    $interval_sql = "";
    if ($range === 'daily') {
        $w = date('w');
        $start_date = date('Y-m-d', strtotime("-$w days"));
        $interval_sql = "AND all_violations.created_at >= '$start_date 00:00:00'";
    }
    elseif ($range === 'weekly') $interval_sql = "AND all_violations.created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)";
    elseif ($range === 'monthly') $interval_sql = "AND all_violations.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)";

    // 1. Get Top 5 User IDs
    $union_query = "
        SELECT reported_user_id as user_id, created_at FROM reports
        UNION ALL
        SELECT sender_id as user_id, created_at FROM group_media WHERE screening_result IS NOT NULL AND action != 'allow'
        UNION ALL
        SELECT sender_id as user_id, created_at FROM message_media WHERE screening_result IS NOT NULL AND action != 'allow'
    ";
    
    $top_sql = "SELECT user_id, COUNT(*) as violationCount 
                FROM ($union_query) as all_violations 
                WHERE 1=1 $interval_sql 
                GROUP BY user_id 
                ORDER BY violationCount DESC 
                LIMIT 5";
                
    $top_res = $conn->query($top_sql);
    $top_users = [];
    $user_ids = [];
    while($row = $top_res->fetch_assoc()) {
        $uid = (int)$row['user_id'];
        $top_users[$uid] = [
            'id' => $uid,
            'violationCount' => (int)$row['violationCount'],
            'name' => 'Unknown',
            'mostFrequentType' => 'Spam' // Default
        ];
        $user_ids[] = $uid;
    }
    
    if (!empty($user_ids)) {
        $ids_str = implode(',', $user_ids);
        
        // 2. Get Names
        $name_sql = "SELECT id, username FROM users WHERE id IN ($ids_str)";
        $name_res = $conn->query($name_sql);
        while($row = $name_res->fetch_assoc()) {
            if(isset($top_users[$row['id']])) {
                $top_users[$row['id']]['name'] = $row['username'];
            }
        }
        
        // 3. Get Violation Types breakdown
        $type_union = "
            SELECT reported_user_id as user_id, created_at,
            CASE
                WHEN reason LIKE '%spam%' OR reason LIKE '%scam%' OR reason LIKE '%fraud%' OR reason LIKE '%impersonation%' OR reason LIKE '%false%' THEN 'Spam'
                WHEN reason LIKE '%offensive%' OR reason LIKE '%inappropriate%' OR reason LIKE '%nudity%' OR reason LIKE '%sexual%' OR reason LIKE '%violence%' THEN 'Offensive'
                WHEN reason LIKE '%harassment%' OR reason LIKE '%bully%' OR reason LIKE '%hate%' THEN 'Harassment'
                WHEN report_type IN ('image', 'video') THEN 'Offensive'
                WHEN report_type = 'user' THEN 'Harassment'
                ELSE 'Spam'
            END as v_type
            FROM reports
            UNION ALL
            SELECT sender_id as user_id, created_at, 'Offensive' as v_type FROM group_media WHERE screening_result IS NOT NULL AND action != 'allow'
            UNION ALL
            SELECT sender_id as user_id, created_at, 'Offensive' as v_type FROM message_media WHERE screening_result IS NOT NULL AND action != 'allow'
        ";
        
        $type_sql = "SELECT user_id, v_type, COUNT(*) as cnt 
                     FROM ($type_union) as t 
                     WHERE user_id IN ($ids_str) " . str_replace('all_violations.', 't.', $interval_sql) . "
                     GROUP BY user_id, v_type";
                     
        $type_res = $conn->query($type_sql);
        $user_types = [];
        while($row = $type_res->fetch_assoc()) {
            $uid = $row['user_id'];
            if(!isset($user_types[$uid])) $user_types[$uid] = [];
            $user_types[$uid][$row['v_type']] = (int)$row['cnt'];
        }
        
        foreach($top_users as $uid => &$u_data) {
            if(isset($user_types[$uid])) {
                $max_c = 0;
                $max_t = 'Spam';
                foreach($user_types[$uid] as $t => $c) {
                    if($c > $max_c) {
                        $max_c = $c;
                        $max_t = $t;
                    }
                }
                $u_data['mostFrequentType'] = $max_t;
            }
        }
    }
    
    $data = array_values($top_users);
    usort($data, function($a, $b) { return $b['violationCount'] - $a['violationCount']; });
    
    echo json_encode(["success" => true, "data" => $data]);

} else {
    // Default: Fetch list of recent reports (for dashboard/admin view)
    // Join with users to get names, and media tables for screening results
    $sql = "
        SELECT r.*, 
               u1.username as reporter_name, 
               u2.username as reported_user_name,
               gm.screening_result as group_screening,
               mm.screening_result as private_screening
        FROM reports r
        LEFT JOIN users u1 ON r.reporter_id = u1.id
        LEFT JOIN users u2 ON r.reported_user_id = u2.id
        LEFT JOIN group_media gm ON r.group_media_id = gm.id
        LEFT JOIN message_media mm ON r.private_media_id = mm.id
        ORDER BY r.created_at DESC
        LIMIT 50
    ";
    $result = $conn->query($sql);
    $reports = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) { $reports[] = $row; }
    }
    echo json_encode(["success" => true, "reports" => $reports]);
}

$conn->close();
?>