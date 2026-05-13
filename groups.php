<?php
header("Content-Type: application/json");
include "db.php";

$method = $_SERVER['REQUEST_METHOD'];

switch($method){

    // -------------------- GET GROUPS --------------------
    case "GET":
        if(isset($_GET['group_id'])){
            $group_id = intval($_GET['group_id']);
            $sql = "SELECT g.id, g.group_name, g.created_at, g.created_by, u.username AS created_by_username
                    FROM groups g
                    INNER JOIN users u ON g.created_by = u.id
                    WHERE g.id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $group_id);
            $stmt->execute();
            $result = $stmt->get_result();
            if($row = $result->fetch_assoc()){
                echo json_encode(["success"=>true,"group_id"=>$row['id'],"group_name"=>$row['group_name'],
                    "created_by"=>$row['created_by'],"created_by_username"=>$row['created_by_username'],
                    "created_at"=>$row['created_at']]);
            }else{
                echo json_encode(["success"=>false,"message"=>"Group not found"]);
            }
        } elseif(isset($_GET['user_id'])){
            $user_id = intval($_GET['user_id']);
            $sql = "SELECT g.id, g.group_name, g.created_at, u.username AS created_by_username
                    FROM groups g
                    INNER JOIN group_members gm ON g.id = gm.group_id
                    INNER JOIN users u ON g.created_by = u.id
                    WHERE gm.user_id = ?
                    ORDER BY g.created_at DESC";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $groups = [];
            while($row = $result->fetch_assoc()) $groups[] = $row;
            echo json_encode(["success"=>true,"groups"=>$groups]);
        } else{
            http_response_code(400);
            echo json_encode(["success"=>false,"message"=>"Provide group_id or user_id"]);
        }
        break;

    // -------------------- CREATE GROUP --------------------
    case "POST":
        $data=json_decode(file_get_contents("php://input"),true);
        if(!$data || !isset($data['group_name'],$data['created_by'])){
            http_response_code(400); echo json_encode(["success"=>false,"message"=>"group_name and created_by required"]); exit;
        }

        $group_name=trim($data['group_name']);
        $created_by=intval($data['created_by']);
        $other_users=$data['members'] ?? [];

        if($group_name===''){ http_response_code(400); echo json_encode(["success"=>false,"message"=>"Group name cannot be empty"]); exit; }

        $conn->begin_transaction();
        try{
            $stmt=$conn->prepare("INSERT INTO `groups` (`group_name`,`created_by`) VALUES (?,?)");
            $stmt->bind_param("si",$group_name,$created_by);
            $stmt->execute();
            $group_id=$stmt->insert_id; $stmt->close();

            $stmt2=$conn->prepare("INSERT INTO `group_members` (`group_id`,`user_id`,`role`) VALUES (?,?, 'Admin')");
            $stmt2->bind_param("ii",$group_id,$created_by);
            $stmt2->execute(); $stmt2->close();

            if(empty($other_users)){ $conn->rollback(); http_response_code(400); echo json_encode(["success"=>false,"message"=>"You must add at least one other member"]); exit; }

            foreach($other_users as $uid){
                $stmt3=$conn->prepare("INSERT INTO `group_members` (`group_id`,`user_id`,`role`) VALUES (?,?, 'Member')");
                $stmt3->bind_param("ii",$group_id,$uid); $stmt3->execute(); $stmt3->close();
            }

            $conn->commit();
            echo json_encode(["success"=>true,"group_id"=>$group_id,"group_name"=>$group_name,"created_by"=>$created_by]);
        }catch(Exception $e){ $conn->rollback(); http_response_code(500); echo json_encode(["success"=>false,"message"=>$e->getMessage()]); }
        break;

    // -------------------- DELETE GROUP --------------------
    case "DELETE":
    $data=json_decode(file_get_contents("php://input"),true);
    if(!$data || !isset($data['group_id'], $data['logged_in_user'])){
        echo json_encode(["success"=>false,"message"=>"group_id and logged_in_user required"]); 
        exit;
    }

    $group_id = intval($data['group_id']);
    $loggedInid = intval($data['logged_in_user']);

    // Check if the logged-in user is admin
    $stmtCheck = $conn->prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=?");
    $stmtCheck->bind_param("ii", $group_id, $loggedInid);
    $stmtCheck->execute();
    $roleRow = $stmtCheck->get_result()->fetch_assoc();
    $role = $roleRow['role'] ?? null;

    if ($role !== 'Admin') {
        echo json_encode(["success"=>false,"message"=>"Only admins can delete the group"]);
        exit;
    }

    $conn->begin_transaction();
    try{
        $conn->query("DELETE FROM group_messages WHERE group_id=$group_id");
        $conn->query("DELETE FROM group_members WHERE group_id=$group_id");
        $conn->query("DELETE FROM groups WHERE id=$group_id");
        $conn->commit();
        echo json_encode(["success"=>true,"message"=>"Group deleted"]);
    }catch(Exception $e){ 
        $conn->rollback(); 
        echo json_encode(["success"=>false,"message"=>$e->getMessage()]); 
    }
    break;

    default:
        http_response_code(405); echo json_encode(["success"=>false,"message"=>"Method not allowed"]);
}
$conn->close();
?>
