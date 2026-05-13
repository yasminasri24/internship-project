import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SceneMap, TabBar, TabView } from "react-native-tab-view";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../lib/apiConfig";

// Types
type User = { id: number; username: string };
interface Group {
  id: number;
  group_name: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [contacts, setContacts] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentid, setCurrentid] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Create Group Modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const BASE_URL = API_BASE_URL;

  // Load logged-in user info AND fetch contacts & groups
  useEffect(() => {
    const fetchUserAndData = async () => {
      const id = await AsyncStorage.getItem("userID");
      const username = await AsyncStorage.getItem("username");
      if (id) {
        const userId = Number(id);
        setCurrentid(userId);
        await fetchUsers(userId);
        await fetchGroups(userId);
      }
      if (username) setCurrentUsername(username);
    };
    fetchUserAndData();
  }, []);

  // Fetch users
  const fetchUsers = async (id: number) => {
    try {
      const res = await axios.get(`${BASE_URL}/users.php`, { params: { id } });
      if (res.data?.success && Array.isArray(res.data.users)) {
        setContacts(res.data.users.filter((u: User) => u.id !== id));
        setContactsError(null);
      } else {
        setContacts([]);
        setContactsError("No contacts found.");
      }
    } catch (err) {
      console.error("Fetch users error:", err);
      setContacts([]);
      setContactsError("Failed to load contacts. Pull to refresh.");
    }
  };

  // Fetch groups
  const fetchGroups = async (id: number) => {
    try {
      const res = await axios.get(`${BASE_URL}/groups.php`, {
        params: { user_id: id },
      });
      if (res.data?.groups && Array.isArray(res.data.groups)) {
        setGroups(res.data.groups);
        setGroupsError(null);
      } else {
        setGroups([]);
        setGroupsError("No groups found.");
      }
    } catch (err) {
      console.error("Fetch groups error:", err);
      setGroups([]);
      setGroupsError("Failed to load groups. Pull to refresh.");
    }
  };

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (currentid === null) return;
    setRefreshing(true);
    await fetchUsers(currentid);
    await fetchGroups(currentid);
    setRefreshing(false);
  }, [currentid]);

  // Auto-refresh when screen focused
  useFocusEffect(
    useCallback(() => {
      if (!currentid) return;
      let isActive = true;
      const fetchAll = async () => {
        if (isActive) {
          await fetchUsers(currentid);
          await fetchGroups(currentid);
        }
      };
      fetchAll();
      const interval = setInterval(fetchAll, 5000);
      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [currentid])
  );

  // Logout
  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("userID");
            await AsyncStorage.removeItem("username");
            await SecureStore.deleteItemAsync("user");
            await AsyncStorage.removeItem("token"); // Clear the token
            router.replace("/auth");
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Navigate to private chat
  const navigateToChat = (id: number, username: string) => {
    router.push({
      pathname: "/[userID]",   // goes to app/[userID].tsx
      params: { userID: String(id), username },    // pass username as query param
    });
  };


  // Header profile icon
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => setShowProfile(true)}
        >
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.headerProfileImage} />
          ) : (
            <Ionicons name="person-circle-outline" size={35} color="#fff" />
          )}
        </TouchableOpacity>
      ),
    });
  }, [profilePic]);

  // Tabs
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "contacts", title: "Contacts" },
    { key: "groups", title: "Groups" },
  ]);

  // Contacts Tab
  const renderContacts = () => (
    <FlatList
      data={
        contacts.length > 0
          ? contacts
          : [{ id: 0, username: contactsError || "No contacts available." }]
      }
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) =>
        item.id === 0 ? (
          <Text style={styles.errorText}>{item.username}</Text>
        ) : (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => navigateToChat(item.id, item.username)}
          >
            <Text style={styles.userText}>{item.username}</Text>
          </TouchableOpacity>
        )
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );

  // Groups Tab
  const renderGroups = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={
          groups.length > 0
            ? groups
            : [{ id: 0, group_name: groupsError || "No groups yet. Create one!" }]
        }
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) =>
          item.id === 0 ? (
            <Text style={styles.errorText}>{item.group_name}</Text>
          ) : (
            <TouchableOpacity
              style={styles.groupItem}
              onPress={() => router.push(`/groupchat?id=${item.id}`)}
            >
              <Text style={styles.groupText}>{item.group_name}</Text>
            </TouchableOpacity>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateGroup(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );


  const renderScene = SceneMap({
    contacts: renderContacts,
    groups: renderGroups,
  });

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Please enter a group name");
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert("Please select at least one member");
      return;
    }

    try {
      const res = await axios.post(`${BASE_URL}/groups.php`, {
        group_name: groupName,
        created_by: currentid,
        members: selectedUsers,
      });

      if (res.data?.success && res.data.group_id) {
        await fetchGroups(currentid!); // refresh groups
        setShowCreateGroup(false);
        setGroupName("");
        setSelectedUsers([]);

        // 🚀 Navigate to the new group chat
        router.push(`/groupchat?id=${res.data.group_id}`);
      } else {
        Alert.alert(res.data?.message || "Failed to create group");
      }
    } catch (err) {
      console.error("Create group error:", err);
      Alert.alert("Failed to create group");
    }
  };


  // Filter contacts for search
  const filteredContacts = contacts.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      {/* Profile Modal */}
      <Modal
        transparent
        visible={showProfile}
        animationType="slide"
        onRequestClose={() => setShowProfile(false)}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.fullScreenModalBackground}>
            <View style={styles.modalContent}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.modalProfileImage} />
              ) : (
                <View style={styles.modalProfilePlaceholder}>
                  <Ionicons name="person" size={50} color="gray" />
                </View>
              )}
              <Text style={styles.profileText}>Username: {currentUsername}</Text>
              <TouchableOpacity
                style={[styles.closeButton, { marginBottom: 10 }]}
                onPress={() => setShowProfile(false)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        transparent
        visible={showCreateGroup}
        animationType="slide"
        onRequestClose={() => setShowCreateGroup(false)}
      >
        <View style={styles.fullScreenModalBackground}>
          <View style={[styles.modalContent, { width: "90%", height: "80%" }]}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
              Create Group
            </Text>
            <TextInput
              placeholder="Group name"
              value={groupName}
              onChangeText={setGroupName}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 8,
                marginBottom: 12,
                width: "100%",
              }}
            />

            {/* Search Bar */}
            <TextInput
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 8,
                marginBottom: 12,
                width: "100%",
              }}
            />

            {/* Scrollable Contact List */}
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 8,
                    backgroundColor: selectedUsers.includes(item.id.toString())
                      ? "#e0f7fa"
                      : "transparent",
                  }}
                  onPress={() => {
                    setSelectedUsers((prev) =>
                      prev.includes(item.id.toString())
                        ? prev.filter((id) => id !== item.id.toString())
                        : [...prev, item.id.toString()]
                    );
                  }}
                >
                  <Ionicons
                    name={
                      selectedUsers.includes(item.id.toString())
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={20}
                    color="black"
                  />
                  <Text style={{ marginLeft: 8 }}>{item.username}</Text>
                </TouchableOpacity>
              )}
              style={{ flex: 1, width: "100%" }}
            />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: "green" }]}
              onPress={handleCreateGroup}
            >
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCreateGroup(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Swipeable Tabs */}
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: Dimensions.get("window").width }}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: "#007AFF" }}
            style={{ backgroundColor: "#f2f2f2", elevation: 0, shadowOpacity: 0 }}
            activeColor="#007AFF"
            inactiveColor="#888"
            tabStyle={{
              justifyContent: "center",
              paddingTop: 0,
              paddingBottom: 0,
            }}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "black",
    marginTop: 15,
    marginLeft: 15,
    marginBottom: 10,
  },
  profileText: { fontSize: 14, marginBottom: 10, color: "black" },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 15,
    marginVertical: 6,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  userText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 20,
    textAlign: "center",
    fontStyle: "italic",
  },
  groupItem: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  groupText: { fontSize: 16, fontWeight: "600", color: "#222" },
  createGroupBtn: {
    position: "absolute",
    bottom: 50,
    left: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  createGroupText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  fullScreenModalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    width: "70%",
  },
  modalProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  modalProfilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: "blue",
    padding: 8,
    borderRadius: 5,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: "red",
    padding: 8,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  headerProfileImage: { width: 35, height: 35, borderRadius: 18 },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 6,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    marginTop: 20,
    textAlign: "center",
    fontStyle: "italic",
  },
});
