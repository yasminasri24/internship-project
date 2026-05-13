// app/groupinfo.tsx
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { API_BASE_URL } from "../lib/apiConfig";

// -------------------- Navigation Types --------------------
type RootStackParamList = {
  groupchat: { id: number };
  groupinfo: { id: number };
};

type GroupInfoRouteProp = RouteProp<RootStackParamList, "groupinfo">;
type GroupInfoNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "groupinfo"
>;

// -------------------- Interfaces --------------------
interface Member {
  id: number;
  username: string;
  role: "Admin" | "Member";
  created_at: string;
}

interface User {
  id: number;
  username: string;
}

interface GroupMemberResponse {
  success: boolean;
  members?: Member[];
  errors?: string[];
  added?: number[];
  new_role?: "Admin" | "Member";
}

interface UsersResponse {
  success?: boolean;
  users?: User[];
  errors?: string[];
}


// -------------------- Constants --------------------
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Hardcoded light mode colors
const BG_COLOR = "#FFFFFF";
const TEXT_COLOR = "#000000";
const TINT_COLOR = "#007AFF";
const BORDER_COLOR = "#CCCCCC";
const PLACEHOLDER_COLOR = "#A0A0A0";

// -------------------- Component --------------------
export default function GroupInfo() {
  const route = useRoute<GroupInfoRouteProp>();
  const navigation = useNavigation<GroupInfoNavigationProp>();
  const GROUP_ID = route.params.id;

  const [userId, setUserId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingMembersRef = useRef(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const slideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];
  const insets = useSafeAreaInsets();

  // -------------------- Load userId --------------------
  useEffect(() => {
    const loadUserId = async () => {
      const stored = await AsyncStorage.getItem("userID");
      if (stored) setUserId(parseInt(stored, 10));
    };
    loadUserId();
  }, []);

  // -------------------- Fetch Members --------------------
  const fetchMembers = async () => {
    if (isFetchingMembersRef.current) return;
    isFetchingMembersRef.current = true;

    try {
      setError(null);

      const res = await axios.get<GroupMemberResponse>(
        `${API_BASE_URL}/group_member.php`,
        { params: { group_id: GROUP_ID } }
      );

      const data = res.data;

      if (data.success && Array.isArray(data.members)) {
        const uniqueMembers: Record<number, Member> = {};
        data.members.forEach((m) => (uniqueMembers[m.id] = m));

        let membersList = Object.values(uniqueMembers);

        membersList.sort((a, b) => {
          if (a.id === userId) return -1;
          if (b.id === userId) return 1;
          if (a.role === "Admin" && b.role !== "Admin") return -1;
          if (a.role !== "Admin" && b.role === "Admin") return 1;
          return a.username.localeCompare(b.username);
        });

        setMembers(membersList);
      } else {
        setMembers([]);
      }
    } catch (err: any) {
      console.error("Fetch members error:", err);
      setError(err?.message || "Error fetching members");
    } finally {
      isFetchingMembersRef.current = false;
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
      const interval = setInterval(fetchMembers, 5000);
      return () => clearInterval(interval);
    }, [])
  );

  // -------------------- Fetch All Users --------------------
  const fetchAllUsers = async () => {
    try {
      const res = await axios.get<UsersResponse>(
        `${API_BASE_URL}/users.php`,
        { params: { id: userId, group_id: GROUP_ID } }
      );

      setAllUsers(Array.isArray(res.data.users) ? res.data.users : []);
    } catch (err) {
      console.error(err);
      setAllUsers([]);
    }
  };

  const openAddMemberModal = () => {
    fetchAllUsers();
    setSelectedUsers([]);
    setSearch("");
    setShowAddModal(true);
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT * 0.3,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closeAddMemberModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start(() => setShowAddModal(false));
  };

  const toggleSelectUser = (id: number) => {
    if (members.some((m) => m.id === id) || id === userId) return;
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const addSelectedUsers = async () => {
    if (!userId) return;

    if (selectedUsers.length === 0) {
      Alert.alert("No user selected", "Please select at least one user.");
      return;
    }

    try {
      const res = await axios.post<GroupMemberResponse>(
        `${API_BASE_URL}/group_member.php`,
        {
          group_id: GROUP_ID,
          user_ids: selectedUsers,
          logged_in_user: userId,
        }
      );

      const data = res.data;

      if (data.success) {
        Alert.alert("Success", `Added ${data.added?.length ?? 0} user(s)!`);
        closeAddMemberModal();
        fetchMembers();
      } else {
        Alert.alert("Error", data.errors?.join("\n") || "Failed to add users");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong.");
    }
  };

  // -------------------- Remove / Toggle Admin / Exit --------------------
  const removeMember = (memberId: number, memberName: string) => {
    const admins = members.filter((m) => m.role === "Admin");
    const targetRole = members.find((m) => m.id === memberId)?.role;

    if (targetRole === "Admin" && admins.length <= 1) {
      Alert.alert(
        "Error",
        "Cannot remove the last admin. Promote another member first."
      );
      return;
    }

    Alert.alert("Confirm Removal", `Remove ${memberName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await axios.delete<GroupMemberResponse>(
              `${API_BASE_URL}/group_member.php`,
              {
                data: {
                  group_id: GROUP_ID,
                  user_ids: [memberId],
                  logged_in_user: userId,
                },
              }
            );

            if (res.data.success) {
              Alert.alert("Success", `${memberName} removed.`);
              fetchMembers();
            } else {
              Alert.alert("Error", "Failed to remove user.");
            }
          } catch (err) {
            console.error("Remove member error:", err);
            Alert.alert("Error", "Failed to remove user.");
          }
        },
      },
    ]);
  };

  const toggleAdmin = (
    memberId: number,
    memberName: string,
    currentRole: string
  ) => {
    const admins = members.filter((m) => m.role === "Admin");

    if (currentRole === "Admin" && admins.length <= 1) {
      Alert.alert(
        "Error",
        "You cannot demote the last admin. Promote another member first."
      );
      return;
    }

    const action =
      currentRole === "Member" ? "Promote to Admin" : "Demote to Member";

    Alert.alert(action, `${action} ${memberName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const res = await axios.put<GroupMemberResponse>(
              `${API_BASE_URL}/group_member.php`,
              {
                group_id: GROUP_ID,
                user_id: memberId,
                logged_in_user: userId,
              }
            );

            if (res.data.success) {
              Alert.alert(
                "Success",
                `${memberName} is now ${res.data.new_role}.`
              );
              fetchMembers();
            } else {
              Alert.alert("Error", "Failed to update role.");
            }
          } catch (err) {
            console.error("Toggle admin error:", err);
            Alert.alert("Error", "Failed to update role.");
          }
        },
      },
    ]);
  };

  const exitGroup = async () => {
    if (!userId) return;

    try {
      const res = await axios.get<GroupMemberResponse>(
        `${API_BASE_URL}/group_member.php`,
        { params: { group_id: GROUP_ID } }
      );

      const latestMembers = Array.isArray(res.data.members)
        ? res.data.members
        : [];

      const otherAdmins = latestMembers.filter(
        (m) => m.role === "Admin" && m.id !== userId
      );
      const amIAdmin = latestMembers.some(
        (m) => m.id === userId && m.role === "Admin"
      );

      if (amIAdmin && otherAdmins.length === 0) {
        Alert.alert(
          "Error",
          "You are the last admin. Promote another member before leaving."
        );
        return;
      }

      Alert.alert("Confirm Exit", "Exit the group?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: async () => {
            try {
              const resDelete = await axios.delete<GroupMemberResponse>(
                `${API_BASE_URL}/group_member.php`,
                {
                  data: {
                    group_id: GROUP_ID,
                    user_ids: [userId],
                    logged_in_user: userId,
                  },
                }
              );

              if (resDelete.data.success) {
                Alert.alert("Success", "You have exited the group.");
                navigation.reset({
                  index: 0,
                  routes: [{ name: "home" as never }],
                });
              } else {
                Alert.alert("Error", "Failed to exit group.");
              }
            } catch (err) {
              console.error("Exit group error:", err);
              Alert.alert("Error", "Failed to exit group.");
            }
          },
        },
      ]);
    } catch (err) {
      console.error("Fetch members error before exit:", err);
      Alert.alert("Error", "Failed to verify members before exit.");
    }
  };

  const deleteGroup = async () => {
    Alert.alert("Delete Group", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await axios.delete<GroupMemberResponse>(
              `${API_BASE_URL}/groups.php`,
              {
                data: {
                  group_id: GROUP_ID,
                  logged_in_user: userId,
                },
              }
            );

            if (res.data.success) {
              Alert.alert("Success", "Group deleted.");
              navigation.reset({
                index: 0,
                routes: [{ name: "home" as never }],
              });
            } else {
              Alert.alert("Error", "Failed to delete group");
            }
          } catch (err) {
            console.error("Delete group error:", err);
            Alert.alert("Error", "Failed to delete group");
          }
        },
      },
    ]);
  };


  // -------------------- Report user --------------------

  // modal state
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const [reportTargetName, setReportTargetName] = useState<string>("");
  const [reportError, setReportError] = useState<string | null>(null);


  // list of report reasons
  const GROUP_REPORT_REASONS = [
    "Spam",
    "Harassment or hate speech",
    "Inappropriate content",
    "Scam or fraud",
    "Impersonation",
    "Other",
  ];

  // when user presses report button on group member
  const reportUser = (targetId: number, targetUsername: string) => {
    setReportTargetId(targetId);
    setReportTargetName(targetUsername);

    Alert.alert(
      "Report User",
      `Are you sure you want to report ${targetUsername}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Continue",
          style: "destructive",
          onPress: () => {
            setSelectedReason(null);
            setCustomReason("");
            setShowReasonModal(true);
          },
        },
      ]
    );
  };

  // submit report
 const submitReport = async () => {
  if (!selectedReason) {
    Alert.alert("Required", "Please select a report reason.");
    return;
  }

  if (selectedReason === "Other" && !customReason.trim()) {
    Alert.alert("Required", "Please enter your reason.");
    return;
  }

  if (!userId || !reportTargetId || !GROUP_ID) return;

  if (reportTargetId === userId) {
    Alert.alert("Not allowed", "You cannot report yourself.");
    return;
  }

  const finalReason =
    selectedReason === "Other" ? customReason.trim() : selectedReason;

    try {
      setReportError(null);

      const { data } = await axios.post<{ success: boolean; error?: string }>(
        `${API_BASE_URL}/reports.php`,
        {
          chat_type: "group",
          report_type: "user",
          reporter_id: userId,
          reported_user_id: reportTargetId,
          group_id: GROUP_ID,
          reason: finalReason,
        }
      );

      if (data.success) {
      Alert.alert(
        "Report Submitted",
        "Thank you. Our team will review this report."
      );
    } else {
      Alert.alert("Error", data.error || "Failed to submit report.");
    }
  } catch (err) {
    console.error("Report error:", err);
    Alert.alert("Error", "Could not submit report.");
  }

  setShowReasonModal(false);
  setSelectedReason(null);
  setCustomReason("");
  setReportTargetId(null);
};



  // -------------------- Render --------------------
  if (loading || !userId)
    return <ActivityIndicator size="large" style={{ flex: 1 }} color={TINT_COLOR} />;
  if (error)
    return <Text style={{ flex: 1, textAlign: "center", color: TEXT_COLOR }}>{error}</Text>;

  const isCurrentUserAdmin = members.some(
    (m) => m.id === userId && m.role === "Admin"
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_COLOR }}>
      <View style={{ flex: 1 }}>
        {/* Add Member Button */}
        {isCurrentUserAdmin && (
          <TouchableOpacity
            style={[styles.addMemberButton, { backgroundColor: TINT_COLOR }]}
            onPress={openAddMemberModal}
          >
            <MaterialIcons name="person-add" size={24} color={BG_COLOR} />
            <Text style={[styles.addMemberText, { color: BG_COLOR }]}>Add Member</Text>
          </TouchableOpacity>
        )}

        {/* Members List */}
        <FlatList
          data={members}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const isSelf = item.id === userId;
            const canManage = isCurrentUserAdmin && !isSelf;

            return (
              <View style={[styles.memberRow, { borderColor: BORDER_COLOR }]}>
                <Text style={[styles.memberName, { color: TEXT_COLOR }]}>
                  {item.username} {item.role === "Admin" ? "(Admin)" : ""}
                </Text>

                {canManage && (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Report User Button */}
                    <TouchableOpacity
                      style={[styles.reportButton]}
                      onPress={() => reportUser(item.id, item.username)}
                    >
                      <MaterialIcons name="report" size={20} color="#FF3B30" />
                    </TouchableOpacity>

                    {/* Admin Button */}
                    <TouchableOpacity
                      style={[styles.toggleButton, { backgroundColor: TINT_COLOR }]}
                      onPress={() =>
                        toggleAdmin(item.id, item.username, item.role)
                      }
                    >
                      <MaterialIcons
                        name={item.role === "Admin" ? "star" : "star-border"}
                        size={20}
                        color={BG_COLOR}
                      />
                    </TouchableOpacity>

                    {/* Remove Button */}
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: "#FF3B30" }]}
                      onPress={() => removeMember(item.id, item.username)}
                    >
                      <MaterialIcons name="delete" size={20} color={BG_COLOR} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Exit and Delete Buttons */}
        <TouchableOpacity style={[styles.exitButton, { backgroundColor: "#FF9500" }]} onPress={exitGroup}>
          <Text style={[styles.exitButtonText, { color: BG_COLOR }]}>Exit Group</Text>
        </TouchableOpacity>

        {isCurrentUserAdmin && (
          <TouchableOpacity
            style={[styles.exitButton, { backgroundColor: "#FF3B30" }]}
            onPress={deleteGroup}
          >
            <Text style={[styles.exitButtonText, { color: BG_COLOR }]}>Delete Group</Text>
          </TouchableOpacity>
        )}

        {/* Add Member Modal */}
        {showAddModal && (
          <Animated.View style={[styles.modalContainer, { top: slideAnim, backgroundColor: BG_COLOR }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TextInput
                  style={[styles.searchInput, { borderColor: BORDER_COLOR, color: TEXT_COLOR }]}
                  placeholder="Search users"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={search}
                  onChangeText={setSearch}
                />
                <TouchableOpacity onPress={closeAddMemberModal}>
                  <MaterialIcons name="close" size={24} color={TEXT_COLOR} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={allUsers.filter((u) =>
                  u.username.toLowerCase().includes(search.toLowerCase())
                )}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item: u }) => (
                  <TouchableOpacity
                    style={[
                      styles.userRow,
                      { borderColor: BORDER_COLOR },
                      selectedUsers.includes(u.id) && styles.userRowSelected,
                    ]}
                    onPress={() => toggleSelectUser(u.id)}
                  >
                    <Text style={{ color: TEXT_COLOR, flex: 1 }}>{u.username}</Text>
                    {selectedUsers.includes(u.id) && <MaterialIcons name="check-circle" size={20} color={TINT_COLOR} />}
                  </TouchableOpacity>
                )}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
              />

              <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: TINT_COLOR }]}
                  onPress={addSelectedUsers}
                >
                  <Text style={[styles.addButtonText, { color: BG_COLOR }]}>
                    Add Selected {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {showReasonModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Select Report Reason</Text>

              {GROUP_REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.radioRow}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={styles.radioOuter}>
                    {selectedReason === reason && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={styles.radioText}>{reason}</Text>
                </TouchableOpacity>
              ))}

              {selectedReason === "Other" && (
                <TextInput
                  placeholder="Enter your reason..."
                  value={customReason}
                  onChangeText={setCustomReason}
                  style={styles.reasonInput}
                  multiline
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowReasonModal(false)}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitBtn} onPress={submitReport}>
                  <Text style={{ color: "#fff" }}>Send Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// -------------------- Styles --------------------
const styles = StyleSheet.create({
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    marginHorizontal: 10,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
  },
  toggleButton: {
    marginRight: 10,
    padding: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  addMemberButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: TINT_COLOR,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  addMemberText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  exitButton: {
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exitButtonText: { fontSize: 16, fontWeight: "600" },
  modalContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    backgroundColor: BG_COLOR,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    borderColor: BORDER_COLOR,
    backgroundColor: "#fff",
    color: TEXT_COLOR,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginVertical: 4,
    marginHorizontal: 4,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  userRowSelected: {
    backgroundColor: "#d0ebff",
  },
  footer: {
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  addButton: {
    backgroundColor: TINT_COLOR,
    paddingVertical: 12,
    width: "80%",
    alignItems: "center",
    borderRadius: 12,
  },
  addButtonText: { color: BG_COLOR,
    fontWeight: "bold",
    fontSize: 16 },

  reportButton: {
    padding: 8,
    marginRight: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },

  //----style for report------

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0078fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0078fe"
  },
  radioText: { fontSize: 15 },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    minHeight: 60,
    textAlignVertical: "top"
  },
  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15
  },
  cancelBtn: {
    padding: 10,
    marginRight: 10
  },
  submitBtn: {
    backgroundColor: "#0078fe",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },

  rowButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },

   modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },


});
