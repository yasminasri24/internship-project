// app/sadmin_tabs/DashboardTab.tsx
import React, { memo, useEffect, useReducer, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, ViewStyle, ActivityIndicator, TextStyle, TextInput, RefreshControl, GestureResponderEvent, Platform, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, FadeIn, FadeOut, Easing, cancelAnimation, interpolate, Extrapolation, useDerivedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import { styles, COLORS } from "../../lib/sadmin_tabs/styles";
import { parseStatus, getUsageColor, STATUS_COLORS, useDashboardContext, useAlert } from "../../lib/sadmin_tabs/common";
import axios from "axios";
import { API_BASE_URL } from "../../lib/apiConfig";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { PanelCard, SummaryCard, Toast, SuspendUserModal, LiveActivityItem } from "../../lib/sadmin_tabs/SharedComponents";
import { DashboardSkeleton } from "../../lib/sadmin_tabs/SkeletonLoader";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

// --- Reusable UI Components --- //

const ProgressBar: React.FC<{ progress: number; color: string }> = memo(({ progress, color }) => {
  const width = `${Math.max(0, Math.min(100, progress))}%` as ViewStyle["width"];

  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width, backgroundColor: color }]} />
    </View>
  );
});

const LogDetailItem: React.FC<{ label: string; value: string | undefined; valueStyle?: TextStyle }> = memo(({ label, value, valueStyle }) => {
  if (!value) return null;
  return (
    <View style={styles.logDetailRow}>
      <Text style={styles.logDetailLabel}>{label}:</Text>
      <Text style={[styles.logDetailValue, valueStyle]}>{value}</Text>
    </View>
  );
});

const QuickActions: React.FC<{ onUsersPress: () => void; onReportsPress: () => void; onLogsPress: () => void; }> = memo(({ onUsersPress, onReportsPress, onLogsPress }) => (
  <View style={styles.quickActionsContainer}>
    <TouchableOpacity style={styles.quickActionBtn} onPress={onUsersPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
        <Ionicons name="people" size={24} color={COLORS.primary} />
      </View>
      <Text style={styles.quickActionText}>Manage Users</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.quickActionBtn} onPress={onReportsPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
        <Ionicons name="bar-chart" size={24} color={COLORS.success} />
      </View>
      <Text style={styles.quickActionText}>View Reports</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.quickActionBtn} onPress={onLogsPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
        <Ionicons name="clipboard" size={24} color={COLORS.warning} />
      </View>
      <Text style={styles.quickActionText}>Audit Logs</Text>
    </TouchableOpacity>
  </View>
));

const getTimeAgo = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const now = new Date();
  const past = new Date(dateStr.replace(" ", "T")); // Ensure ISO format parsing
  if (isNaN(past.getTime())) return 'Invalid date';

  const diffSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffSeconds < 10) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

const hexToTransparent = (hex: string) => {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }
  return 'rgba(255,255,255,0)';
};

const ScrollableSummaryCard: React.FC<{
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  textColor: string;
  onPress?: () => void;
  badgeVisible?: boolean;
  scrollSync?: Animated.SharedValue<number>;
}> = memo(({ title, value, icon, color, textColor, onPress, badgeVisible, scrollSync }) => {
  const translateX = useSharedValue(0);
  const maxTranslateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const transparentColor = useMemo(() => hexToTransparent(color), [color]);

  const currentTranslateX = useDerivedValue(() => {
    return scrollSync ? interpolate(scrollSync.value, [0, 1], [0, maxTranslateX.value]) : translateX.value;
  });

  useEffect(() => {
    const shouldScroll = textWidth > containerWidth && containerWidth > 0;
    const distance = shouldScroll ? textWidth - containerWidth + 10 : 0;
    maxTranslateX.value = -distance;

    if (scrollSync) {
      cancelAnimation(translateX);
      return;
    }

    if (shouldScroll) {
      const pixelsPerSecond = 30; // Constant speed: 30px per second
      const duration = (distance / pixelsPerSecond) * 1000;

      cancelAnimation(translateX);
      translateX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2000 }), // Pause at start
          withTiming(-distance, { duration: duration, easing: Easing.linear }),
          withTiming(-distance, { duration: 2000 }), // Pause at end
          withTiming(0, { duration: duration, easing: Easing.linear })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
    }
  }, [textWidth, containerWidth, scrollSync]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: currentTranslateX.value }],
  }));

  const leftGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(currentTranslateX.value, [-10, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const rightGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(currentTranslateX.value, [maxTranslateX.value, maxTranslateX.value + 10], [0, 1], Extrapolation.CLAMP),
  }));

  const content = (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: textColor === '#fff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name={icon} size={20} color={textColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: textColor, lineHeight: 24 }} numberOfLines={1}>{value}</Text>
        <View
          style={{ overflow: 'hidden', width: '100%' }}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1 }} pointerEvents="none">
            <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
              <Text
                style={{ fontSize: 12, color: textColor, fontWeight: '600', marginTop: 0, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}
                onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
              >
                {title}
              </Text>
            </Animated.View>
          </ScrollView>
          {textWidth > containerWidth && (
            <>
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, zIndex: 1 }, leftGradientStyle]} pointerEvents="none">
                <LinearGradient
                  colors={[color, transparentColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
              <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 20, zIndex: 1 }, rightGradientStyle]} pointerEvents="none">
                <LinearGradient
                  colors={[transparentColor, color]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </>
          )}
        </View>
      </View>
      {badgeVisible && <View style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, justifyContent: "center", alignItems: "center", zIndex: 10, borderWidth: 1.5, borderColor: '#fff' }} />}
    </>
  );

  const containerStyle: StyleProp<ViewStyle> = [styles.summaryCard, { backgroundColor: color, flex: 1, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', minHeight: 70 }];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle} accessibilityLabel={`${title}: ${value}`} accessible>
      {content}
    </View>
  );
});

/* -------------------------- DashboardTab -------------------------- */
interface ExtendedHealth {
  backend: string;
  myphp: string;
  database: string;
  cpu: number;
  memory: number;
  disk: number;
  dbLatency: number;
  msgsPerMin: number;
  avgMsgSize: number;
}

const DashboardTab: React.FC = memo(() => {
  const { metrics, screenings, violations, users, loadingUsers, refreshData, suspendUser, removeUser } = useDashboardContext();
  const showAlert = useAlert();
  const navigation = useNavigation<any>();
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [activityTab, setActivityTab] = useState<'newUsers' | 'adminActions' | 'flaggedActivity'>('newUsers');
  const [modalType, setModalType] = useState<"screenings" | "violations" | null>(null);
  const [modalViewMode, setModalViewMode] = useState<'today' | 'all'>('today');
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");
  const [showModalStartDatePicker, setShowModalStartDatePicker] = useState(false);
  const [showModalEndDatePicker, setShowModalEndDatePicker] = useState(false);
  const [showModalDateFilters, setShowModalDateFilters] = useState(false);
  const [localViolations, setLocalViolations] = useState<any[]>([]);
  const [dismissedViolationIds, setDismissedViolationIds] = useState<Set<number>>(new Set());
  const modalSearchInputRef = useRef<TextInput>(null);
  const logSearchInputRef = useRef<TextInput>(null);
  
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' | 'destructive' }>({ visible: false, message: '', type: 'success' });
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<number | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);

  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const scrollToTopStyle = useAnimatedStyle(() => {
    const show = scrollY.value > 300;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 300 }),
      transform: [{ scale: withTiming(show ? 1 : 0, { duration: 300 }) }],
    };
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' | 'destructive' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const scrollSync = useSharedValue(0);

  useEffect(() => {
    scrollSync.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2000 }),
        withTiming(1, { duration: 5000, easing: Easing.linear }),
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 5000, easing: Easing.linear })
      ),
      -1,
      false
    );
  }, []);

  const { todaysViolations, todaysScreenings, allViolations, allScreenings } = useMemo(() => {
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayPrefix = `${localYear}-${localMonth}-${localDay}`;
  
    const isToday = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      if (dateStr.startsWith(todayPrefix)) return true;
  
      // Fallback to standard parsing without forcing UTC, which can shift dates to yesterday
      // replace(" ", "T") ensures compatibility with iOS for "YYYY-MM-DD HH:MM:SS" format
      const d = new Date(dateStr.replace(" ", "T"));
  
      if (isNaN(d.getTime())) return false;
  
      return d.toDateString() === now.toDateString();
    };
  
    const vSourceRaw = localViolations.length > 0 ? localViolations : (violations || []);
    const vSource = vSourceRaw.filter(v => !dismissedViolationIds.has(Number(v.id)));
    const sSource = screenings || [];
  
    return { 
      todaysViolations: vSource.filter(v => isToday(v.date || (v as any).created_at)), 
      todaysScreenings: sSource.filter(s => isToday(s.date || (s as any).created_at)),
      allViolations: vSource,
      allScreenings: sSource
    };
  }, [violations, screenings, localViolations, dismissedViolationIds]);

  const localMetrics = useMemo(() => {
    return {
      violationsToday: Math.max(metrics?.violationsToday || (metrics as any)?.violations_today || 0, todaysViolations.length),
      screeningsToday: Math.max(metrics?.screeningsToday || (metrics as any)?.screenings_today || 0, todaysScreenings.length)
    };
  }, [metrics, todaysViolations, todaysScreenings]);

  const [reviewed, dispatchReviewed] = useReducer(
    (state: { screenings: boolean; violations: boolean }, action: "view_screenings" | "view_violations" | "reset_screenings" | "reset_violations") => {
      switch (action) {
        case "view_screenings": return { ...state, screenings: true };
        case "view_violations": return { ...state, violations: true };
        case "reset_screenings": return { ...state, screenings: false };
        case "reset_violations": return { ...state, violations: false };
        default: return state;
      }
    },
    { screenings: false, violations: false }
  );

  const handleDismissViolation = useCallback((id: number | string) => {
    setDismissedViolationIds(prev => {
      const next = new Set(prev);
      next.add(Number(id));
      return next;
    });
    showToast("Violation dismissed", "info");
  }, []);

  const handleDismissAllViolations = useCallback(() => {
    const list = modalViewMode === 'today' ? todaysViolations : allViolations;
    if (list.length === 0) return;

    showAlert({
      title: "Mark All as Read",
      message: `Are you sure you want to dismiss all ${list.length} violations?`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Dismiss All", 
          onPress: () => {
            setDismissedViolationIds(prev => {
              const next = new Set(prev);
              list.forEach(v => next.add(Number(v.id)));
              return next;
            });
            showToast("All violations dismissed", "info");
          }
        }
      ]
    });
  }, [modalViewMode, todaysViolations, allViolations, showAlert, showToast]);

  const handleSuspendUser = useCallback((userId: number) => {
    setUserToSuspend(userId);
    setSuspendModalVisible(true);
  }, []);

  const handleConfirmSuspension = useCallback(async (duration: number, reason: string) => {
    if (userToSuspend) {
      await suspendUser(userToSuspend, duration, reason);
      setSuspendModalVisible(false);
      setUserToSuspend(null);
      setModalType(null);
    }
  }, [userToSuspend, suspendUser]);

  const handleRemoveUser = useCallback((userId: number, userName: string) => {
    showAlert({
      title: "Remove User",
      message: `Are you sure you want to remove ${userName}?`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => {
            removeUser(userId);
            setModalType(null);
        }}
      ]
    });
  }, [removeUser, showAlert]);

  useEffect(() => {
    setModalSearchQuery("");
    setModalStartDate("");
    setModalEndDate("");
    setShowModalDateFilters(false);
  }, [modalType]);

  useEffect(() => {
    if (localMetrics.screeningsToday > 0 && reviewed.screenings) dispatchReviewed("reset_screenings");
  }, [localMetrics.screeningsToday, reviewed.screenings]);

  useEffect(() => {
    if (localMetrics.violationsToday > 0 && reviewed.violations) dispatchReviewed("reset_violations");
  }, [localMetrics.violationsToday, reviewed.violations]);

  const [health, setHealth] = useState<ExtendedHealth>({ backend: "Checking...", myphp: "Checking...", database: "Checking...", cpu: 0, memory: 0, disk: 0, dbLatency: 0, msgsPerMin: 0, avgMsgSize: 0 });

  const refreshRotation = useSharedValue(0);
  const animatedRefreshStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshRotation.value}deg` }],
  }));

  const liveActivityRotation = useSharedValue(0);
  const animatedLiveActivityStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${liveActivityRotation.value}deg` }],
  }));

  const fetchHealth = useCallback(async (showError = false) => {
    refreshRotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    try {
      const res = await axios.get(`${API_BASE_URL}/dashboard.php`);
      if (res.data && res.data.success) {
        setHealth({
          backend: "Connected",
          myphp: "Running",
          database: res.data.database === "OK" ? "OK" : "Down",
          cpu: Number(res.data.cpu) || 0,
          memory: Number(res.data.memory) || 0,
          disk: Number(res.data.disk) || 0,
          dbLatency: Number(res.data.db_latency) || 0,
          msgsPerMin: Number(res.data.msgs_per_min) || 0,
          avgMsgSize: Number(res.data.avg_msg_size) || 0
        });
      }
    } catch (error) {
      // If the request fails, the backend is likely down
      setHealth(prev => ({ ...prev, backend: "Disconnected", myphp: "Stopped", database: "Unknown" }));
      if (showError) showToast("Failed to refresh system health", "error");
    } finally {
      cancelAnimation(refreshRotation);
      refreshRotation.value = 0;
    }
  }, [showToast]);

  useEffect(() => {
    const interval = setInterval(fetchHealth, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const autoRefreshRotation = useSharedValue(0);
  const animatedAutoRefreshStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${autoRefreshRotation.value}deg` }],
  }));

  useEffect(() => {
    if (isAutoRefreshing || loadingUsers) {
      autoRefreshRotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(autoRefreshRotation);
      autoRefreshRotation.value = 0;
    }
  }, [isAutoRefreshing, loadingUsers]);

  // --- New Registered Users Logic ---
  const [newUsers, setNewUsers] = useState<any[]>([]);
  
  const fetchNewUsers = useCallback(async (showError = false) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/users.php?fetch_recent_users=1&limit=5`);
      if (res.data.success && Array.isArray(res.data.users)) {
        setNewUsers(res.data.users.map((u: any) => ({ ...u, id: Number(u.id) })));
      } else {
        setNewUsers([]);
      }
    } catch (e) {
      console.error("Failed to fetch new users", e);
      setNewUsers([]);
      if (showError) showToast("Failed to fetch new users", "error");
    }
  }, [showToast]);

  const fetchReports = useCallback(async (showError = false) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/reports.php`);
      if (res.data && res.data.success && Array.isArray(res.data.reports)) {
        const mapped = res.data.reports
          .filter((r: any) => r.status !== 'pending')
          .map((r: any) => ({
            id: Number(r.id),
            userId: Number(r.reported_user_id),
            userName: r.reported_user_name || 'Unknown',
            type: r.report_type,
            date: r.created_at,
            reason: r.reason,
            reporter: r.reporter_name
          }));
        setLocalViolations(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch reports", e);
      if (showError) showToast("Failed to fetch reports", "error");
    }
  }, [showToast]);

  // --- Recent Admin Logs Logic ---
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [fullLogs, setFullLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = useCallback(async (limit = 5, targetSetter = setRecentLogs, showError = false) => {
    try {
      if (limit > 5) setLoadingLogs(true);
      const res = await axios.get(`${API_BASE_URL}/users.php?fetch_recent_logs=1&limit=${limit}`);
      if (res.data.success && Array.isArray(res.data.logs)) {
        targetSetter(res.data.logs.map((l: any) => ({ ...l, id: Number(l.id) })));
      } else {
        targetSetter([]);
        if (showError || limit > 5) {
          showToast("Failed to fetch logs", "error");
        }
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
      targetSetter([]);
      if (showError || limit > 5) showToast("Failed to fetch logs", "error");
    } finally {
      if (limit > 5) setLoadingLogs(false);
    }
  }, [showToast]);

  const refreshLiveActivity = useCallback(async () => {
    liveActivityRotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    try {
      await Promise.all([
        fetchLogs(5, setRecentLogs, true),
        fetchNewUsers(true),
        fetchReports(true)
      ]);
    } finally {
      cancelAnimation(liveActivityRotation);
      liveActivityRotation.value = 0;
    }
  }, [fetchLogs, fetchNewUsers, fetchReports]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchHealth(true), 
      fetchLogs(5, setRecentLogs, true), 
      fetchNewUsers(true),
      fetchReports(true),
      refreshData ? refreshData() : Promise.resolve()
    ]);
    setIsRefreshing(false);
  }, [fetchHealth, fetchLogs, fetchNewUsers, fetchReports, refreshData]);

  useFocusEffect(
    useCallback(() => {
      fetchHealth();
      fetchLogs(5, setRecentLogs);
      fetchNewUsers();
      fetchReports();
      if (refreshData) refreshData();
    }, [fetchHealth, fetchLogs, fetchNewUsers, fetchReports, refreshData])
  );

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchHealth(), 
        fetchLogs(5, setRecentLogs), 
        fetchNewUsers(),
        fetchReports(),
        refreshData ? refreshData() : Promise.resolve()
      ]);
      setIsLoading(false);
    };
    init();

    // Keep polling for health status
    const interval = setInterval(async () => {
      setIsAutoRefreshing(true);
      await Promise.all([
        fetchLogs(5, setRecentLogs),
        fetchNewUsers(),
        fetchReports(),
        refreshData ? refreshData() : Promise.resolve()
      ]);
      setIsAutoRefreshing(false);
    }, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchLogs, fetchNewUsers, fetchHealth, fetchReports, refreshData]);

  const onLogsPress = useCallback(() => {
    setLogSearchTerm('');
    setLogStartDate('');
    setLogEndDate('');
    setLogsModalVisible(true);
    fetchLogs(50, setFullLogs);
  }, [fetchLogs]);
  const onUsersPress = useCallback(() => navigation.navigate("Users"), [navigation]);
  const onReportsPress = useCallback(() => navigation.navigate("Reports"), [navigation]);

  const handleDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date, type?: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      if (type === 'start') setShowStartDatePicker(false);
      if (type === 'end') setShowEndDatePicker(false);
    }

    if (event.type === 'dismissed') return;

    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      if (type === 'start') setLogStartDate(formatted);
      if (type === 'end') setLogEndDate(formatted);
    }
  }, []);

  const handleModalDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date, type?: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      if (type === 'start') setShowModalStartDatePicker(false);
      if (type === 'end') setShowModalEndDatePicker(false);
    }

    if (event.type === 'dismissed') return;

    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      if (type === 'start') setModalStartDate(formatted);
      if (type === 'end') setModalEndDate(formatted);
      setModalViewMode('all');
    }
  }, []);

  const liveActiveUsers = useMemo(() => users.filter(u => u.status === 'active').length, [users]);
  const liveSuspendedUsers = useMemo(() => users.filter(u => u.status === 'suspended').length, [users]);

  const healthItems = useMemo(() => [
    { label: "Backend", value: health.backend }, 
    { label: "Database", value: health.database }, 
    { label: "DB Latency", value: `${health.dbLatency}ms` }
  ], [health.backend, health.database, health.dbLatency]);
  
  const recentFlagged = useMemo(() => violations.slice(-5).reverse(), [violations]);

  const filteredLogs = useMemo(() => fullLogs.filter(log => {
    const searchTerm = logSearchTerm.toLowerCase();
    const matchesSearch = !logSearchTerm || (
      (log.admin_name || '').toLowerCase().includes(searchTerm) ||
      (log.action || '').toLowerCase().includes(searchTerm) ||
      (log.target_name || '').toLowerCase().includes(searchTerm) ||
      (log.reason || '').toLowerCase().includes(searchTerm) ||
      (log.created_at || '').toLowerCase().includes(searchTerm)
    );

    if (!matchesSearch) return false;

    const logTime = new Date(log.created_at.replace(" ", "T")).getTime();
    if (logStartDate) {
      const startTime = new Date(logStartDate).getTime();
      if (!isNaN(startTime) && logTime < startTime) return false;
    }
    if (logEndDate) {
      const endDate = new Date(logEndDate);
      endDate.setHours(23, 59, 59, 999);
      const endTime = endDate.getTime();
      if (!isNaN(endTime) && logTime > endTime) return false;
    }
    return true;
  }), [fullLogs, logSearchTerm, logStartDate, logEndDate]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <View style={{ flex: 1 }}>
    <Animated.ScrollView 
      ref={scrollViewRef}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.panelCard, { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0, padding: 0 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Live Metrics</Text>
          {(isAutoRefreshing || loadingUsers) && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: COLORS.textLight, marginRight: 6 }}>Refreshing...</Text>
              <Animated.View style={animatedAutoRefreshStyle}>
                <Ionicons name="sync" size={14} color={COLORS.primary} />
              </Animated.View>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <SummaryCard icon="checkmark-circle-outline" color={COLORS.success} textColor={COLORS.textWhite} title="Active Users" value={liveActiveUsers} onPress={() => navigation.navigate("Users", { filter: "active" })} />
          <SummaryCard icon="ban-outline" color={COLORS.danger} textColor={COLORS.textWhite} title="Suspended" value={liveSuspendedUsers} onPress={() => navigation.navigate("Users", { filter: "suspended" })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <SummaryCard title="Msgs/min" value={health.msgsPerMin} icon="speedometer-outline" color={COLORS.surface} textColor={COLORS.text} />
          <SummaryCard title="Avg Msg Size" value={`${health.avgMsgSize} B`} icon="document-text-outline" color={COLORS.surface} textColor={COLORS.text} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ScrollableSummaryCard scrollSync={scrollSync} title="Screenings Today" value={localMetrics.screeningsToday} icon="shield-checkmark-outline" color="#FFF3E0" textColor="#E65100" onPress={() => { setModalType("screenings"); setModalViewMode('today'); dispatchReviewed("view_screenings"); }} badgeVisible={!reviewed.screenings && localMetrics.screeningsToday > 0} />
          <ScrollableSummaryCard scrollSync={scrollSync} title="Violations Today" value={localMetrics.violationsToday} icon="alert-circle-outline" color="#FDEDEC" textColor="#C62828" onPress={() => { setModalType("violations"); setModalViewMode('today'); dispatchReviewed("view_violations"); }} badgeVisible={!reviewed.violations && localMetrics.violationsToday > 0} />
        </View>
      </View>

      <QuickActions onUsersPress={onUsersPress} onReportsPress={onReportsPress} onLogsPress={onLogsPress} />

      <Modal transparent visible={!!modalType} animationType="fade" onRequestClose={() => setModalType(null)} onShow={() => setTimeout(() => modalSearchInputRef.current?.focus(), 100)}>
        <TouchableWithoutFeedback onPress={(e: GestureResponderEvent) => e.target === e.currentTarget && setModalType(null)}>
          <View style={styles.modalBackdrop}>
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
              <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 12 }}>
                {modalType === "screenings" 
                  ? (modalViewMode === 'today' ? "Screenings Today" : "All Recent Screenings") 
                  : (modalViewMode === 'today' ? "Violations Today" : "All Recent Violations")}
              </Text>
              <View style={styles.modalSearchContainer}>
                <Ionicons name="search" size={18} color={COLORS.textLight} style={styles.modalSearchIcon} />
                <TextInput
                  ref={modalSearchInputRef}
                  style={styles.modalSearchInput}
                  placeholder="Search by username..."
                  placeholderTextColor={COLORS.textLight}
                  value={modalSearchQuery}
                  onChangeText={setModalSearchQuery}
                />
                {modalSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setModalSearchQuery("")} style={{ marginRight: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowModalDateFilters(!showModalDateFilters)}>
                  <Ionicons name={showModalDateFilters ? "calendar" : "calendar-outline"} size={20} color={showModalDateFilters ? COLORS.primary : COLORS.textLight} />
                </TouchableOpacity>
              </View>
              {showModalDateFilters && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 2 }}>
                <TouchableOpacity onPress={() => setShowModalStartDatePicker(true)} style={{ flex: 1, height: 36, justifyContent: 'center', backgroundColor: COLORS.borderLighter, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.borderLight }}>
                  <Text style={{ color: modalStartDate ? COLORS.text : COLORS.textLight, fontSize: 12 }}>{modalStartDate || "Start Date"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowModalEndDatePicker(true)} style={{ flex: 1, height: 36, justifyContent: 'center', backgroundColor: COLORS.borderLighter, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.borderLight }}>
                  <Text style={{ color: modalEndDate ? COLORS.text : COLORS.textLight, fontSize: 12 }}>{modalEndDate || "End Date"}</Text>
                </TouchableOpacity>
                {(modalStartDate || modalEndDate) && (
                   <TouchableOpacity onPress={() => { setModalStartDate(""); setModalEndDate(""); }} style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
                     <Ionicons name="close-circle-outline" size={20} color={COLORS.danger} />
                   </TouchableOpacity>
                )}
              </Animated.View>
              )}
              {modalType === 'violations' && ((modalViewMode === 'today' ? todaysViolations : allViolations).length > 0) && (
                 <TouchableOpacity onPress={handleDismissAllViolations} style={{ alignSelf: 'flex-end', marginBottom: 10, paddingHorizontal: 4 }}>
                   <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 13 }}>Mark All as Read</Text>
                 </TouchableOpacity>
              )}
              {showModalStartDatePicker && (
                <DateTimePicker
                  value={modalStartDate ? new Date(modalStartDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => handleModalDateChange(e, d, 'start')}
                  style={Platform.OS === 'ios' ? { marginBottom: 10 } : undefined}
                />
              )}
              {showModalEndDatePicker && (
                <DateTimePicker
                  value={modalEndDate ? new Date(modalEndDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => handleModalDateChange(e, d, 'end')}
                  style={Platform.OS === 'ios' ? { marginBottom: 10 } : undefined}
                />
              )}
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 20 }}>
                {(() => {
                  let list = modalType === "screenings" 
                    ? (modalViewMode === 'today' ? todaysScreenings : allScreenings)
                    : (modalViewMode === 'today' ? todaysViolations : allViolations);
                  
                  if (modalSearchQuery) {
                    list = list.filter(item => (item.userName || '').toLowerCase().includes(modalSearchQuery.toLowerCase()));
                  }

                  if (modalStartDate || modalEndDate) {
                    list = list.filter(item => {
                      const dStr = (item as any).date || (item as any).created_at;
                      if (!dStr) return false;
                      const itemTime = new Date(dStr.replace(" ", "T")).getTime();
                      
                      if (modalStartDate) {
                        const startTime = new Date(modalStartDate).getTime();
                        if (!isNaN(startTime) && itemTime < startTime) return false;
                      }
                      
                      if (modalEndDate) {
                        const endDate = new Date(modalEndDate);
                        endDate.setHours(23, 59, 59, 999);
                        const endTime = endDate.getTime();
                        if (!isNaN(endTime) && itemTime > endTime) return false;
                      }
                      
                      return true;
                    });
                  }

                  if (list.length > 0) {
                    return list.map((item, idx) => (
                    <View key={idx} style={{ backgroundColor: modalType === "violations" ? "#FDEDEC" : "#FFF3E0", padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: modalType === "violations" ? "#E74C3C" : "#F39C12" }}>
                      <Text style={{ fontWeight: "600" }}>{(item as any).userName}</Text>
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                        {`Type: ${(item as any).type || (item as any).report_type}`}
                        {modalType === "violations" && (item as any).reporter ? ` | Reported by: ${(item as any).reporter}` : ''}
                        {` | Date: ${(item as any).date || (item as any).created_at || 'N/A'}`}
                      </Text>
                      {(item as any).reason && <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", marginTop: 4 }}>"{(item as any).reason}"</Text>}
                      {modalType === "screenings" && (item as any).screeningDetails && (
                        <View style={{ marginTop: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textSecondary, marginBottom: 2 }}>AI Analysis:</Text>
                          {Object.entries((item as any).screeningDetails).map(([k, v]) => {
                             if (typeof v === 'number' && v > 0.5 && k !== 'is_flagged') {
                               return <Text key={k} style={{ fontSize: 11, color: COLORS.danger }}>• {k.replace('_', ' ')}: {(v * 100).toFixed(0)}%</Text>;
                             }
                             return null;
                          })}
                        </View>
                      )}
                      {modalType === "violations" && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{ alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.danger }}
                            onPress={() => {
                              showAlert({
                                title: "Review User",
                                message: `Are you sure you want to review ${(item as any).userName}?`,
                                buttons: [
                                  { text: "Cancel", style: "cancel" },
                                  { 
                                    text: "Review", 
                                    onPress: () => {
                                      setModalType(null);
                                      navigation.navigate("Users", { userId: (item as any).userId });
                                    }
                                  }
                                ]
                              });
                            }}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.danger, fontWeight: '600' }}>Review User</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.warning }}
                            onPress={() => handleSuspendUser((item as any).userId)}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.warning, fontWeight: '600' }}>Suspend</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.danger }}
                            onPress={() => handleRemoveUser((item as any).userId, (item as any).userName)}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.danger, fontWeight: '600' }}>Remove</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.textLight }}
                            onPress={() => handleDismissViolation((item as any).id)}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' }}>Dismiss</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    ));
                  } else {
                    return <Text style={styles.emptyStateText}>No {modalType === 'screenings' ? 'screenings' : 'violations'} recorded {modalViewMode === 'today' ? 'today' : ''}.</Text>;
                  }
                })()}
                
                <TouchableOpacity 
                  style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderLight }}
                  onPress={() => setModalViewMode(prev => prev === 'today' ? 'all' : 'today')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14, marginRight: 4 }}>
                      {modalViewMode === 'today' ? "View All History" : "Show Today Only"}
                    </Text>
                    <Ionicons name={modalViewMode === 'today' ? "time-outline" : "today-outline"} size={16} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PanelCard title="System Health" onPress={() => fetchHealth(true)} headerRight={<Animated.View style={animatedRefreshStyle}><Ionicons name="sync" size={20} color={COLORS.primary} /></Animated.View>}>
        <View style={styles.healthGrid}>
          {healthItems.map((item, index) => {
            const status = parseStatus(item.value);
            return (
              <View key={index} style={styles.healthGridItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><View style={[styles.healthStatusDot, { backgroundColor: STATUS_COLORS[status.key] }]} /><Text style={styles.healthLabel}>{item.label}</Text></View>
                <Text style={styles.healthStatus} numberOfLines={1}>{status.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: 16 }}><View style={styles.healthUsageRow}><Text style={styles.healthLabel}>CPU Usage</Text><Text style={{ color: getUsageColor(health.cpu), fontWeight: '600' }}>{health.cpu}%</Text></View><ProgressBar progress={health.cpu} color={getUsageColor(health.cpu)} /></View>
        <View style={{ marginTop: 12 }}><View style={styles.healthUsageRow}><Text style={styles.healthLabel}>Memory Usage</Text><Text style={{ color: getUsageColor(health.memory), fontWeight: '600' }}>{health.memory}%</Text></View><ProgressBar progress={health.memory} color={getUsageColor(health.memory)} /></View>
        <View style={{ marginTop: 12 }}><View style={styles.healthUsageRow}><Text style={styles.healthLabel}>Disk Usage</Text><Text style={{ color: getUsageColor(health.disk), fontWeight: '600' }}>{health.disk}%</Text></View><ProgressBar progress={health.disk} color={getUsageColor(health.disk)} /></View>
      </PanelCard>

      <PanelCard title="Live Activity" onPress={refreshLiveActivity} headerRight={<Animated.View style={animatedLiveActivityStyle}><Ionicons name="sync" size={20} color={COLORS.primary} /></Animated.View>}>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 }}>
          <TouchableOpacity onPress={() => setActivityTab('newUsers')} style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activityTab === 'newUsers' ? COLORS.primary : 'transparent' }}>
            <Text style={{ textAlign: 'center', fontWeight: '600', color: activityTab === 'newUsers' ? COLORS.primary : COLORS.textLight }}>New Users</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActivityTab('adminActions')} style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activityTab === 'adminActions' ? COLORS.primary : 'transparent' }}>
            <Text style={{ textAlign: 'center', fontWeight: '600', color: activityTab === 'adminActions' ? COLORS.primary : COLORS.textLight }}>Admin Actions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActivityTab('flaggedActivity')} style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activityTab === 'flaggedActivity' ? COLORS.primary : 'transparent' }}>
            <Text style={{ textAlign: 'center', fontWeight: '600', color: activityTab === 'flaggedActivity' ? COLORS.primary : COLORS.textLight }}>Flagged</Text>
          </TouchableOpacity>
        </View>

        <View style={{ minHeight: 300 }}>
          {activityTab === 'newUsers' && (
            newUsers.length > 0 ? (
              newUsers.map((user, index) => {
                if (!user) return null;
                return (
                <LiveActivityItem
                  key={user.id || index}
                  icon="person-add-outline"
                  iconColor={COLORS.success}
                  iconBgColor="rgba(46, 204, 113, 0.1)"
                  title={user.username || 'Unknown'}
                  subtitle={getTimeAgo(user.created_at)}
                  onPress={() => {
                    const userItem = {
                      id: user.id,
                      name: user.username || 'Unknown',
                      status: 'active', // New users are active by default
                      joinedDate: user.created_at || new Date().toISOString(),
                    };
                    navigation.navigate("Users", { userId: user.id, userObject: userItem });
                  }}
                />
              )})
            ) : (
              <Text style={styles.emptyStateText}>No new users found.</Text>
            )
          )}

          {activityTab === 'adminActions' && (
            recentLogs.length > 0 ? (
              recentLogs.map((log, index) => {
                if (!log) return null;
                return (
                <LiveActivityItem
                  key={index}
                  icon="construct-outline"
                  iconColor={COLORS.textSecondary}
                  iconBgColor="rgba(0,0,0,0.05)"
                  title={
                    <Text style={styles.flaggedItemUser} numberOfLines={2}>
                      <Text style={{fontWeight: 'bold'}}>{log.admin_name || 'Unknown'}</Text>
                      <Text> {log.action || 'Action'} </Text>
                      <Text style={{fontWeight: 'bold'}}>{log.target_name || 'N/A'}</Text>
                    </Text>
                  }
                  subtitle={getTimeAgo(log.created_at)}
                  tag={log.resulting_status || 'N/A'}
                  tagColor={log.resulting_status === 'active' ? COLORS.success : COLORS.danger}
                  onPress={() => {
                    setLogSearchTerm(log.target_name || log.admin_name || '');
                    setLogStartDate('');
                    setLogEndDate('');
                    setLogsModalVisible(true);
                    fetchLogs(50, setFullLogs);
                  }}
                />
              )})
            ) : (
              <Text style={styles.emptyStateText}>No recent actions recorded.</Text>
            )
          )}

          {activityTab === 'flaggedActivity' && (
            recentFlagged.length > 0 ? (
              recentFlagged.map((item, index) => {
                if (!item) return null;
                const type = item.type || 'Unknown';
                const violationColors: Record<string, string> = { spam: COLORS.danger, offensive: COLORS.warning, harassment: "#9B59B6" };
                const tagColor = violationColors[type.toLowerCase()] || '#555';
                return (
                  <LiveActivityItem
                    key={item.id || index}
                    icon="person-circle-outline"
                    iconColor={COLORS.textSecondary}
                    iconBgColor="rgba(0,0,0,0.05)"
                    title={item.userName || 'Unknown User'}
                    subtitle={item.date || 'N/A'}
                    tag={type}
                    tagColor={tagColor}
                    onPress={() => navigation.navigate("Users", { userId: item.userId })}
                  />
                );
              })
            ) : (
              <Text style={styles.emptyStateText}>No recent violations found.</Text>
            )
          )}
        </View>
      </PanelCard>

      {/* Admin Logs Modal */}
      <Modal transparent visible={logsModalVisible} animationType="fade" onRequestClose={() => setLogsModalVisible(false)} onShow={() => { setShowDateFilters(false); setTimeout(() => logSearchInputRef.current?.focus(), 100); }}>
        <TouchableWithoutFeedback onPress={(e: GestureResponderEvent) => e.target === e.currentTarget && setLogsModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
              <TouchableOpacity onPress={() => setLogsModalVisible(false)} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
              <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 12 }}>Admin Action History</Text>
              <View style={styles.modalSearchContainer}>
                <Ionicons name="search" size={18} color={COLORS.textLight} style={styles.modalSearchIcon} />
                <TextInput
                  ref={logSearchInputRef}
                  style={styles.modalSearchInput}
                  placeholder="Search by admin, action, target..."
                  placeholderTextColor={COLORS.textLight}
                  value={logSearchTerm}
                  onChangeText={setLogSearchTerm}
                />
                {logSearchTerm.length > 0 && (
                  <TouchableOpacity onPress={() => setLogSearchTerm("")} style={{ marginRight: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowDateFilters(!showDateFilters)}>
                  <Ionicons name={showDateFilters ? "calendar" : "calendar-outline"} size={20} color={showDateFilters ? COLORS.primary : COLORS.textLight} />
                </TouchableOpacity>
              </View>
              {showDateFilters && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={[styles.modalSearchContainer, { flex: 1, marginBottom: 0 }]}>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={{ flex: 1, height: 40, justifyContent: 'center' }}>
                    <Text style={{ color: logStartDate ? COLORS.text : COLORS.textLight }}>{logStartDate || "Start Date"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.modalSearchContainer, { flex: 1, marginBottom: 0 }]}>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={{ flex: 1, height: 40, justifyContent: 'center' }}>
                    <Text style={{ color: logEndDate ? COLORS.text : COLORS.textLight }}>{logEndDate || "End Date"}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
              )}
              {showStartDatePicker && (
                <DateTimePicker
                  value={logStartDate ? new Date(logStartDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'start')}
                  style={Platform.OS === 'ios' ? { marginBottom: 10 } : undefined}
                />
              )}
              {showEndDatePicker && (
                <DateTimePicker
                  value={logEndDate ? new Date(logEndDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => handleDateChange(e, d, 'end')}
                  style={Platform.OS === 'ios' ? { marginBottom: 10 } : undefined}
                />
              )}
              {(showStartDatePicker || showEndDatePicker) && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => { setShowStartDatePicker(false); setShowEndDatePicker(false); }} style={{ alignSelf: 'flex-end', marginBottom: 10, padding: 8 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
              )}
              {(logStartDate || logEndDate) ? (
                <TouchableOpacity
                  onPress={() => {
                    setLogSearchTerm('');
                    setLogStartDate('');
                    setLogEndDate('');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 12, backgroundColor: COLORS.borderLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                >
                  <Ionicons name="close" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={{ color: COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>Clear Filters</Text>
                </TouchableOpacity>
              ) : null}
              <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ paddingBottom: 20 }}>
                {loadingLogs ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
                  filteredLogs.length > 0 ? filteredLogs.map((log, index) => (
                    <View key={log.id || index} style={{ backgroundColor: COLORS.surfaceAlt, padding: 12, borderRadius: 10, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: log.resulting_status === 'active' ? COLORS.success : COLORS.danger }}>
                      <LogDetailItem label="Action" value={log.action} valueStyle={{ fontWeight: 'bold' }} />
                      <LogDetailItem label="Admin" value={log.admin_name || 'Unknown'} />
                      <LogDetailItem label="Target" value={log.target_name || 'N/A'} />
                      <LogDetailItem label="Timestamp" value={log.created_at} />
                      <LogDetailItem label="Reason" value={log.reason} valueStyle={{ fontStyle: 'italic' }} />
                    </View>
                  )) : <Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 20 }}>{fullLogs.length > 0 ? 'No results found.' : 'No logs found.'}</Text>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Animated.ScrollView>

    <Animated.View style={[styles.scrollToTopButton, scrollToTopStyle]}>
      <TouchableOpacity onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="arrow-up" size={24} color={COLORS.textWhite} />
      </TouchableOpacity>
    </Animated.View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast(prev => ({ ...prev, visible: false }))} />
      <SuspendUserModal visible={suspendModalVisible} onClose={() => setSuspendModalVisible(false)} onSubmit={handleConfirmSuspension} />
    </View>
  );
});

export default DashboardTab;
