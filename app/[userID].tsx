import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { API_BASE_URL } from "../lib/apiConfig";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";


type ApiMessage = {
  id: string | number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
  sender_name?: string;
  media?: {
    id: number;
    uri?: string | null;
    type: "image" | "video";
    action?: "allow" | "blur" | "block" | "flagged" | undefined;
  };
};


//option reasons for report
const REPORT_REASONS = [
  "Spamm",
  "Harassment or hate speech",
  "Inappropriate content",
  "Scam or fraud",
  "Impersonation",
  "Other",
];


type DateSeparator = {
  type: "separator";
  dateLabel: string;
};

type MessageOrSeparator = ApiMessage | DateSeparator;

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
  if (diffDays < 6) return msgDate.toLocaleDateString(undefined, { weekday: "long" });

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

const AudioPlayer = ({ uri, isMe }: { uri: string; isMe: boolean }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const onStatus = (status: any) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis);
    setDuration(status.durationMillis ?? 0);
    setIsPlaying(status.isPlaying);
  };

  const toggle = async () => {
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        {},
        onStatus
      );
      setSound(s);
      await s.playAsync();
    } else {
      isPlaying ? sound.pauseAsync() : sound.playAsync();
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: 220 }}>
      <TouchableOpacity onPress={toggle}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={26}
          color={isMe ? "#fff" : "#0078fe"}
        />
      </TouchableOpacity>

      <Slider
        style={{ flex: 1, marginLeft: 8 }}
        minimumValue={0}
        maximumValue={duration || 1}
        value={position}
        onSlidingComplete={(v) => sound?.setPositionAsync(v)}
        minimumTrackTintColor={isMe ? "#fff" : "#0078fe"}
        maximumTrackTintColor="rgba(0,0,0,0.2)"
        thumbTintColor={isMe ? "#fff" : "#0078fe"}
      />
    </View>
  );
};


export default function ChatScreen() {
  const { userID: paramUserID, username, profilePic } =
    useLocalSearchParams<{
      userID: string;
      username?: string;
      profilePic?: string;
    }>();

  const router = useRouter();
  const navigation = useNavigation();
  const partnerId = Number(paramUserID);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);


  const [chatReady, setChatReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [media, setMedia] = useState<{ uri: string; type: "image" | "video" } | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [reportTargetType, setReportTargetType] = useState<"user" | "media" | "message">("user");
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const [reportType, setReportType] = useState<"user" | "image" | "video" | "message">("user");

  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<(ApiMessage | DateSeparator)>>(null);
  const insets = useSafeAreaInsets();
  const isAtBottomRef = useRef(true);


  /* ---------- AUTH ---------- */
  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("userID");
      if (!uid) {
        Alert.alert("Not logged in", "Please login again.");
        router.replace("/auth");
        return;
      }
      setCurrentUserId(Number(uid));
    })();
  }, []);


  /* ---------- HEADER TITLE ---------- */
  useEffect(() => {
    if (username && currentUserId) {
      (async () => {
        const uid = await AsyncStorage.getItem("userID");
        if (uid) {
          navigation.setOptions({
            title: username,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="ellipsis-vertical" size={26} color="#fff" />
              </TouchableOpacity>
            ),
          });
        }
      })();
    }
  }, [username, currentUserId, navigation]);


  /* ---------- FETCH CHAT ---------- */
  const fetchChat = async (): Promise<ApiMessage[]> => {
    if (!currentUserId) return [];

    try {
      const res = await axios.get(`${API_BASE_URL}/get_media.php`, {
        params: {
          sender_id: currentUserId,
          receiver_id: partnerId,
        },
      });

      const chat: ApiMessage[] = res.data?.chat ?? [];

      return chat
        .map((m: any) => ({
          id: String(m.id),
          sender_id: Number(m.sender_id),
          receiver_id: Number(m.receiver_id),
          message: m.message ?? "",
          created_at: m.created_at,
          media: m.media && m.media.media_id ? {
            id: Number(m.media.media_id),
            uri: m.media.uri ?? undefined, // <-- undefined instead of null
            type: m.media.type as "image" | "video",
            action: m.media.action as "allow" | "blur" | "block" | undefined,
          } : undefined, // <-- null → undefined
        }))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

    } catch (err) {
      console.log("fetchChat error:", err);
      return [];
    }
  };

  // Prepare messages with separators
  const messagesWithSeparators: MessageOrSeparator[] = [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let lastLabel = "";
  for (const msg of sorted) {
    const label = formatDateLabel(msg.created_at);
    if (label && label !== lastLabel) {
      messagesWithSeparators.push({ type: "separator", dateLabel: label });
      lastLabel = label;
    }
    messagesWithSeparators.push(msg);
  }


  /* Inverted data for FlatList */
  const invertedData = useMemo(() => {
    return [...messagesWithSeparators].reverse();
  }, [messagesWithSeparators]);


  // Auto scroll to bottom on new messages if at bottom
  useEffect(() => {
    if (!isAtBottomRef.current) return;

    listRef.current?.scrollToOffset({
      offset: 0, // bottom sebab inverted
      animated: true,
    });
  }, [messages.length]);


  /* ---------- SYNC CHAT ---------- */
  const syncChat = async () => {
    const chat = await fetchChat();
    setMessages(chat);

    if (!chatReady && chat.length > 0) {
      setChatReady(true);
    }
  };


  /* ---------- SCROLL TO BOTTOM ---------- */
  const scrollToBottom = () => {
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  };


  /* ---------- POLLING ---------- */
  useEffect(() => {
    if (!currentUserId) return;
    syncChat();
    const iv = setInterval(syncChat, 2500);
    return () => clearInterval(iv);
  }, [currentUserId, partnerId]);


  /* ---------- HANDLE SCROLL ---------- */
  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;

    // sebab inverted → offset.y kecil = dekat bottom
    const atBottom = contentOffset.y <= 40;

    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
  };


  /* ---------- PICK MEDIA ---------- */
  const pickMedia = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!res.canceled && res.assets.length) {
      const asset = res.assets[0];
      setMedia({ uri: asset.uri, type: asset.type === "video" ? "video" : "image" });
    }
  };


  /* ---------- SEND TEXT ---------- */
  const sendMessage = async () => {
    if (!currentUserId || !text.trim()) return;

    try {
      await axios.post(
        `${API_BASE_URL}/messages.php`,
        {
          sender_id: currentUserId,
          receiver_id: partnerId,
          message: text.trim(),
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      setText("");
      await syncChat();
    } catch (err) {
      console.log("sendMessage error:", err);
    }
  };


  /* ---------- SEND MEDIA ---------- */
  const sendMedia = async () => {
    if (!media || !currentUserId) return;

    try {
      const fd = new FormData();
      fd.append("sender_id", String(currentUserId));
      fd.append("receiver_id", String(partnerId));
      fd.append("file", {
        uri: media.uri,
        name: media.type === "video" ? "video.mp4" : "image.jpg",
        type: media.type === "video" ? "video/mp4" : "image/jpeg",
      } as any);

      await axios.post(`${API_BASE_URL}/upload_media.php`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMedia(null);
      await syncChat();
    } catch (err) {
      console.log("sendMedia error:", err);
    }
  };

  /* ---------- RECORD AUDIO ---------- */
  const startRecording = async () => {
    // Ask microphone permission
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;

    // Required for iOS (safe for Android)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start recording
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      (status) => {
        setRecordingDuration(status.durationMillis ?? 0);
      }
    );

    setRecording(recording);
  };

  const stopAndSendRecording = async () => {
    if (!recording || !currentUserId) return;

    // Stop recording
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (!uri) return;

    // Prepare upload
    const fd = new FormData();
    fd.append("sender_id", String(currentUserId));
    fd.append("receiver_id", String(partnerId));
    fd.append("voice_note", {
      uri,
      name: `voice_${Date.now()}.m4a`,
      type: "audio/m4a",
    } as any);

    // Upload to existing backend
    await axios.post(`${API_BASE_URL}/messages.php`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Refresh chat
    syncChat();
  };

  // REPORT MESSAGE (long press)
  const reportMessage = () => {
    if (!selectedMessageId) {
      console.warn("No selectedMessageId");
      return;
    }

    const msg = messages.find(
      (m) => String(m.id) === selectedMessageId
    );

    if (!msg) {
      Alert.alert("Error", "Message not found.");
      return;
    }

    Alert.alert(
      "Report Message",
      "Are you sure you want to report this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Report",
          style: "destructive",
          onPress: () => {
            // ✅ TEXT MESSAGE
            if (!msg.media) {
              setReportType("message");
            }
            // ✅ MEDIA MESSAGE
            else {
              setReportType(
                msg.media.type === "video" ? "video" : "image"
              );
            }

            setSelectedReason(null);
            setCustomReason("");
            setShowBubbleMenu(false);
            setShowReasonModal(true);
          },
        },
      ]
    );
  };


  // OPEN REPORT USER
  const openReportConfirm = () => {
    Alert.alert(
      "Report User",
      `Are you sure you want to report ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Report",
          style: "destructive",
          onPress: () => {
            setReportType("user");
            setSelectedReason(null);
            setCustomReason("");
            setShowReasonModal(true);
          },
        },
      ]
    );
  };

  // SUBMIT REPORT
  const submitReport = async () => {
    if (!selectedReason) {
      Alert.alert("Required", "Please select a report reason.");
      return;
    }
    if (selectedReason === "Other" && !customReason.trim()) {
      Alert.alert("Required", "Please enter your reason.");
      return;
    }
    if (!currentUserId) return;

    const finalReason =
      selectedReason === "Other" ? customReason.trim() : selectedReason;

    let payload: any = {
      chat_type: "private",
      reporter_id: Number(currentUserId),
      reported_user_id: null,
      report_type: reportType,
      reason: finalReason,
      private_chat_id: null,
      private_media_id: null,
      group_id: null,
      group_media_id: null,
    };

    if (reportType === "user") {
      payload.reported_user_id = partnerId;

      const lastMsg = messages[messages.length - 1];
      if (!lastMsg) {
        Alert.alert("Error", "No chat context found");
        return;
      }

      payload.private_chat_id = lastMsg.id;

    } else {
      const msg = messages.find(m => String(m.id) === selectedMessageId);
      if (!msg) {
        Alert.alert("Error", "Message not found");
        return;
      }
      payload.reported_user_id = msg.sender_id;
      payload.private_chat_id = msg.id;

      if (reportType === "image" || reportType === "video") {
        if (!msg.media) {
          Alert.alert("Error", "Media not found");
          return;
        }
        payload.private_media_id = msg.media.id;
      }
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/reports.php`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.success) {
        Alert.alert("Reported", "Thank you for your report.");
      } else {
        Alert.alert("Failed", res.data?.error || "Unable to report.");
      }
    } catch (err) {
      console.log("submitReport error:", err);
      Alert.alert("Error", "Server error.");
    }

    setShowReasonModal(false);
    setSelectedReason(null);
    setCustomReason("");
    setSelectedMessageId(null);
  };


  /* ---------- RENDER ---------- */
  const renderItem = ({ item }: { item: ApiMessage }) => {
    const isMe = item.sender_id === currentUserId;

    const isBlocked = item.media?.action === "block";
    const isFlagged = item.media?.action === "flagged";

    return (
      <View
        style={[styles.messageRow, { justifyContent: isMe ? "flex-end" : "flex-start" }]}
      >
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {/* MEDIA */}
          {item.media ? (
            isBlocked ? (
              // BLOCKED MEDIA
              <View style={styles.blockedWrapper}>
                {item.media.type === "image" && item.media.uri && (
                  <Image
                    source={{ uri: item.media.uri }}
                    style={styles.media}
                    blurRadius={18}
                  />
                )}
                <View style={styles.blockedOverlay}>
                  <Ionicons name="ban-outline" size={28} color="#fff" />
                  <Text style={styles.blockedLabel}>Media blocked</Text>
                </View>
              </View>

            ) : isFlagged ? (
              // FLAGGED MEDIA
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setPreviewImage(item.media?.uri ?? null)} // boleh tap preview
                onLongPress={() => {
                  setReportTargetType("media");
                  setReportTargetId(item.media?.id ?? null);
                  setSelectedMessageId(String(item.id)); // <<< add this
                  setShowBubbleMenu(true);
                }}
              >
                {item.media.type === "image" && item.media.uri && (
                  <Image
                    source={{ uri: item.media.uri }}
                    style={styles.media}
                    blurRadius={6} // optional blur
                  />
                )}
                {item.media.type === "video" && item.media.uri && (
                  <Video
                    source={{ uri: item.media.uri }}
                    style={styles.media}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                  />
                )}
                <View style={styles.flaggedOverlay}>
                  <Text style={styles.flaggedLabel}>Flagged content</Text>
                </View>
              </TouchableOpacity>
            ) : (

              // CLEAN MEDIA
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (item.media?.type === "image") setPreviewImage(item.media?.uri ?? null);
                  else if (item.media?.type === "video") setPreviewVideo(item.media?.uri ?? null);
                }}
                onLongPress={() => {
                  setReportTargetType("media");
                  setReportTargetId(item.media?.id ?? null);
                  setSelectedMessageId(String(item.id)); // <<< add this
                  setShowBubbleMenu(true);
                }}
              >
                {/* IMAGE */}
                {item.media.type === "image" && item.media.uri && (
                  <Image source={{ uri: item.media.uri }} style={styles.media} />
                )}

                {/* VIDEO */}
                {item.media.type === "video" && item.media.uri && (
                  <Video
                    source={{ uri: item.media.uri }}
                    style={styles.media}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                  />
                )}

                {/* AUDIO / VOICE NOTE */}
                {item.media.type === "audio" && item.media.uri && (
                  <TouchableOpacity
                    style={styles.voiceBubble}
                    onPress={() => playAudio(item.media.uri)}
                  >
                    <Ionicons name="play-circle" size={28} color="#fff" />
                    <Text style={styles.voiceText}>Voice message</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

            )
          ) : null}

          {/* TEXT */}
          {item.message ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => {
                setReportTargetType("message");
                setReportTargetId(Number(item.id));
                setSelectedMessageId(String(item.id)); // <<< add this
                setShowBubbleMenu(true);
              }}
            >
              <Text style={[styles.text, { color: isMe ? "#fff" : "#000" }]}>
                {item.message}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </Text>
        </View>
      </View>
    );
  };

  /* ---------- RENDER ---------- */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9F9F9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={70}
    >
      <FlatList
        ref={listRef}
        inverted
        data={invertedData}
        keyExtractor={(i, idx) =>
          "type" in i
            ? `sep-${i.dateLabel}-${idx}`
            : `${i.id}-${i.created_at}`
        }
        renderItem={({ item }) =>
          "type" in item ? (
            <DateSeparatorComponent label={item.dateLabel} />
          ) : (
            renderItem({ item })
          )
        }
        contentContainerStyle={{
          padding: 12,
          paddingTop: 30,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* Media Preview Before Upload */}
      {media && (
        <View style={styles.previewContainer}>
          {media.type === "image" ? (
            <Image source={{ uri: media.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.videoPreview}>
              <Ionicons name="videocam" size={28} color="#fff" />
              <Text style={{ color: "#fff", marginLeft: 8 }}>Video selected</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setMedia(null)}
          >
            <Ionicons name="close-circle" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      )}


      {/* Image Preview */}
      {previewImage && (
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewCloseArea} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>

          <Image
            source={{ uri: previewImage }}
            style={styles.previewFullImage}
            resizeMode="contain"
          />
        </View>
      )}

      {/*Video Preview */}
      {previewVideo && (
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewCloseArea} onPress={() => setPreviewVideo(null)}>
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

      {showScrollBtn && (
        <TouchableOpacity style={styles.scrollToBottomBtn} onPress={scrollToBottom}>
          <Ionicons name="arrow-down" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Input */}
      <Animated.View
        style={[
          styles.inputBar,
          { marginBottom: keyboardHeight, paddingBottom: insets.bottom || 12 },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={pickMedia}>
          <Ionicons name="image-outline" size={24} color="#0078fe" />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { height: Math.max(44, inputHeight) }]}
          placeholder="Type a message..."
          placeholderTextColor="#888"
          value={text}
          onChangeText={setText}
          multiline
          onContentSizeChange={(e) => {
            const newHeight = e.nativeEvent.contentSize.height;
            setInputHeight(Math.min(Math.max(newHeight, 44), 120));
          }}
        />

        <TouchableOpacity
          onPressIn={startRecording}
          onPressOut={stopAndSendRecording}
          style={styles.iconBtn}
        >
          <Ionicons
            name="mic"
            size={22}
            color={recording ? "red" : "#0078fe"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={media ? sendMedia : sendMessage}
        >
          <Ionicons name="send" size={22} color="#0078fe" />
        </TouchableOpacity>

      </Animated.View>

      {/* User Menu */}
      {showMenu && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        >
          <View style={styles.menuBox}>
            <TouchableOpacity
              onPress={() => {
                setShowMenu(false);
                openReportConfirm();
              }}
              style={styles.menuItem}
            >
              <Text style={styles.menuText}>Report User</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Message Long Press Menu */}
      {showBubbleMenu && (
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setShowBubbleMenu(false)}
          activeOpacity={1}
        >
          <View style={styles.menuBox}>
            <TouchableOpacity
              onPress={reportMessage}
              style={styles.menuItem}
            >
              <Text style={styles.menuText}>Report Message</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Report Reason Modal */}
      {showReasonModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Report Reason</Text>

            {REPORT_REASONS.map((reason) => (
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

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={submitReport}
              >
                <Text style={{ color: "#fff" }}>Send Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 6
  },

  bubble: {
    maxWidth: "82%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14
  },

  myBubble: {
    backgroundColor: "#0077fecd",
    borderBottomRightRadius: 4
  },

  theirBubble: {
    backgroundColor: "#e9e9ef",
    borderBottomLeftRadius: 4
  },

  text: {
    color: "#000",
    fontSize: 16,
    lineHeight: 20
  },

  media: {
    width: 180,
    height: 130,
    borderRadius: 8
  },

  previewImage: {
    width: 180,
    height: 130,
    borderRadius: 8
  },

  inputBar: {
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

  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
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

  scrollToBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 110,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0078fe",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },

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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center"
  },

  blockedLabel: {
    marginTop: 6,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },

  flaggedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },

  flaggedLabel: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },

  dateSeparator: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#ddd",
    borderRadius: 12,
    marginVertical: 10
  },

  dateSeparatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555"
  },

  timestamp: {
    fontSize: 10,
    color: "#000",
    marginTop: 4,
  },

  menuOverlay: {
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

  menuBox: {
    width: 140,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },

  menuItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  menuText: {
    fontSize: 16,
    color: "#333",
    paddingVertical: 2,
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

});