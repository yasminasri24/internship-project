// app/groupchat.tsx

import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import axios from "axios";
import { API_BASE_URL } from "../lib/apiConfig";

// --- Types ---
type Message = {
  id: number;
  sender_id: number;
  senderName: string;
  text: string;
  createdAt: string;
  media?: {
    id: number;
    uri?: string | null;
    type: "image" | "video";
    action?: "allow" | "blur" | "block" | "flagged" | undefined;
  };
};


type RootStackParamList = {
  groupchat: { id: number };
  groupinfo: { id: number };
};

type GroupChatRouteProp = RouteProp<RootStackParamList, "groupchat">;
type GroupChatNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "groupchat"
>;

// --- API Response Types ---
interface GroupNameResponse {
  success: boolean;
  group_name?: string;
}

interface GroupMessagesResponse {
  success?: boolean;
  total_messages?: number;
  messages?: {
    id: string | number;
    sender_id: string | number;
    sender_name: string;
    message: string;
    created_at: string;
  }[];
  message?: string;
}

type GroupChatApiResponse = {
  success?: boolean;
  chat?: any[];
};


//report reason
const REPORT_REASONS = [
  "Spamm",
  "Harassment or Hate",
  "Nudity or Sexual Content",
  "Violence",
  "False Information",
  "Other",
];


// --- Constants ---
const PAGE_SIZE = 20;

const COLORS = {
  background: "#F9F9F9",
  myMessage: "#ebf8c6ff",
  otherMessage: "#E5E5E5",
  senderName: "#555",
  text: "#000",
  timestamp: "#999",
  border: "#CCC",
  tint: "#2196F3",
  placeholder: "#888",
};

type DateSeparator = {
  type: "separator";
  dateLabel: string;
};

type MessageOrSeparator = Message | DateSeparator;

// --- Helper: format date labels ---
const formatDateLabel = (dateInput: string | number) => {
  const parseDate = (src: string | number) => {
    if (typeof src === "number") return new Date(src);
    if (typeof src !== "string") return new Date(String(src));

    const dbLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let s = src;
    if (dbLike.test(s)) s = s.replace(" ", "T");

    return new Date(s);
  };

  const msgDate = parseDate(dateInput);
  if (isNaN(msgDate.getTime())) return "";

  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(msgDate, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(msgDate, yesterday)) return "Yesterday";

  const diffTime = now.getTime() - msgDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 6)
    return msgDate.toLocaleDateString(undefined, { weekday: "long" });

  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: msgDate.getFullYear() === now.getFullYear() ? undefined : "numeric",
  };
  return msgDate.toLocaleDateString(undefined, opts);
};

// --- Date Separator Component ---
const DateSeparatorComponent = ({ label }: { label: string }) => (
  <View style={styles.dateSeparator}>
    <Text style={styles.dateSeparatorText}>{label}</Text>
  </View>
);


// --- Main Chat Page ---
export default function GroupChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [customReason, setCustomReason] = useState("");

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = useState(44);
  const [reportTargetType, setReportTargetType] = useState<"user" | "media" | "message">("user");
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);

  const insets = useSafeAreaInsets();
  const isAtBottomRef = useRef(true);
  const navigation = useNavigation<GroupChatNavigationProp>();
  const route = useRoute<GroupChatRouteProp>();
  const { id: groupId } = route.params;

  //image
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [media, setMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);


  // Load user ID
  useEffect(() => {
    const loadUserId = async () => {
      const stored = await AsyncStorage.getItem("userID");
      if (stored) setUserId(parseInt(stored, 10));
    };
    loadUserId();
  }, []);

  // Fetch group name
  useEffect(() => {
    const fetchGroupName = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/groups.php?group_id=${groupId}`
        );
        const data = response.data as GroupNameResponse;

        if (data.success && data.group_name) {
          navigation.setOptions({
            title: data.group_name,
            headerRight: () => (
              <TouchableOpacity
                style={{ marginRight: 12 }}
                onPress={() =>
                  navigation.navigate("groupinfo", { id: groupId })
                }
              >
                <MaterialIcons name="info" size={24} color={COLORS.tint} />
              </TouchableOpacity>
            ),
          });
        }
      } catch (error) {
        console.error("Error fetching group name:", error);
      }
    };
    fetchGroupName();
  }, [groupId]);


  /* ---------- SCROLL TO BOTTOM ---------- */
  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  };


  /* ---------- HANDLE SCROLL ---------- */
  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    const atBottom = contentOffset.y <= 40;

    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  };


  // Fetch messages
  useFocusEffect(
    useCallback(() => {
      loadInitialMessages();
      const interval = setInterval(syncChat, 2000);
      return () => clearInterval(interval);
    }, [groupId])
  );


  /* ---------- LOAD INITIAL MESSAGES ---------- */
  const loadInitialMessages = async () => {
    try {
      const msgs = await fetchGroupChat();

      setMessages(msgs);
      setTotal(msgs.length);

      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Load initial messages error:", err);
      Alert.alert("Error", "Failed to load messages.");
    }
  };


  /* ---------- FETCH GROUP MESSAGE ---------- */
  const fetchGroupChat = async (): Promise<Message[]> => {
    const res = await axios.get(
      `${API_BASE_URL}/get_group_media.php?group_id=${groupId}`
    );

    const data = res.data as GroupChatApiResponse;

    return (data.chat ?? []).map((m: any) => ({
      id: Number(m.id),
      sender_id: Number(m.sender_id),
      senderName: m.sender_name,
      text: m.message || "",
      createdAt: m.created_at,
      media: m.media
        ? {
            id: m.media.id,       
            uri: m.media.uri,
            type: m.media.type,
            action: m.media.action,
          }
        : undefined,
    }));
  };


  /* ---------- SYNC CHAT ---------- */
  const syncChat = async () => {
    try {
      const msgs = await fetchGroupChat();

      setMessages((prev) => {
        const map = new Map<number, Message>();

        // masuk data lama dulu
        prev.forEach(m => map.set(m.id, m));

        // overwrite dengan data terbaru
        msgs.forEach(m => map.set(m.id, m));

        return Array.from(map.values());
      });

      if (isAtBottomRef.current) {
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      console.error("Sync chat failed:", e);
    }
  };


  // Send message
  const sendMessage = async () => {
    if (!text.trim() || !userId) return;

    try {
      const payload = { group_id: groupId, sender_id: userId, message: text };
        const response = await axios.post(`${API_BASE_URL}/group_messages.php`, payload, {
          headers: { "Content-Type": "application/json" },
        });
      const data = response.data as GroupMessagesResponse;

      if (data.success) {
        setText("");
        setInputHeight(44);
        syncChat();
      } else {
        Alert.alert("Error", data.message || "Failed to send message.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Something went wrong while sending.");
    }
  };


  /* ---------- PICK MEDIA ---------- */
  const pickMedia = async () => {
    const { granted } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!res.canceled && res.assets.length) {
      const asset = res.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
      });
    }
  };

  /* ---------- SEND MEDIA ---------- */
  const sendMedia = async () => {
    if (!media || !userId) return;

    const formData = new FormData();
    formData.append("group_id", String(groupId));
    formData.append("sender_id", String(userId));
    formData.append("file", {
      uri: media.uri,
      name: media.type === "video" ? "video.mp4" : "image.jpg",
      type: media.type === "video" ? "video/mp4" : "image/jpeg",
    } as any);

    try {
      await axios.post(`${API_BASE_URL}/upload_group_media.php`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMedia(null);
      syncChat();
    } catch (e) {
      Alert.alert("Upload failed", "Unable to send media");
    }
  };

  // Prepare messages with separators
  const messagesWithSeparators: MessageOrSeparator[] = [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let lastLabel = "";
  for (const msg of sorted) {
    const label = formatDateLabel(msg.createdAt);
    if (label && label !== lastLabel) {
      messagesWithSeparators.push({ type: "separator", dateLabel: label });
      lastLabel = label;
    }
    messagesWithSeparators.push(msg);
  }


  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await syncChat();
    setRefreshing(false);
  };

  const loadMoreMessages = async () => {
    if (loadingMore || offset <= 0) return;
    setLoadingMore(true);

    try {
      const newOffset = Math.max(0, offset - PAGE_SIZE);
      const res = await axios.get(
        `${API_BASE_URL}/group_messages.php?group_id=${groupId}&limit=${PAGE_SIZE}&offset=${newOffset}`
      );
      const data = res.data as GroupMessagesResponse;

      const formatted: Message[] = (data.messages || []).map((m) => ({
        id: parseInt(String(m.id)),
        sender_id: parseInt(String(m.sender_id)),
        senderName: m.sender_name,
        text: m.message,
        createdAt: m.created_at,
      }));

      setMessages((prev) => [...prev, ...formatted.slice().reverse()]);
      setOffset(newOffset);
    } catch (err) {
      console.error("Load more messages error:", err);
    } finally {
      setLoadingMore(false);
    }
  };


  // --- LONG PRESS HANDLER (report) ---
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);


  const handleLongPressMessage = (msg: Message, event: any) => {
    const { pageX, pageY } = event.nativeEvent;

    setSelectedMessage(msg);
    setMenuPosition({ x: pageX, y: pageY - 20 }); // slight offset
    setMenuVisible(true);
  };


  //submit report
  const submitReport = async () => {
    if (!selectedMessage || !selectedReason || !userId) return;

    if (selectedReason === "Other" && !customReason.trim()) {
      Alert.alert("Required", "Please enter your reason.");
      return;
    }

    try {
      const isMedia = !!selectedMessage.media;

      const payload: any = {
        chat_type: "group",
        reporter_id: userId,
        reported_user_id: selectedMessage.sender_id,
        group_id: groupId,
        report_type: isMedia
          ? selectedMessage.media!.type // "image" | "video"
          : "message",
        reason:
          selectedReason === "Other"
            ? customReason.trim()
            : selectedReason,
        group_media_id: null,
      };

      // ONLY for image / video
      if (isMedia) {
        payload.group_media_id = selectedMessage.media!.id;
      }

      const res = await axios.post(`${API_BASE_URL}/reports.php`, payload);

      if (res.data?.success) {
        Alert.alert(
          "Reported",
          "Thank you for helping keep the community safe."
        );
      } else {
        Alert.alert("Failed", res.data?.error || "Unable to report");
      }

      // Reset
      setReasonVisible(false);
      setSelectedReason(null);
      setCustomReason("");
      setSelectedMessage(null);
    } catch (e) {
      console.error("submitReport error:", e);
      Alert.alert("Error", "Failed to submit report");
    }
  };

  /* -------------------- RENDER -------------------- */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={70}>

      <FlatList
        ref={flatListRef}
        inverted
        data={messagesWithSeparators.slice().reverse()}
        keyExtractor={(item, idx) => "type" in item ? `sep-${item.dateLabel}-${idx}`: item.id.toString()}
        renderItem={({ item }) => {
          if ("type" in item) return <DateSeparatorComponent label={item.dateLabel} />;

          const isMe = item.sender_id === userId;
          const isBlocked = item.media?.action === "block";
          const isFlagged = item.media?.action === "flagged";

          return (
            <View style={{ marginVertical: 6, alignSelf: isMe ? "flex-end" : "flex-start" }}>
              <View
                style={[
                  styles.message,
                  item.media && { padding: 6 },
                  { backgroundColor: isMe ? COLORS.myMessage : COLORS.otherMessage },
                ]}
              >
                {item.sender_id !== userId && (
                  <Text style={styles.senderNameText}>{item.senderName}</Text>
                )}

                {!!item.text && <Text style={styles.messageText}>{item.text}</Text>}

                {item.media && (
                  <>
                  {isBlocked ? (
                    <View style={styles.blockedWrapper}>
                      {item.media.type === "image" && (
                        <Image source={{ uri: item.media.uri! }} style={styles.media} blurRadius={18} />
                      )}
                      <View style={styles.blockedOverlay}>
                        <Ionicons name="ban-outline" size={28} color="#fff" />
                        <Text style={styles.blockedLabel}>Media blocked</Text>
                      </View>
                    </View>
                  ) : isFlagged ? (
                    // Flagged media
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        item.media!.type === "image"
                          ? setPreviewImage(item.media!.uri!)
                          : setPreviewVideo(item.media!.uri!)
                      }
                      onLongPress={() => {
                        setReportTargetType("media");
                        setReportTargetId(item.media?.id ?? null);
                        setSelectedMessage(item as Message);
                        setMenuVisible(true);
                      }}
                    >
                      <View style={styles.flaggedWrapper}>
                        {item.media.type === "image" && (
                          <Image
                            source={{ uri: item.media.uri! }}
                            style={styles.media}
                            blurRadius={6}
                          />
                        )}

                        {item.media.type === "video" && (
                          <Video
                            source={{ uri: item.media.uri! }}
                            style={styles.media}
                            resizeMode={ResizeMode.CONTAIN}
                            useNativeControls={false}
                          />
                        )}

                        <View style={styles.flaggedOverlay}>
                          <Text style={styles.flaggedLabel}>Flagged content</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                  ) : (
                    // Clean media
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        item.media!.type === "image"
                          ? setPreviewImage(item.media!.uri!)
                          : setPreviewVideo(item.media!.uri!)
                      }
                      onLongPress={() => {
                        setReportTargetType("media");
                        setReportTargetId(item.media?.id ?? null);
                        setSelectedMessage(item as Message);
                        setMenuVisible(true);
                      }}
                    >
                      {item.media.type === "image" && (
                        <Image source={{ uri: item.media.uri! }} style={styles.media} />
                      )}
                      {item.media.type === "video" && (
                        <Video
                          source={{ uri: item.media.uri! }}
                          style={styles.media}
                          resizeMode={ResizeMode.CONTAIN}
                          useNativeControls
                        />
                      )}
                    </TouchableOpacity>
                  )}
                  </>
                )}
                <Text style={styles.timestampText}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                </Text>
              </View>
            </View>
          );
        }
      }
      contentContainerStyle={{
        padding: 12,
        paddingBottom: 120,
      }}
      onEndReachedThreshold={0.1}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      onScroll={handleScroll}
      scrollEventThrottle={16}
    />

    {/* Scroll to bottom button */}
    {showScrollButton && (
      <TouchableOpacity
        style={styles.scrollButton}
        onPress={() => scrollToBottom()}
      >
        <MaterialIcons name="arrow-downward" size={24} color="#fff" />
      </TouchableOpacity>
    )}

    {/* Image Preview */}
    {previewImage && (
      <View style={styles.previewOverlay}>
        <Pressable
          style={styles.previewCloseArea}
          onPress={() => setPreviewImage(null)}
        >
          <Ionicons name="close" size={32} color="#fff" />
        </Pressable>

        <Image
          source={{ uri: previewImage }}
          style={styles.previewFullImage}
          resizeMode="contain"
        />
      </View>
    )}

    {/* Video Preview */}
    {previewVideo && (
      <View style={styles.previewOverlay}>
        <Pressable
          style={styles.previewCloseArea}
          onPress={() => setPreviewVideo(null)}
        >
          <Ionicons name="close" size={32} color="#fff" />
        </Pressable>

        <Video
          source={{ uri: previewVideo }}
          style={styles.previewFullImage}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
        />
      </View>
    )}

    {/* Context menu for report */}
    {menuVisible && (
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setMenuVisible(false)}
      >
        <View
          style={[ styles.contextMenu ]}
        >
          <TouchableOpacity
            style={styles.contextItem}
            onPress={() => {
              setMenuVisible(false);
              setConfirmVisible(true);
            }}
          >
            <Text style={styles.contextText}>Report Message</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )}

    {/* Confirm Report Modal */}
    {confirmVisible && selectedMessage && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Report Message</Text>
          <Text style={{ fontSize: 16, marginVertical: 12 }}>
            Are you sure you want to report this{" "}
            {selectedMessage.media ? selectedMessage.media.type : "message"}?
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setConfirmVisible(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => {
                setConfirmVisible(false);
                setReasonVisible(true);
              }}
            >
              <Text style={{ color: "#fff" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}

    {/* Reason selection modal */}
    {reasonVisible && selectedMessage && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Why are you reporting this?</Text>

          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={styles.radioRow}
              onPress={() => setSelectedReason(reason)}
            >
              <View style={styles.radioOuter}>
                {selectedReason === reason && <View style={styles.radioInner} />}
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
              onPress={() => {
                setReasonVisible(false);
                setSelectedReason(null);
              }}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { opacity: selectedReason ? 1 : 0.5 },
              ]}
              disabled={!selectedReason}
              onPress={submitReport}
            >
              <Text style={{ color: "#fff" }}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}

    {/* ---------- MEDIA PREVIEW BEFORE SEND ---------- */}
    {media && (
      <View style={styles.previewContainer}>
        <TouchableOpacity
          style={styles.previewCloseBtn}
          onPress={() => setMedia(null)}
        >
          <Ionicons name="close-circle" size={26} color="#fff" />
        </TouchableOpacity>

        {media.type === "image" ? (
          <Image
            source={{ uri: media.uri }}
            style={styles.previewImage}
          />
        ) : (
          <View style={styles.videoPreview}>
            <Ionicons name="videocam" size={30} color="#fff" />
            <Text style={{ color: "#fff", marginLeft: 8 }}>Video selected</Text>
          </View>
        )}
      </View>
    )}


    {/* Input area */}
    <Animated.View
      style={[ styles.inputContainer,
        { marginBottom: keyboardHeight, paddingBottom: insets.bottom || 12 },
      ]}
    >
      {/* Attach button */}
      <TouchableOpacity style={styles.attachButton} onPress={pickMedia}>
        <Ionicons name="image-outline" size={24} color={COLORS.tint} />
      </TouchableOpacity>

      {/* Text input */}
      <TextInput
        style={[styles.input, { height: Math.max(44, inputHeight) }]}
        placeholder="Type a message..."
        placeholderTextColor={COLORS.placeholder}
        value={text}
        onChangeText={setText}
        multiline
        onContentSizeChange={(e) => {
          const newHeight = e.nativeEvent.contentSize.height;
          setInputHeight(Math.min(Math.max(newHeight, 44), 120));
        }}
      />

      {/* Send button */}
      <TouchableOpacity
        style={styles.sendButton}
        onPress={media ? sendMedia : sendMessage}
      >
        <Ionicons name="send" size={22} color="#0078fe" />
      </TouchableOpacity>
    </Animated.View>
  </KeyboardAvoidingView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  message: {
    maxWidth: "82%", 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 14,
    overflow: "hidden",
  },

  myMessage: { 
    alignSelf: "flex-end" 
  },

  otherMessage: { 
    alignSelf: "flex-start" 
  },

  senderNameText: {
    fontWeight: "bold",
    color: COLORS.senderName,
    marginBottom: 3,
  },

  messageText: { 
    color: "#000", 
    fontSize: 16,
    lineHeight: 20
  },

  timestampText: {
    fontSize: 10,
    color: "#000",
    marginTop: 4,
  },

  // popup report overlay 
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 50,
    paddingRight: 10,
    zIndex: 999,
  },

  inputContainer: {
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 8, 
    paddingVertical: 6, 
    borderTopWidth: 1,
    borderTopColor: "#ddd" 
  },

  input: {
    flex: 1, 
    borderWidth: 1,
    borderColor: "#ccc", 
    backgroundColor: "#f4f4f6", 
    borderRadius: 22, 
    paddingHorizontal: 12, 
    paddingTop: 10,
    paddingBottom: 10,
    marginHorizontal: 6, 
    color: "#111", 
    textAlignVertical: "center", 
    fontSize: 16, 
    maxHeight: 120 
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  dateSeparator: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#ddd",
    borderRadius: 12,
    marginVertical: 10,
  },

  dateSeparatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555"
  },

  scrollButton: {
    position: "absolute",
    right: 16,
    bottom: 110,
    backgroundColor: COLORS.tint,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },

  contextMenu: {
    width: 140,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },

  contextItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  contextText: {
    fontSize: 16,
    color: "#333",
    paddingVertical: 2,
  },

  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "black",
    zIndex: 999,
  },

  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  //style reason report
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },

  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },

  reasonInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    minHeight: 60,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },

  cancelBtn: {
    padding: 10,
    marginRight: 10,
  },

  submitBtn: {
    backgroundColor: "#0078fe",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0078fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0078fe",
  },

  radioText: {
    fontSize: 15,
  },

  previewFullImage: {
    width: "100%",
    height: "100%",
  },

  previewCloseArea: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10000,
    color: "#000"
  },

  previewContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 97,
    backgroundColor: "#ccc",
    borderRadius: 12,
    padding: 8,
    zIndex: 20,
  },

  videoPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 120,
  },

  previewCloseBtn: {
    position: "absolute",
    top: 6,
    right: 6,
  },

  previewImage: { 
    width: 180, 
    height: 130, 
    borderRadius: 8 
  },

  media: { 
    width: 180, 
    height: 130, 
    borderRadius: 8 
  },

  // FLAGGED / BLOCKED MEDIA STYLES
  blockedWrapper: { 
    position: "relative", 
    width: 180, 
    height: 130, 
    borderRadius: 8, 
    overflow: "hidden",
    backgroundColor: "#555", 
    justifyContent: "center", 
    alignItems: "center"
  },

  blockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  blockedLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 6,
  },

  flaggedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,165,0,0.3)", // orange tint
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },

  flaggedLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  flaggedWrapper: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },

});
