// app/sadmindashboard.tsx
import React, { useLayoutEffect, useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { Metric, Violation, UserItem, Screening, CustomAlertOptions, INITIAL_METRICS, useDashboardContext, AlertContext, DashboardContext } from "../lib/sadmin_tabs/common";
import { API_BASE_URL } from "../lib/apiConfig";
import DashboardTab from "./sadmin_tabs/DashboardTab";
import UsersTab from "./sadmin_tabs/UsersTab";
import ReportsTab from "./sadmin_tabs/ReportsTab";
import { ErrorBoundary, CustomAlert, Toast } from "../lib/sadmin_tabs/SharedComponents";

// --- Reusable UI Components --- //

/* ========================
   Tabs
======================== */
const Tab = createMaterialTopTabNavigator();

/* ========================
   Dashboard UI - The main component with all the tabs
======================== */
function DashboardUI() {
  const { swipeEnabled, users } = useDashboardContext();

  return (
    <Tab.Navigator screenOptions={{ lazy: true, tabBarLabelStyle: { textTransform: 'none', fontWeight: '600' } }}>
        <Tab.Screen
          name="Dashboard"
          component={DashboardTab}
          options={{ 
            swipeEnabled: true,
            tabBarAccessibilityLabel: "Dashboard Overview"
          }} />
        <Tab.Screen
          name="Users"
          component={UsersTab}
          options={{
            swipeEnabled: true,
            tabBarLabel: 'Users', // Set a static label, it will be updated dynamically
            tabBarAccessibilityLabel: "User Management"
          }}/>
        <Tab.Screen
          name="Reports"
          options={{ swipeEnabled: swipeEnabled, tabBarAccessibilityLabel: "Reports and Analytics" }}
          component={ReportsTab} />
      </Tab.Navigator>
  );
}

/* ========================
   Main Screen - The top-level component that provides context
======================== */
export default function SadminDashboardScreen() {
  const [metrics, setMetrics] = useState<Metric>(INITIAL_METRICS);
  const [alertOptions, setAlertOptions] = useState<CustomAlertOptions | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const usersRef = useRef<UserItem[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string; icon?: any } | null>(null);
  const router = useRouter();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' | 'destructive' }>({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef<any>(null);

  const retryRotation = useSharedValue(0);
  const animatedRetryStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${retryRotation.value}deg` }],
  }));

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const showAlert = useCallback((options: CustomAlertOptions) => {
    setAlertOptions(options);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' | 'destructive' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const handleConnectionError = useCallback((retryCallback?: () => void) => {
    const title = "Connection Error";
    const message = "Unable to connect to the server. Please check your internet connection.";
    showAlert({ 
      title, 
      message, 
      buttons: [
        { text: "Cancel", style: "cancel" },
        ...(retryCallback ? [{ text: "Retry", onPress: retryCallback }] : [])
      ] 
    });
  }, [showAlert]);

  const fetchUsers = useCallback(async (): Promise<UserItem[] | undefined> => {
    setLoadingUsers(true);
    setFetchError(false);
    setErrorDetails(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/users.php?admin=1&_t=${Date.now()}`, { timeout: 5000 });
      if (res.data.success && Array.isArray(res.data.users)) {
        const mappedUsers: UserItem[] = res.data.users.map((u: any) => ({
          id: Number(u.id),
          name: u.username,
          status: u.status || 'active',
          role: u.role,
          joinedDate: u.created_at || 'N/A',
          suspensionReason: u.suspension_reason,
          suspensionEndDate: u.suspension_end_date
        }));
        setUsers(mappedUsers);
        return mappedUsers;
      } else {
        console.log("Fetch users: No users returned or success flag missing.");
      }
    } catch (error: any) {
      setFetchError(true);
      console.error("Failed to fetch users", error);
      const title = "Connection Error";
      const message = "Unable to connect to the server. Please check your internet connection.";
      const icon = "wifi-off";

      setErrorDetails({ title, message, icon });
      if (usersRef.current.length > 0) {
        handleConnectionError(() => fetchUsers());
      }
    } finally {
      setLoadingUsers(false);
    }
    return undefined;
  }, [showAlert, handleConnectionError]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/reports.php`, { timeout: 5000 });
      if (res.data.success && Array.isArray(res.data.reports)) {
        const reports = res.data.reports;
        
        const newScreenings = reports.filter((r: any) => r.status === 'pending').map((r: any) => {
          let screeningDetails = null;
          try {
            if (r.group_screening) screeningDetails = JSON.parse(r.group_screening);
            else if (r.private_screening) screeningDetails = JSON.parse(r.private_screening);
          } catch (e) { console.error("Error parsing screening result", e); }

          return {
            id: Number(r.id),
            userId: Number(r.reported_user_id),
            userName: r.reported_user_name || `User ${r.reported_user_id}`,
            type: r.report_type,
            result: 'Pending',
            date: r.created_at,
            reason: r.reason || undefined,
            reporter: r.reporter_name || `User ${r.reporter_id}`,
            screeningDetails
          };
        });
        setScreenings(newScreenings);

        const newViolations = reports.filter((r: any) => r.status !== 'pending').map((r: any) => ({
          id: Number(r.id),
          userId: Number(r.reported_user_id),
          userName: r.reported_user_name || `User ${r.reported_user_id}`,
          type: r.report_type,
          date: r.created_at,
          reason: r.reason || undefined
        }));
        setViolations(newViolations);
      }
    } catch (error) {
      console.error("Failed to fetch reports", error);
    }
  }, []);

  const suspendUser = useCallback(async (userId: number, duration: number, reason: string) => {
    try {
      const adminId = await AsyncStorage.getItem("userID");
      await axios.post(`${API_BASE_URL}/users.php`, { action: 'suspend', user_id: userId, duration, reason, admin_id: adminId });
      await fetchUsers();
      await fetchReports();
      showToast("User suspended successfully", "warning");
    } catch (error: any) {
      console.error(error);
      handleConnectionError(() => suspendUser(userId, duration, reason));
    }
  }, [fetchUsers, fetchReports, handleConnectionError, showToast]);

  const liftSuspension = useCallback(async (userId: number) => {
    try {
      const adminId = await AsyncStorage.getItem("userID");
      await axios.post(`${API_BASE_URL}/users.php`, { action: 'activate', user_id: userId, admin_id: adminId });
      await fetchUsers();
      await fetchReports();
      showToast("Suspension lifted successfully", "success");
    } catch (error: any) {
      console.error(error);
      handleConnectionError(() => liftSuspension(userId));
    }
  }, [fetchUsers, fetchReports, handleConnectionError, showToast]);

  const removeUser = useCallback(async (userId: number) => {
    try {
      const adminId = await AsyncStorage.getItem("userID");
      await axios.post(`${API_BASE_URL}/users.php`, { action: 'delete', user_id: userId, admin_id: adminId });
      await fetchUsers();
      await fetchReports();
      showToast("User removed successfully", "destructive");
    } catch (error: any) {
      console.error(error);
      handleConnectionError(() => removeUser(userId));
    }
  }, [fetchUsers, fetchReports, handleConnectionError, showToast]);

  const removeUsersBulk = useCallback(async (userIds: Set<number>) => {
    try {
      const adminId = await AsyncStorage.getItem("userID");
      await Promise.all(Array.from(userIds).map(id => 
        axios.post(`${API_BASE_URL}/users.php`, { action: 'delete', user_id: id, admin_id: adminId })
      ));
      await fetchUsers();
      await fetchReports();
      showToast(`${userIds.size} users removed successfully`, "destructive");
    } catch (error: any) {
      console.error(error);
      handleConnectionError(() => removeUsersBulk(userIds));
    }
  }, [fetchUsers, fetchReports, handleConnectionError, showToast]);

  const refreshData = useCallback(async (): Promise<UserItem[] | undefined> => {
    setFetchError(false);
    setErrorDetails(null);
    setMetrics(INITIAL_METRICS);
    const [users] = await Promise.all([fetchUsers(), fetchReports()]);
    return users;
  }, [fetchUsers, fetchReports]);

  const onRetry = useCallback(async () => {
    retryRotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    const result = await refreshData();
    if (result) {
      showToast("Connection restored", "success");
    }
  }, [refreshData, showToast]);

  useEffect(() => {
    if (!loadingUsers) {
      cancelAnimation(retryRotation);
      retryRotation.value = 0;
    }
  }, [loadingUsers]);

  // Calculate metrics from real data whenever users or reports change
  useEffect(() => {
    const activeCount = users.filter(u => u.status === 'active').length;
    const suspendedCount = users.filter(u => u.status === 'suspended').length;

    const now = new Date();
    const isToday = (dateStr: string | undefined) => {
      if (!dateStr) return false;

      const localYear = now.getFullYear();
      const localMonth = String(now.getMonth() + 1).padStart(2, '0');
      const localDay = String(now.getDate()).padStart(2, '0');
      const todayPrefix = `${localYear}-${localMonth}-${localDay}`;

      if (dateStr.startsWith(todayPrefix)) return true;

      const d = new Date(dateStr.replace(" ", "T"));
      if (isNaN(d.getTime())) return false;

      return d.toDateString() === now.toDateString();
    };

    const violationsTodayCount = violations.filter(v => isToday(v.date)).length;
    const screeningsTodayCount = screenings.filter(s => isToday(s.date)).length;

    setMetrics(prev => ({
      ...prev,
      activeUsers: activeCount,
      suspendedUsers: suspendedCount,
      totalUsers: users.length,
      screeningsToday: screeningsTodayCount,
      violationsToday: violationsTodayCount
    }));
  }, [users, violations, screenings]);

  useEffect(() => {
    refreshData();
    fetchReports();
  }, [refreshData]);

  const contextValue = useMemo(() => ({
    metrics,
    violations,
    users,
    screenings,
    swipeEnabled,
    loadingUsers,
    setSwipeEnabled,
    suspendUser,
    liftSuspension,
    removeUser,
    removeUsersBulk,
    refreshData,
  }), [metrics, violations, users, screenings, swipeEnabled, loadingUsers, suspendUser, liftSuspension, removeUser, removeUsersBulk, refreshData]);

  // This effect will run when the component mounts.
  // We can check for a parameter to bypass the selection screen if needed.
  // For now, we'll just ensure the selection screen shows up on initial load.
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true, // Always show header to prevent layout shift
      title: "Admin Dashboard",
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ marginRight: 15 }}
            onPress={() => showAlert({
              title: "Confirm Logout",
              message: "Are you sure you want to log out?",
              buttons: [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: async () => { 
                    await SecureStore.deleteItemAsync("user");
                    await AsyncStorage.multiRemove(["userID", "username", "role"]);
                    router.replace("/auth"); 
                  } 
                },
              ]
            })}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            accessibilityHint="Logs out of the admin dashboard"
          >
            <MaterialIcons name="logout" size={24} color="#fff" />
          </TouchableOpacity>
          </View>
        ),
      });
  }, [navigation, router, showAlert]);

  const isErrorState = fetchError && users.length === 0 && !loadingUsers;

  return (
    <AlertContext.Provider value={showAlert}>
      <DashboardContext.Provider value={contextValue}>
        <ErrorBoundary>
          <DashboardUI />
        </ErrorBoundary>
        <Modal visible={isErrorState} transparent={false} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
            <MaterialIcons name={errorDetails?.icon || "cloud-off"} size={64} color="#95a5a6" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#333', marginTop: 20 }}>{errorDetails?.title || "Connection Failed"}</Text>
            <Text style={{ fontSize: 14, color: '#666', marginTop: 8, marginBottom: 24, textAlign: 'center', paddingHorizontal: 40 }}>
              {errorDetails?.message || "Unable to load dashboard data. Please check your internet connection and try again."}
            </Text>
            <TouchableOpacity 
              onPress={onRetry} 
              style={{ 
                backgroundColor: '#4A90E2', 
                paddingHorizontal: 24, 
                paddingVertical: 12, 
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              }}
            >
              <Animated.View style={[{ marginRight: 8 }, animatedRetryStyle]}>
                <MaterialIcons name="refresh" size={20} color="#fff" />
              </Animated.View>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        </Modal>
        <CustomAlert
          visible={!!alertOptions}
          options={alertOptions}
          onClose={() => setAlertOptions(null)}
        />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={hideToast} />
      </DashboardContext.Provider>
    </AlertContext.Provider>
  );
}
