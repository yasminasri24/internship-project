// app/sadmin_tabs/UsersTab.tsx
import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, TextInput, Pressable, Modal, TouchableWithoutFeedback, ScrollView, ActivityIndicator, StyleSheet, Platform, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming, useAnimatedScrollHandler, withSequence, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { styles, COLORS } from "../../lib/sadmin_tabs/styles";
import axios from "axios";
import { API_BASE_URL } from "../../lib/apiConfig";
import { UserItem, Violation, Screening, useDashboardContext, useAlert, ModerationLog } from "../../lib/sadmin_tabs/common";
import { useRoute, useNavigation, EventArg, NavigationAction } from "@react-navigation/native";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { UsersSkeleton } from "../../lib/sadmin_tabs/SkeletonLoader";
import { SummaryCard, SuspendUserModal, Toast } from "../../lib/sadmin_tabs/SharedComponents";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from 'expo-clipboard';

// --- User Management Components --- //

const PaginationDot: React.FC<{ active: boolean }> = memo(({ active }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(active ? 16 : 6, { duration: 300 }),
      backgroundColor: withTiming(active ? COLORS.primary : '#D1D1D6', { duration: 300 }),
      opacity: withTiming(active ? 1 : 0.6, { duration: 300 }),
    };
  });

  return (
    <Animated.View style={[{ height: 6, borderRadius: 3, marginHorizontal: 4 }, animatedStyle]} />
  );
});

const UserCard: React.FC<{
  user: UserItem;
  violations: Violation[];
  screenings: Screening[];
  search: string;
  onPress: () => void;
  selected: boolean;
  onLongPress: () => void;
  onSuspend: (userId: number) => void;
  onLiftSuspension: (userId: number) => void;
  onRemove: (userId: number) => void;
  highlighted?: boolean;
}> = memo(({ user, violations, screenings, search, onPress, selected, onLongPress, onSuspend, onLiftSuspension, onRemove, highlighted }) => {
  const userName = user?.name || 'Unknown User';
  const userStatus = user?.status || 'unknown';
  const userId = user?.id;

  const highlightName = useMemo(() => {
    if (!search) return <Text>{userName}</Text>;
    return userName.split(new RegExp(`(${search})`, "gi")).map((part, i) => (
      <Text key={i} style={{ backgroundColor: part.toLowerCase() === search.toLowerCase() ? "#FFD700" : "transparent" }}>{part}</Text>
    ));
  }, [userName, search]);

  const matchedDetails = useMemo(() => {
    if (!search) return null;
    const lowerSearch = search.toLowerCase();
    const matches: React.ReactNode[] = [];

    const highlightText = (text: string, prefix: string, key: string) => (
      <Text key={key} style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 2 }} numberOfLines={1}>
        <Text style={{ fontWeight: 'bold' }}>{prefix}: </Text>
        {text.split(new RegExp(`(${search})`, "gi")).map((part, i) => (
          <Text key={i} style={{ backgroundColor: part.toLowerCase() === lowerSearch ? "#FFD700" : "transparent" }}>{part}</Text>
        ))}
      </Text>
    );

    violations.forEach(v => {
      if (v.type && v.type.toLowerCase().includes(lowerSearch)) matches.push(highlightText(v.type, "Violation", `v-${v.id}`));
      else if ((v as any).reason && (v as any).reason.toLowerCase().includes(lowerSearch)) matches.push(highlightText((v as any).reason, "Violation Reason", `vr-${v.id}`));
    });

    screenings.forEach(s => {
      if (s.type && s.type.toLowerCase().includes(lowerSearch)) matches.push(highlightText(s.type, "Screening", `s-${s.id}`));
      else if ((s as any).reason && (s as any).reason.toLowerCase().includes(lowerSearch)) matches.push(highlightText((s as any).reason, "Screening Reason", `sr-${s.id}`));
      else if (s.result && s.result.toLowerCase().includes(lowerSearch)) matches.push(highlightText(s.result, "Screening Result", `sres-${s.id}`));
    });

    return matches.slice(0, 2);
  }, [violations, screenings, search]);

  const animatedValue = useSharedValue(selected ? 1 : 0);
  const swipeableRef = useRef<Swipeable>(null);
  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlighted) {
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 1000 })
      );
    }
  }, [highlighted]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  useEffect(() => {
    animatedValue.value = withTiming(selected ? 1 : 0, { duration: 200 });
  }, [selected]);

  const outlineColor = userStatus === 'active' ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)';

  const animatedCardStyle = useAnimatedStyle(() => {
    const borderColor = animatedValue.value === 1 ? COLORS.primary : outlineColor;
    return { borderColor, borderWidth: 1 };
  }, [outlineColor]);

  const renderRightActions = useCallback(() => {
    const isSuspended = userStatus === 'suspended';
    
    const handleSuspend = () => {
      swipeableRef.current?.close();
      if (userId) onSuspend(userId);
    };

    const handleLiftSuspension = () => {
      swipeableRef.current?.close();
      if (userId) onLiftSuspension(userId);
    };

    const handleRemove = () => {
      swipeableRef.current?.close();
      if (userId) onRemove(userId);
    };

    return (
      <View style={{ flexDirection: 'row', width: 160, borderTopRightRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' }}>
        <TouchableOpacity
          onPress={isSuspended ? handleLiftSuspension : handleSuspend}
          style={{
            flex: 1,
            backgroundColor: isSuspended ? COLORS.success : COLORS.warning,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel={isSuspended ? "Lift Suspension" : "Suspend User"}
          accessibilityHint={isSuspended ? `Lift suspension for ${userName}` : `Suspend ${userName}`}
        >
          <Ionicons name={isSuspended ? 'checkmark-circle-outline' : 'ban-outline'} size={24} color={COLORS.textWhite} />
          <Text style={{ color: COLORS.textWhite, fontSize: 12, fontWeight: '600', marginTop: 4 }}>{isSuspended ? 'Lift' : 'Suspend'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRemove}
          style={{
            flex: 1,
            backgroundColor: COLORS.danger,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Remove User"
          accessibilityHint={`Permanently remove ${userName}`}
        >
          <Ionicons name="trash-outline" size={24} color={COLORS.textWhite} />
          <Text style={{ color: COLORS.textWhite, fontSize: 12, fontWeight: '600', marginTop: 4 }}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  }, [userStatus, userId, userName, onSuspend, onLiftSuspension, onRemove]);

  if (!user) return null;

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} friction={2} rightThreshold={40} containerStyle={{ overflow: 'visible' }}>
      <Pressable 
        onPress={onPress} 
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${userName}, Status: ${userStatus}`}
        accessibilityHint="Double tap to view details. Swipe left for actions."
        accessibilityState={{ selected }}
      >
        {({ pressed }) => (
          <Animated.View style={[
              styles.userCard,
              {
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                elevation: 2,
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3
              },
              animatedCardStyle,
              { opacity: pressed ? 0.6 : 1 }
            ]}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255, 215, 0, 0.25)', borderRadius: 12 }, highlightStyle]} pointerEvents="none" />
            <View style={{ flex: 1, marginRight: 8 }}>
              <View>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{highlightName}</View>
                <Text style={[styles.userStatus, { color: userStatus === "active" ? COLORS.success : COLORS.danger, textTransform: 'capitalize' }]}>{userStatus}</Text>
                {matchedDetails}
              </View>
            </View>
            <View style={{ flexDirection: "row" }}>
              {violations.length > 0 && (<View style={[styles.userCardBadge, { backgroundColor: COLORS.danger }, selected && { opacity: 0.5 }]}><Ionicons name="alert-circle" size={14} color={COLORS.textWhite} /></View>)}
              {screenings.length > 0 && (<View style={[styles.userCardBadge, { backgroundColor: COLORS.warning }, selected && { opacity: 0.5 }]}><Ionicons name="shield-checkmark" size={14} color={COLORS.textWhite} /></View>)}
            </View>
            {selected && (<Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(74, 144, 226, 0.2)", borderRadius: 12, justifyContent: "center", alignItems: "center" }]} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} />)}
          </Animated.View>
        )}
      </Pressable>
    </Swipeable>
  );
});

const UserModal: React.FC<{
  visible: boolean;
  user: UserItem | null;
  violations: Violation[];
  screenings: Screening[];
  moderationLogs: ModerationLog[];
  totalLogsCount: number;
  loadingLogs: boolean;
  logsError: boolean;
  onRetryLogs: () => void;
  onLoadMore: () => void;
  hasMoreLogs: boolean;
  loadingMoreLogs: boolean;
  onClose: () => void;
  onSuspend: (userId: number) => void;
  onLiftSuspension: (userId: number) => void;
  onRemove: (userId: number) => void;
  currentAdminName: string | null;
}> = memo(({ visible, user, violations, screenings, moderationLogs, totalLogsCount, loadingLogs, logsError, onRetryLogs, onLoadMore, hasMoreLogs, loadingMoreLogs, onClose, onSuspend, onLiftSuspension, onRemove, currentAdminName }) => {
  const userId = user?.id;
  const userViolations = useMemo(() => (user ? violations.filter(v => v.userId === user.id) : []), [violations, user]);
  const userScreenings = useMemo(() => (user ? screenings.filter(s => s.userId === user.id) : []), [screenings, user]);

  const showAlert = useAlert();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' | 'destructive' }>({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' | 'destructive' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !(prev[section] ?? true) }));
  }, []);

  const hasViolations = userViolations.length > 0;
  const hasScreenings = userScreenings.length > 0;
  const isSuspendedWithDetails = user?.status === 'suspended' && (user.suspensionReason || user.suspensionEndDate);
  const showCleanRecord = user && !hasViolations && !hasScreenings && user.status !== 'suspended';

  // Reset tab to overview when modal opens
  useEffect(() => {
    if (visible) {
      setActiveTab('overview');
      setLogSearchQuery("");
      setLogStartDate("");
      setLogEndDate("");
      setLogActionFilter("all");
      setShowDateFilters(false);
    }
  }, [visible]);

  const filteredLogs = useMemo(() => {
    let logs = moderationLogs;

    if (logActionFilter !== 'all') {
      logs = logs.filter(log => log.action === logActionFilter);
    }

    if (logSearchQuery) {
      const lowerQuery = logSearchQuery.toLowerCase();
      logs = logs.filter(log => 
        (log.action && log.action.toLowerCase().includes(lowerQuery)) ||
        (log.admin_name && log.admin_name.toLowerCase().includes(lowerQuery)) ||
        (log.reason && log.reason.toLowerCase().includes(lowerQuery))
      );
    }

    if (logStartDate || logEndDate) {
      logs = logs.filter(log => {
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
      });
    }
    return logs;
  }, [moderationLogs, logSearchQuery, logStartDate, logEndDate, logActionFilter]);

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

  const exportLogsToCSV = useCallback(async () => {
    if (!user || filteredLogs.length === 0) {
      showAlert({ title: "Export Error", message: "No logs to export.", buttons: [{ text: "OK" }] });
      return;
    }

    try {
      const headers = "Action,Admin,Target User,Date,Reason\n";
      const rows = filteredLogs.map(log => 
        `"${log.action}","${log.admin_name}","${user.name}","${log.created_at}","${log.reason || ''}"`
      ).join("\n");
      
      const csvContent = headers + rows;
      const filename = `moderation_logs_${(user.name || 'user').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, "text/csv");
          await FileSystem.writeAsStringAsync(uri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
          showToast("Logs exported successfully.", "success");
        }
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      console.error("Export error:", error);
      showAlert({ title: "Error", message: "Failed to export logs.", buttons: [{ text: "OK" }] });
    }
  }, [filteredLogs, user, showAlert, showToast]);

  if (!user) return null;

  const renderViolations = () => (
    <View>
      {userViolations.map(v => (
        <View key={`v-${v.id}`} style={[styles.modalListItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={styles.modalListItemText}>{v.type} on {v.date}</Text>
          </View>
          {(v as any).reason && <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginLeft: 24, marginTop: 2 }}>"{(v as any).reason}"</Text>}
        </View>
      ))}
    </View>
  );

  const renderScreenings = () => (
    <View>
      {userScreenings.map(s => (
        <View key={`s-${s.id}`} style={[styles.modalListItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: (s as any).screeningDetails ? 4 : 0 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.warning} style={{ marginRight: 8 }} />
            <Text style={styles.modalListItemText}>{s.type} - <Text style={{ color: s.result === 'passed' ? 'green' : 'orange' }}>{s.result}</Text> on {s.date}</Text>
          </View>
          {(s as any).screeningDetails && (
            <View style={{ paddingLeft: 24 }}>
              {Object.entries((s as any).screeningDetails).map(([k, v]) => (
                (typeof v === 'number' && v > 0.5 && k !== 'is_flagged') ? <Text key={k} style={{ fontSize: 11, color: COLORS.danger }}>• {k.replace('_', ' ')}: {(v * 100).toFixed(0)}%</Text> : null
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderSuspensionDetails = () => (
    <View>
      {user.suspensionReason ? <Text style={styles.modalListItemText}><Text style={{fontWeight: 'bold'}}>Reason:</Text> {user.suspensionReason}</Text> : null}
      {user.suspensionEndDate ? <Text style={styles.modalListItemText}><Text style={{fontWeight: 'bold'}}>Ends on:</Text> {user.suspensionEndDate}</Text> : null}
    </View>
  );

  const renderLogs = () => {
    if (loadingLogs) {
      return <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20, alignSelf: 'center' }} />;
    }

    if (logsError) {
      return (
        <View style={styles.emptyListContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={COLORS.danger} />
          <Text style={[styles.emptyStateText, { color: COLORS.danger, marginBottom: 12 }]}>Failed to load logs.</Text>
          <TouchableOpacity 
            onPress={onRetryLogs} 
            style={{ 
              backgroundColor: COLORS.primary, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Ionicons name="refresh" size={16} color={COLORS.textWhite} style={{ marginRight: 6 }} />
            <Text style={{ color: COLORS.textWhite, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (moderationLogs.length === 0) {
      return (
        <View style={styles.emptyListContainer}>
          <Ionicons name="archive-outline" size={24} color={COLORS.textLight} />
          <Text style={styles.emptyStateText}>No moderation history found.</Text>
        </View>
      );
    }

    return (
      <View style={[styles.modalSection, { flex: 1 }]}>
        <View style={styles.modalSearchContainer}>
          <Ionicons name="search" size={16} color={COLORS.textLight} style={styles.modalSearchIcon} />
          <TextInput 
            style={styles.modalSearchInput}
            placeholder="Search logs..." 
            placeholderTextColor={COLORS.textLight}
            value={logSearchQuery} 
            onChangeText={setLogSearchQuery} 
          />
          {logSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setLogSearchQuery("")} style={{ marginRight: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowDateFilters(!showDateFilters)}>
            <Ionicons name={showDateFilters ? "calendar" : "calendar-outline"} size={20} color={showDateFilters ? COLORS.primary : COLORS.textLight} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }}>
          {['all', 'suspend', 'unsuspend', 'remove'].map((action, index, arr) => (
            <TouchableOpacity
              key={action}
              onPress={() => setLogActionFilter(action)}
              style={[
                styles.filterButton,
                { height: 32, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' },
                logActionFilter === action ? styles.filterButtonActive : styles.filterButtonInactive,
                index === arr.length - 1 && { marginRight: 0 }
              ]}
            >
              <Text style={[styles.filterButtonText, logActionFilter === action ? styles.filterButtonTextActive : styles.filterButtonTextInactive]}>{action === 'all' ? 'All Actions' : action}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {showDateFilters && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={{ flex: 1, height: 32, justifyContent: 'center', backgroundColor: COLORS.borderLighter, borderRadius: 8, paddingHorizontal: 10 }}>
              <Text style={{ color: logStartDate ? COLORS.text : COLORS.textLight, fontSize: 12 }}>{logStartDate || "Start Date"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={{ flex: 1, height: 32, justifyContent: 'center', backgroundColor: COLORS.borderLighter, borderRadius: 8, paddingHorizontal: 10 }}>
              <Text style={{ color: logEndDate ? COLORS.text : COLORS.textLight, fontSize: 12 }}>{logEndDate || "End Date"}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
        {showStartDatePicker && (
          <DateTimePicker
            value={logStartDate ? new Date(logStartDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(e, d) => handleDateChange(e, d, 'start')}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={logEndDate ? new Date(logEndDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(e, d) => handleDateChange(e, d, 'end')}
          />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <TouchableOpacity onPress={exportLogsToCSV} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="download-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>Export CSV</Text>
          </TouchableOpacity>
          {(logStartDate || logEndDate || logActionFilter !== 'all') && (
            <TouchableOpacity onPress={() => { setLogSearchQuery(""); setLogStartDate(""); setLogEndDate(""); setLogActionFilter("all"); }}>
              <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={filteredLogs}
          keyExtractor={(item, index) => `${item.created_at}-${index}`}
          renderItem={({ item }) => {
            const isMe = currentAdminName && item.admin_name === currentAdminName;
            return (
              <View style={[styles.modalListItem, isMe && { backgroundColor: '#E3F2FD', borderColor: '#90CAF9', borderWidth: 1 }]}>
                <Ionicons name="clipboard-outline" size={16} color={isMe ? "#1976D2" : COLORS.textSecondary} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalListItemText}><Text style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{item.action}</Text> by {item.admin_name} {isMe ? <Text style={{fontWeight: 'bold', color: '#1976D2'}}>(You)</Text> : ''}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textDim }}>{item.created_at}</Text>
                  {item.reason && <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 2 }}>"{item.reason}"</Text>}
                </View>
                <TouchableOpacity onPress={() => {
                  const logDetails = `Action: ${item.action}\nAdmin: ${item.admin_name}\nTarget: ${user?.name}\nDate: ${item.created_at}\nReason: ${item.reason || 'N/A'}`;
                  Clipboard.setStringAsync(logDetails);
                  showToast("Log details copied to clipboard.", "success");
                }} style={{ padding: 8 }}>
                  <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            );
          }}
          onEndReached={() => { if (hasMoreLogs && !loadingMoreLogs) onLoadMore(); }}
          nestedScrollEnabled={true}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMoreLogs ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
          style={{ flex: 1 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 10, fontStyle: 'italic' }}>No logs match your search.</Text>}
        />
      </View>
    );
  };

  const renderOverview = () => (
    <View style={{ paddingHorizontal: 8, paddingVertical: 20 }}>
      {isSuspendedWithDetails && (
        <View style={{ backgroundColor: '#FFF3E0', borderColor: '#FFE0B2', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#E65100', marginBottom: 8 }}>Suspension Details</Text>
          {renderSuspensionDetails()}
        </View>
      )}

      {hasViolations && (
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => toggleSection('violations')}
          style={{ 
            marginBottom: 16, 
            backgroundColor: '#FDEDEC', 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: '#F5B7B1',
            overflow: 'hidden',
            elevation: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: (expandedSections['violations'] ?? true) ? 'rgba(231, 76, 60, 0.08)' : 'transparent', borderBottomWidth: (expandedSections['violations'] ?? true) ? 1 : 0, borderBottomColor: '#F5B7B1' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#C0392B' }}>Violations ({userViolations.length})</Text>
            <Ionicons name={(expandedSections['violations'] ?? true) ? "chevron-up" : "chevron-down"} size={20} color="#C0392B" />
          </View>
          {(expandedSections['violations'] ?? true) && (
            <View style={{ padding: 16, paddingTop: 8 }}>{renderViolations()}</View>
          )}
        </TouchableOpacity>
      )}

      {hasScreenings && (
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => toggleSection('screenings')}
          style={{ 
            marginBottom: 16, 
            backgroundColor: '#FEF5E7', 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: '#FAD7A0',
            overflow: 'hidden',
            elevation: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: (expandedSections['screenings'] ?? true) ? 'rgba(243, 156, 18, 0.08)' : 'transparent', borderBottomWidth: (expandedSections['screenings'] ?? true) ? 1 : 0, borderBottomColor: '#FAD7A0' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#E67E22' }}>Screenings ({userScreenings.length})</Text>
            <Ionicons name={(expandedSections['screenings'] ?? true) ? "chevron-up" : "chevron-down"} size={20} color="#E67E22" />
          </View>
          {(expandedSections['screenings'] ?? true) && (
            <View style={{ padding: 16, paddingTop: 8 }}>{renderScreenings()}</View>
          )}
        </TouchableOpacity>
      )}

      {showCleanRecord && (
        <View style={[styles.emptyListContainer, { paddingVertical: 40 }]}>
          <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.success} />
          <Text style={[styles.emptyStateText, { color: COLORS.success, marginTop: 12 }]}>Clean Record</Text>
          <Text style={{ color: '#7f8c8d', fontSize: 13, textAlign: 'center', marginTop: 4 }}>This user has no violations or flagged screenings.</Text>
        </View>
      )}
    </View>
  );

  const renderHistory = () => (
    <View style={{ flex: 1 }}>
      {renderLogs()}
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.modalContent}>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}><Ionicons name="close" size={28} color={COLORS.text} /></TouchableOpacity>
              <View style={styles.modalHeader}>
                <Ionicons name="person-circle" size={50} color={COLORS.primary} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.modalUserName}>{user.name || 'Unknown User'}</Text>
                  <View style={[styles.modalStatusBadge, { backgroundColor: user.status === 'active' ? COLORS.success : COLORS.danger }]}><Text style={styles.modalStatusBadgeText}>{user.status}</Text></View>
                  <Text style={{ fontSize: 12, color: COLORS.textTertiary, marginTop: 4 }}>Joined: {user.joinedDate}</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 }}>
                <TouchableOpacity onPress={() => setActiveTab('overview')} style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activeTab === 'overview' ? COLORS.primary : 'transparent' }}>
                  <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'overview' ? COLORS.primary : COLORS.textLight }}>Overview</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('history')} style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activeTab === 'history' ? COLORS.primary : 'transparent', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'history' ? COLORS.primary : COLORS.textLight }}>History</Text>
                  {totalLogsCount > 0 && (
                    <View style={{ marginLeft: 6, backgroundColor: activeTab === 'history' ? COLORS.primary : COLORS.borderDark, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 }}>
                      <Text style={{ color: activeTab === 'history' ? COLORS.textWhite : COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{totalLogsCount > 99 ? '99+' : totalLogsCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {activeTab === 'overview' ? (
                <ScrollView style={{ flex: 1 }}>{renderOverview()}</ScrollView>
              ) : (
                <View style={{ flex: 1 }}>{renderHistory()}</View>
              )}

              <View style={styles.modalActions}>
                {user.status === 'active' ? (<TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.warning }]} onPress={() => onSuspend(user.id)}><Ionicons name="ban-outline" size={20} color={COLORS.textWhite} /><Text style={styles.modalButtonText}>Suspend User</Text></TouchableOpacity>) : (<TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.success }]} onPress={() => { onLiftSuspension(user.id); onClose(); }}><Ionicons name="checkmark-circle-outline" size={20} color={COLORS.textWhite} /><Text style={styles.modalButtonText}>Lift Suspension</Text></TouchableOpacity>)}
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.danger }]} onPress={() => showAlert({ title: "Remove User", message: `Are you sure you want to remove ${user.name}? This action cannot be undone.`, buttons: [{ text: "Cancel", style: "cancel" }, { text: "Yes, Remove", style: "destructive", onPress: () => { onRemove(user.id); onClose(); } }] })}><Ionicons name="trash-outline" size={20} color={COLORS.textWhite} /><Text style={styles.modalButtonText}>Remove</Text></TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast(prev => ({ ...prev, visible: false }))} />
    </Modal>
  );
});

const UsersFilterHeader = memo(({ 
  activeUsersCount, 
  suspendedUsersCount, 
  flaggedUsersCount, 
  statusFilter, 
  setStatusFilter, 
  sortMode 
}: {
  activeUsersCount: number;
  suspendedUsersCount: number;
  flaggedUsersCount: number;
  statusFilter: 'all' | 'active' | 'suspended' | 'flagged';
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'active' | 'suspended' | 'flagged'>>;
  sortMode: string;
}) => {
  const [filterPage, setFilterPage] = useState(0);

  const handleFilterScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = (screenWidth - 32 - 12) / 2;
    const snapInterval = cardWidth + 12;
    const page = Math.min(Math.max(0, Math.round(offsetX / snapInterval)), 1);
    setFilterPage(prev => prev === page ? prev : page);
  }, []);

  if (sortMode === 'status') return <View />;

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 32 - 12) / 2;

  return (
    <View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 16, marginTop: 4 }}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        onScroll={handleFilterScroll}
        scrollEventThrottle={16}
      >
        <SummaryCard
          icon="checkmark-circle-outline"
          color={COLORS.success}
          textColor={COLORS.textWhite}
          title="Active"
          value={activeUsersCount}
          onPress={() => setStatusFilter(prev => prev === 'active' ? 'all' : 'active')}
          showArrow={false}
          style={{
            width: cardWidth,
            marginRight: 12,
            opacity: statusFilter !== 'all' && statusFilter !== 'active' ? 0.65 : 1,
            borderWidth: statusFilter === 'active' ? 2 : 0,
            borderColor: 'rgba(255,255,255,0.7)',
          }}
        />
        <SummaryCard
          icon="ban-outline"
          color={COLORS.danger}
          textColor={COLORS.textWhite}
          title="Suspended"
          value={suspendedUsersCount}
          onPress={() => setStatusFilter(prev => prev === 'suspended' ? 'all' : 'suspended')}
          showArrow={false}
          style={{
            width: cardWidth,
            marginRight: 12,
            opacity: statusFilter !== 'all' && statusFilter !== 'suspended' ? 0.65 : 1,
            borderWidth: statusFilter === 'suspended' ? 2 : 0,
            borderColor: 'rgba(255,255,255,0.7)',
          }}
        />
        <SummaryCard
          icon="alert-circle-outline"
          color={COLORS.warning}
          textColor={COLORS.textWhite}
          title="Flagged"
          value={flaggedUsersCount}
          onPress={() => setStatusFilter(prev => prev === 'flagged' ? 'all' : 'flagged')}
          showArrow={false}
          style={{
            width: cardWidth,
            marginRight: 12,
            opacity: statusFilter !== 'all' && statusFilter !== 'flagged' ? 0.65 : 1,
            borderWidth: statusFilter === 'flagged' ? 2 : 0,
            borderColor: 'rgba(255,255,255,0.7)',
          }}
        />
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12, marginTop: -8 }}>
        {[0, 1].map((i) => (
          <PaginationDot key={i} active={filterPage === i} />
        ))}
      </View>
    </View>
  );
});

/* -------------------------- UsersTab -------------------------- */
const UsersTab: React.FC = memo(() => {
  const { 
    violations, 
    screenings, 
    users, 
    loadingUsers,
    suspendUser,
    liftSuspension,
    removeUser,
    removeUsersBulk,
    refreshData: fetchUsers
  } = useDashboardContext();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSuspendModalVisible, setIsSuspendModalVisible] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<number | null>(null);
  const [usersToSuspend, setUsersToSuspend] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const showAlert = useAlert();
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>([]);
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState<string | null>(null);
  const [logsError, setLogsError] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [sortMode, setSortMode] = useState<'alphabetical' | 'newest' | 'status'>("alphabetical");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'flagged'>('all');
  const flatListRef = useRef<FlatList<UserItem>>(null);
  const resolvingUserId = useRef<number | null>(null);
  const [highlightedUserId, setHighlightedUserId] = useState<number | null>(null);
  const [showFloating, setShowFloating] = useState(false);

  const sortRotation = useSharedValue(0);
  const animatedSortIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sortRotation.value}deg` }],
  }));

  const ITEMS_PER_PAGE = 20;
  const EMPTY_VIOLATIONS: Violation[] = useMemo(() => [], []);
  const EMPTY_SCREENINGS: Screening[] = useMemo(() => [], []);
  const LOGS_PER_PAGE = 15;

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSortMode("alphabetical");
        sortRotation.value = 0;
        setSearchQuery("");
      };
    }, [])
  );

  useEffect(() => {
    AsyncStorage.getItem("username").then(name => setCurrentAdminName(name));
  }, []);

  useEffect(() => {
    // Dynamically update the tab label with the current user count.
    // This is the recommended way to update screen options from within a component,
    // ensuring the navigator configuration remains stable.
    navigation.setOptions({
      tabBarLabel: `Users (${users.length})`,
    });
  }, [navigation, users.length]);
  useEffect(() => {
    if (route.params?.filter) {
      const filter = route.params.filter;
      if (filter === 'active' || filter === 'suspended' || filter === 'all' || filter === 'flagged') {
        setStatusFilter(filter);
      }
      navigation.setParams({ filter: undefined });
    }
  }, [route.params?.filter]);

  const fetchModerationLogs = useCallback(async (userId: number, reset = false) => {
    if (reset) {
      setLoadingLogs(true);
      setLogsError(false);
      setModerationLogs([]);
      setHasMoreLogs(true);
      setLogPage(1);
    } else {
      if (loadingMoreLogs || !hasMoreLogs) return;
      setLoadingMoreLogs(true);
    }

    const pageToFetch = reset ? 1 : logPage;

    try {
      const res = await axios.get(`${API_BASE_URL}/users.php`, { 
        params: {
          fetch_logs: 1, 
          user_id: userId,
          limit: LOGS_PER_PAGE,
          page: pageToFetch
        },
        timeout: 10000 
      });
      if (res.data.success) {
        const newLogs = res.data.logs || [];
        setModerationLogs(prev => reset ? newLogs : [...prev, ...newLogs]);
        setHasMoreLogs(res.data.has_more === true);
        if (res.data.total !== undefined) setTotalLogsCount(res.data.total);
        setLogPage(pageToFetch + 1);
      } else {
        if (reset) setLogsError(true);
        if (reset) showAlert({ title: "Error", message: "Failed to load moderation logs.", buttons: [{ text: "OK" }] });
        setHasMoreLogs(false);
      }
    } catch (e: any) {
      console.error(e);
      if (reset) {
        setLogsError(true);
        const title = "Connection Error";
        const message = "Unable to connect to the server. Please check your internet connection.";
        showAlert({ title, message, buttons: [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => fetchModerationLogs(userId, reset) }
        ] });
      }
      setHasMoreLogs(false);
    } finally {
      if (reset) setLoadingLogs(false);
      else setLoadingMoreLogs(false);
    }
  }, [showAlert, loadingMoreLogs, hasMoreLogs, logPage]);

  const openUserModal = useCallback((user: UserItem) => { setSelectedUser(user); setIsModalVisible(true); fetchModerationLogs(user.id, true); }, [fetchModerationLogs]);
  const closeUserModal = useCallback(() => { setSelectedUser(null); setIsModalVisible(false); setModerationLogs([]); setTotalLogsCount(0); setLogsError(false); setLogPage(1); setHasMoreLogs(true); }, []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const floatingHeaderStyle = useAnimatedStyle(() => {
    const show = scrollY.value > 100;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 300 }),
      transform: [
        { translateY: withTiming(show ? 0 : -100, { duration: 300 }) },
      ],
    };
  });

  const scrollToTopStyle = useAnimatedStyle(() => {
    const show = scrollY.value > 300;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 300 }),
      transform: [
        { scale: withTiming(show ? 1 : 0, { duration: 300 }) },
      ],
    };
  });

  useAnimatedReaction(
    () => scrollY.value > 100,
    (isShown, prev) => {
      if (isShown !== prev) {
        runOnJS(setShowFloating)(isShown);
      }
    },
    [scrollY]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortMode, statusFilter]);

  useEffect(() => {
    if (selectedUserIds.size === 0 && selectionMode) setSelectionMode(false);
  }, [selectedUserIds, selectionMode]);

  useFocusEffect(useCallback(() => () => { setSelectionMode(false); setSelectedUserIds(new Set()); }, []));

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: EventArg<'beforeRemove', true, { action: NavigationAction }>) => {
      // If we're not in selection mode, we don't need to do anything.
      if (!selectionMode) {
        return;
      }

      // Prevent the screen from being left
      e.preventDefault();

      // Prompt the user for confirmation using the existing alert system
      showAlert({
        title: 'Discard selection?',
        message: 'You have users selected. Are you sure you want to leave and discard the selection?',
        buttons: [
          { text: "Don't leave", style: 'cancel', onPress: () => {} },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      });
    });

    return unsubscribe;
  }, [navigation, selectionMode, showAlert]);

  useEffect(() => {
    const userId = route.params?.userId;
    const userObject = route.params?.userObject as UserItem | undefined;
    if (!userId) {
      if (resolvingUserId.current) {
        resolvingUserId.current = null;
      }
      return;
    }

    if (loadingUsers) {
      return;
    }

    const userIdNum = Number(userId);
    const userToOpen = users.find(u => u.id === userIdNum);

    if (userToOpen) { // User found in the existing list
      openUserModal(userToOpen);
      setHighlightedUserId(userIdNum);
      setTimeout(() => setHighlightedUserId(null), 3500);
      navigation.setParams({ userId: undefined, userObject: undefined });
      resolvingUserId.current = null;
    } else {
      // User not in the list, check if a user object was passed via params
      if (userObject && userObject.id === userIdNum) {
        // Immediately open the modal with the passed data
        openUserModal(userObject);
        // Still try to refresh the main list in the background
        if (resolvingUserId.current !== userIdNum) {
          resolvingUserId.current = userIdNum;
          fetchUsers();
        }
        navigation.setParams({ userId: undefined, userObject: undefined });
      } else if (resolvingUserId.current !== userIdNum) {
        resolvingUserId.current = userIdNum;
        fetchUsers();
      } else {
        showAlert({ title: "User Not Found", message: "The user could not be found.", buttons: [{ text: "OK" }] });
        navigation.setParams({ userId: undefined, userObject: undefined });
        resolvingUserId.current = null;
        }
    }
  }, [route.params?.userId, route.params?.userObject, users, loadingUsers, fetchUsers, navigation, openUserModal, showAlert]);

  const handleSwipeRemove = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    showAlert({
      title: "Remove User",
      message: `Are you sure you want to remove ${user.name}? This action cannot be undone.`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Remove", style: "destructive", onPress: () => removeUser(userId) }
      ]
    });
  }, [users, showAlert, removeUser]);

  const violationsMap = useMemo(() => {
    const map: Record<number, Violation[]> = {};
    violations.forEach(v => (map[v.userId] ? map[v.userId].push(v) : (map[v.userId] = [v])));
    return map;
  }, [violations]);

  const screeningsMap = useMemo(() => {
    const map: Record<number, Screening[]> = {};
    screenings.forEach(s => (map[s.userId] ? map[s.userId].push(s) : (map[s.userId] = [s])));
    return map;
  }, [screenings]);

  const filteredUsers = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = users.filter(user => {
      let statusMatch = true;
      if (statusFilter === 'active') statusMatch = user.status === 'active';
      else if (statusFilter === 'suspended') statusMatch = user.status === 'suspended';
      else if (statusFilter === 'flagged') {
        statusMatch = ((violationsMap[user.id]?.length ?? 0) > 0) || ((screeningsMap[user.id]?.length ?? 0) > 0);
      }
      
      if (!statusMatch) return false;
      if (!searchQuery) return true;

      // 1. Name match
      if (user.name.toLowerCase().includes(lowerQuery)) return true;

      // 2. Violations match
      const userViolations = violationsMap[user.id];
      if (userViolations && userViolations.some(v => (v.type && v.type.toLowerCase().includes(lowerQuery)) || (!!(v as any).reason && (v as any).reason.toLowerCase().includes(lowerQuery)))) return true;

      // 3. Screenings match
      const userScreenings = screeningsMap[user.id];
      if (userScreenings && userScreenings.some(s => (s.type && s.type.toLowerCase().includes(lowerQuery)) || (!!(s as any).reason && (s as any).reason.toLowerCase().includes(lowerQuery)) || (!!s.result && s.result.toLowerCase().includes(lowerQuery)))) return true;

      return false;
    });
    const sorted = [...filtered];
    if (sortMode === "alphabetical") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "newest") sorted.sort((a, b) => b.id - a.id);
    else if (sortMode === "status") {
      sorted.sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === 'suspended' ? -1 : 1;
      });
    }
    return sorted;
  }, [users, searchQuery, sortMode, statusFilter, violationsMap, screeningsMap]);

  const displayedUsers = useMemo(() => filteredUsers.slice(0, currentPage * ITEMS_PER_PAGE), [filteredUsers, currentPage]);
  const modalUser = useMemo(() => users.find(u => u.id === selectedUser?.id) || selectedUser, [users, selectedUser]);
  
  const toggleUserSelection = useCallback((userId: number) => { setSelectedUserIds(prev => { const newSet = new Set(prev); newSet.has(userId) ? newSet.delete(userId) : newSet.add(userId); return newSet; }); }, []);
  const handleLongPressUser = useCallback((userId: number) => { if (!selectionMode) setSelectionMode(true); toggleUserSelection(userId); }, [selectionMode, toggleUserSelection]);
  const handlePressUser = useCallback((user: UserItem) => { if (selectionMode) toggleUserSelection(user.id); else openUserModal(user); }, [selectionMode, openUserModal, toggleUserSelection]);
  const handleSuspendUser = useCallback((userId: number) => { setIsModalVisible(false); setUserToSuspend(userId); setIsSuspendModalVisible(true); }, []);
  const handleBulkSuspend = useCallback((userIds: Set<number>) => { setUsersToSuspend(userIds); setIsSuspendModalVisible(true); }, []);
  const handleConfirmBulkSuspension = useCallback(async (duration: number, reason: string) => { await Promise.all(Array.from(usersToSuspend).map(userId => suspendUser(userId, duration, reason))); setIsSuspendModalVisible(false); setUsersToSuspend(new Set()); setSelectedUserIds(new Set()); }, [usersToSuspend, suspendUser]);
  const handleConfirmSuspension = useCallback(async (duration: number, reason: string) => { if (userToSuspend) await suspendUser(userToSuspend, duration, reason); setIsSuspendModalVisible(false); setUserToSuspend(null); }, [userToSuspend, suspendUser]);

  const handleLoadMoreLogs = useCallback(() => {
    if (modalUser) fetchModerationLogs(modalUser.id, false);
  }, [modalUser, fetchModerationLogs]);

  const { canSuspend, canLift, toggleActionLabel } = useMemo(() => {
    if (selectedUserIds.size === 0) return { canSuspend: false, canLift: false, toggleActionLabel: 'Toggle' };
    const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
    const allActive = selectedUsers.every(u => u.status === 'active');
    const allSuspended = selectedUsers.every(u => u.status === 'suspended');
    if (allActive) return { canSuspend: true, canLift: false, toggleActionLabel: 'Suspend' };
    if (allSuspended) return { canSuspend: false, canLift: true, toggleActionLabel: 'Lift' };
    return { canSuspend: false, canLift: false, toggleActionLabel: 'Toggle' };
  }, [selectedUserIds, users]);

  const { activeUsersCount, suspendedUsersCount, flaggedUsersCount } = useMemo(() => {
    return users.reduce((counts, user) => {
      if (user.status === 'active') counts.activeUsersCount++;
      else if (user.status === 'suspended') counts.suspendedUsersCount++;
      
      if (((violationsMap[user.id]?.length ?? 0) > 0) || ((screeningsMap[user.id]?.length ?? 0) > 0)) {
        counts.flaggedUsersCount++;
      }
      return counts;
    }, { activeUsersCount: 0, suspendedUsersCount: 0, flaggedUsersCount: 0 });
  }, [users, violationsMap, screeningsMap]);

  if (loadingUsers && users.length === 0) {
    return <UsersSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.userListControls, { position: 'relative', zIndex: 1, elevation: 0, marginTop: 0, marginBottom: 10 }]}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <TextInput placeholder="Search users, violations..." value={searchQuery} onChangeText={setSearchQuery} style={[styles.searchInput, { paddingRight: 35 }]} />
          {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchButton}><Ionicons name="close-circle" size={20} color={COLORS.textLight} /></TouchableOpacity>)}
        </View>
        {statusFilter !== 'all' && (
          <TouchableOpacity onPress={() => setStatusFilter('all')} style={{ marginLeft: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E74C3C', width: 40, height: 40, borderRadius: 20, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 }}>
             <MaterialIcons name="filter-list-off" size={20} color={COLORS.textWhite} />
          </TouchableOpacity>
        )}
        <Pressable 
          onPress={() => {
            setSortMode(p => (p === "alphabetical" ? "newest" : p === "newest" ? "status" : "alphabetical"));
            sortRotation.value = withTiming(sortRotation.value + 180, { duration: 300 });
            setStatusFilter('all');
          }} 
          style={({ pressed }) => [styles.sortButton, { backgroundColor: pressed ? '#3B7BC2' : COLORS.primary }]}
        >
          <Animated.View style={animatedSortIconStyle}>
            <MaterialIcons name="sort" size={18} color={COLORS.textWhite} />
          </Animated.View>
          <Text style={styles.sortButtonText}>{sortMode === "alphabetical" ? "A-Z" : sortMode === "newest" ? "Newest" : "Status"}</Text>
          <MaterialIcons name="arrow-downward" size={14} color={COLORS.textWhite} style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      {selectionMode && selectedUserIds.size > 0 && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.userListBulkActions, { marginBottom: 10 }]}>
          <TouchableOpacity
            disabled={!canSuspend && !canLift}
            onPress={() => {
              if (canSuspend) {
                const usersToSuspend = users.filter(user => selectedUserIds.has(user.id));
                const namesToShow = usersToSuspend.map(u => u.name).slice(0, 3).join(', ');
                const remainingCount = Math.max(0, usersToSuspend.length - 3);
                const userListMessage = remainingCount > 0 ? `${namesToShow}, and ${remainingCount} more` : namesToShow;
                showAlert({ title: "Confirm Bulk Suspension", message: `You are about to suspend ${selectedUserIds.size} user(s):\n\n${userListMessage}`, buttons: [{ text: "Cancel", style: "cancel" }, { text: "Proceed", onPress: () => handleBulkSuspend(selectedUserIds) }] });
              } else if (canLift) {
                showAlert({ title: "Confirm Bulk Action", message: `Are you sure you want to lift the suspension for ${selectedUserIds.size} user(s)?`, buttons: [{ text: "Cancel", style: "cancel" }, { text: "Yes, Lift All", onPress: () => { selectedUserIds.forEach(liftSuspension); setSelectedUserIds(new Set()); } }] });
              }
            }}
            style={[styles.bulkActionButton, { backgroundColor: canLift ? '#2ECC71' : '#F39C12' }, !canSuspend && !canLift && { backgroundColor: '#aaa', opacity: 0.6 }]}
          >
            <Ionicons name={canLift ? 'checkmark-circle-outline' : 'ban-outline'} size={16} color={COLORS.textWhite} style={{ marginRight: 8 }} /><Text style={styles.bulkActionButtonText}>{toggleActionLabel} ({selectedUserIds.size})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const usersToRemove = users.filter(user => selectedUserIds.has(user.id));
              const namesToShow = usersToRemove.map(u => u.name).slice(0, 3).join(', ');
              const remainingCount = Math.max(0, usersToRemove.length - 3);
              const userListMessage = remainingCount > 0 ? `${namesToShow}, and ${remainingCount} more` : namesToShow;
              showAlert({ title: "Confirm Bulk Removal", message: `This will permanently remove ${selectedUserIds.size} user(s):\n\n${userListMessage}`, buttons: [{ text: "Cancel", style: "cancel" }, { text: "Yes, Remove All", style: "destructive", onPress: () => { removeUsersBulk(selectedUserIds); setSelectedUserIds(new Set()); } }] });
            }}
            style={[styles.bulkActionButton, { backgroundColor: COLORS.danger }]}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.textWhite} style={{ marginRight: 8 }} /><Text style={styles.bulkActionButtonText}>Remove ({selectedUserIds.size})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedUserIds(new Set())} style={styles.cancelBulkActionButton}><Text style={styles.cancelBulkActionButtonText}>Cancel</Text></TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.userListContainer}>
        <View style={{ flex: 1 }}>
          <Animated.FlatList
            ref={flatListRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            ListHeaderComponent={
              <UsersFilterHeader 
                activeUsersCount={activeUsersCount}
                suspendedUsersCount={suspendedUsersCount}
                flaggedUsersCount={flaggedUsersCount}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sortMode={sortMode}
              />
            }
            data={displayedUsers}
            keyExtractor={item => item.id.toString()}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            onEndReached={() => { if (!loadingUsers && displayedUsers.length < filteredUsers.length) setCurrentPage(p => p + 1); }}
            refreshing={loadingUsers} onRefresh={fetchUsers}
            contentContainerStyle={{ paddingBottom: 32 }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={!loadingUsers ? (<View style={styles.emptyListContainer}><Text style={styles.emptyListText}>No users found matching your search.</Text></View>) : null}
            ListFooterComponent={
              loadingUsers ? null :
              displayedUsers.length < filteredUsers.length ?
                <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 10 }} /> :
              filteredUsers.length > 0 ?
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Ionicons name="leaf-outline" size={24} color="#bdc3c7" />
                  <Text style={{ color: '#95a5a6', fontSize: 12, marginTop: 8 }}>You've reached the end of the list.</Text>
                </View> : null
            }
            renderItem={useCallback(({ item }: { item: UserItem }) => (<UserCard user={item} violations={violationsMap[item.id] || EMPTY_VIOLATIONS} screenings={screeningsMap[item.id] || EMPTY_SCREENINGS} search={searchQuery} selected={selectedUserIds.has(item.id)} onLongPress={() => handleLongPressUser(item.id)} onPress={() => handlePressUser(item)} onSuspend={handleSuspendUser} onLiftSuspension={liftSuspension} onRemove={handleSwipeRemove} highlighted={item.id === highlightedUserId} />), [violationsMap, screeningsMap, searchQuery, selectedUserIds, handleLongPressUser, handlePressUser, EMPTY_VIOLATIONS, EMPTY_SCREENINGS, handleSuspendUser, liftSuspension, handleSwipeRemove, highlightedUserId])}
          />
          {loadingUsers && displayedUsers.length === 0 && (<View style={styles.listOverlay}><ActivityIndicator size="large" color={COLORS.primary} /></View>)}
          
          {sortMode !== 'status' && (
          <Animated.View style={[styles.floatingIconsContainer, floatingHeaderStyle]} pointerEvents={showFloating ? 'auto' : 'none'}>
            <TouchableOpacity onPress={() => setStatusFilter(f => f === 'active' ? 'all' : 'active')} style={[styles.miniFloatingButton, { backgroundColor: COLORS.success, borderColor: statusFilter === 'active' ? COLORS.textWhite : 'transparent', borderWidth: statusFilter === 'active' ? 2 : 0, flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.textWhite} />
              <Text style={{ color: COLORS.textWhite, fontWeight: '800', fontSize: 14 }}>{activeUsersCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStatusFilter(f => f === 'suspended' ? 'all' : 'suspended')} style={[styles.miniFloatingButton, { backgroundColor: COLORS.danger, borderColor: statusFilter === 'suspended' ? COLORS.textWhite : 'transparent', borderWidth: statusFilter === 'suspended' ? 2 : 0, flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="ban-outline" size={18} color={COLORS.textWhite} />
              <Text style={{ color: COLORS.textWhite, fontWeight: '800', fontSize: 14 }}>{suspendedUsersCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStatusFilter(f => f === 'flagged' ? 'all' : 'flagged')} style={[styles.miniFloatingButton, { backgroundColor: COLORS.warning, borderColor: statusFilter === 'flagged' ? COLORS.textWhite : 'transparent', borderWidth: statusFilter === 'flagged' ? 2 : 0, flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.textWhite} />
              <Text style={{ color: COLORS.textWhite, fontWeight: '800', fontSize: 14 }}>{flaggedUsersCount}</Text>
            </TouchableOpacity>
          </Animated.View>
          )}

          <Animated.View style={[styles.scrollToTopButton, scrollToTopStyle]}>
            <TouchableOpacity onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="arrow-up" size={24} color={COLORS.textWhite} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      <UserModal visible={isModalVisible} user={modalUser} violations={violations} screenings={screenings} moderationLogs={moderationLogs} totalLogsCount={totalLogsCount} loadingLogs={loadingLogs} logsError={logsError} onRetryLogs={() => modalUser && fetchModerationLogs(modalUser.id, true)} onLoadMore={handleLoadMoreLogs} hasMoreLogs={hasMoreLogs} loadingMoreLogs={loadingMoreLogs} onClose={closeUserModal} onSuspend={handleSuspendUser} onLiftSuspension={liftSuspension} onRemove={removeUser} currentAdminName={currentAdminName} />
      <SuspendUserModal visible={isSuspendModalVisible} onClose={() => setIsSuspendModalVisible(false)} onSubmit={(duration, reason) => { if (userToSuspend) handleConfirmSuspension(duration, reason); else if (usersToSuspend.size > 0) handleConfirmBulkSuspension(duration, reason); }} />
    </View>
  );
});

export default UsersTab;
