// app/sadmin_tabs/ReportsTab.tsx
import React, { memo, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Platform, Modal, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { styles, COLORS } from "../../lib/sadmin_tabs/styles";
import axios from "axios";
import ViewShot from "react-native-view-shot";
import { API_BASE_URL } from "../../lib/apiConfig";
import { useDashboardContext, useAlert } from "../../lib/sadmin_tabs/common";
import { PanelCard, SvgPieChart, SvgLineChart, SvgBarChart, Toast, LiveActivityItem } from "../../lib/sadmin_tabs/SharedComponents";
import { ReportsSkeleton } from "../../lib/sadmin_tabs/SkeletonLoader";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useNavigation } from "@react-navigation/native";

// --- Reusable UI Components --- //

const ChartContainer: React.FC<{ children: React.ReactNode; isScrollable?: boolean; scrollRef?: React.RefObject<ScrollView | null>; onTouchStart?: () => void; onTouchEnd?: () => void; }> = ({ children, isScrollable, scrollRef, onTouchStart, onTouchEnd }) => {
  if (isScrollable) return <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={scrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{children}</ScrollView>;
  return <>{children}</>;
};

const WarningIcon: React.FC<{ onPress?: () => void }> = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.warningIconContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
    <Ionicons name="warning" size={18} color={COLORS.danger} />
  </TouchableOpacity>
);

const NoDataView: React.FC<{ icon?: keyof typeof Ionicons.glyphMap; message?: string }> = ({ icon = "stats-chart-outline", message = "No Data to Show" }) => (
  <View style={styles.noDataContainer}>
    <Ionicons name={icon} size={48} color={COLORS.borderDark} />
    <Text style={styles.noDataText}>{message}</Text>
  </View>
);

// --- Report Section Components --- //

const ReportsHeader: React.FC<{
  range: "daily" | "weekly" | "monthly";
  setRange: (range: "daily" | "weekly" | "monthly") => void;
  onDownload: () => void;
}> = memo(({ range, setRange, onDownload }) => (
    <View style={styles.reportsHeader}>
      <View style={styles.rangeSelectorContainer}>
        {(["daily", "weekly", "monthly"] as const).map((r) => (
          <TouchableOpacity key={r} onPress={() => setRange(r)} style={[styles.rangeButton, range === r && styles.rangeButtonActive]}>
            <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.downloadButton} onPress={onDownload}>
        <Ionicons name="download-outline" size={20} color={COLORS.textWhite} />
      </TouchableOpacity>
    </View>
));

const MessagesChartCard: React.FC<{
  range: string;
  data: number[];
  labels: string[];
  chartWidth: number;
  scrollRef: React.RefObject<ScrollView | null>;
  setSwipeEnabled: (enabled: boolean) => void;
  viewShotRef: React.RefObject<ViewShot | null>;
  onDownload: () => void;
  hasError?: boolean;
  onWarningPress?: () => void;
}> = memo(({ range, data, labels, chartWidth, scrollRef, setSwipeEnabled, viewShotRef, onDownload, hasError, onWarningPress }) => {
    const hasData = useMemo(() => data.some(v => v > 0), [data]);
    const totalMessages = useMemo(() => data.reduce((a, b) => a + b, 0), [data]);
    return (
    <PanelCard 
      title={`${range.charAt(0).toUpperCase() + range.slice(1)} Messages Sent`}
      headerRight={
        <View style={styles.headerRightContainer}>
          {hasError && <WarningIcon onPress={onWarningPress} />}
          {hasData && (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContent}>
        <Text style={styles.reportSummary}>Total: <Text style={styles.boldText}>{totalMessages.toLocaleString()}</Text></Text>
        {hasData ? (
          <ChartContainer isScrollable={range === 'monthly'} scrollRef={scrollRef} onTouchStart={() => setSwipeEnabled(false)} onTouchEnd={() => setSwipeEnabled(true)}>
            <SvgLineChart data={data} width={chartWidth} height={200} labels={labels} color={COLORS.primary} />
          </ChartContainer>
        ) : (
          <NoDataView icon="chatbubbles-outline" message="No messages sent" />
        )}
        </View>
      </ViewShot>
    </PanelCard>
)});

const NewRegistrationsCard: React.FC<{
  range: string;
  data: number[];
  labels: string[];
  chartWidth: number;
  scrollRef: React.RefObject<ScrollView | null>;
  setSwipeEnabled: (enabled: boolean) => void;
  viewShotRef: React.RefObject<ViewShot | null>;
  onDownload: () => void;
  hasError?: boolean;
  onWarningPress?: () => void;
}> = memo(({ range, data, labels, chartWidth, scrollRef, setSwipeEnabled, viewShotRef, onDownload, hasError, onWarningPress }) => {
    const hasData = useMemo(() => data.some(v => v > 0), [data]);
    const totalRegistrations = useMemo(() => data.reduce((a, b) => a + b, 0), [data]);
    return (
    <PanelCard 
      title={`${range.charAt(0).toUpperCase() + range.slice(1)} New Registrations`}
      headerRight={
        <View style={styles.headerRightContainer}>
          {hasError && <WarningIcon onPress={onWarningPress} />}
          {hasData && (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContent}>
        <Text style={styles.reportSummary}>Total: <Text style={styles.boldText}>{totalRegistrations.toLocaleString()}</Text></Text>
        {hasData ? (
          <ChartContainer isScrollable={range === 'monthly'} scrollRef={scrollRef} onTouchStart={() => setSwipeEnabled(false)} onTouchEnd={() => setSwipeEnabled(true)}>
            <SvgBarChart data={data} width={chartWidth} height={200} labels={labels} color={COLORS.success} />
          </ChartContainer>
        ) : (
          <NoDataView icon="person-add-outline" message="No new registrations" />
        )}
        </View>
      </ViewShot>
    </PanelCard>
)});

const UserStatusCard: React.FC<{ users: any[], viewShotRef: React.RefObject<ViewShot | null>, onDownload: () => void }> = memo(({ users, viewShotRef, onDownload }) => {
    const { activeUsers, suspendedUsers, totalUsers } = useMemo(() => {
        const active = users.filter(u => u.status === 'active').length;
        const suspended = users.filter(u => u.status === 'suspended').length;
        return { activeUsers: active, suspendedUsers: suspended, totalUsers: users.length };
    }, [users]);

    const userStatusData = useMemo(() => [
        { label: "Active", value: activeUsers, color: COLORS.success }, { label: "Suspended", value: suspendedUsers, color: COLORS.danger }
    ], [activeUsers, suspendedUsers]);

    const title = "Overall User Status";

    return (
      <PanelCard 
        title={title}
        headerRight={
          totalUsers > 0 ? (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : undefined
        }
      >
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContentPadding}>
        <View style={styles.chartRow}>
          <View style={styles.chartWrapper}>
            <SvgPieChart 
              key={`user-pie-${activeUsers}-${suspendedUsers}`}
              radius={80} 
              innerRadius={40}
              data={totalUsers > 0 ? userStatusData : [{ value: 1, color: COLORS.borderDark }]}
            />
            <View style={styles.pieCenter}>
              {totalUsers > 0 ? (
                <><Text style={styles.pieCenterNumber}>{totalUsers}</Text><Text style={styles.pieCenterLabel}>Total Users</Text></>
              ) : (
                <>
                  <Ionicons name="people-outline" size={24} color={COLORS.border} style={styles.noDataIcon} />
                  <Text style={[styles.pieCenterLabel, styles.noDataLabel]}>No Data</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.legendContainer}>
            {userStatusData.map((item, index) => (<View key={index} style={styles.pieLegendRow}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{`${item.label} (${item.value.toLocaleString()})`}</Text></View>))}
          </View>
        </View>
        </View>
        </ViewShot>
      </PanelCard>
    );
});

const ScreeningsCard: React.FC<{ range: "daily" | "weekly" | "monthly"; stats: { passed: number, flagged: number } | null, viewShotRef: React.RefObject<ViewShot | null>, onDownload: () => void }> = memo(({ range, stats, viewShotRef, onDownload }) => {
    const { passedCount, flaggedCount, totalScreenings } = useMemo(() => {
        const passed = Number(stats?.passed || 0);
        const flagged = Number(stats?.flagged || 0);
        return { passedCount: passed, flaggedCount: flagged, totalScreenings: passed + flagged };
    }, [stats]);

    const dynamicScreeningsData = useMemo(() => [
        { label: "Passed", value: passedCount, color: COLORS.success },
        { label: "Flagged", value: flaggedCount, color: COLORS.warning }
    ], [passedCount, flaggedCount]);

    return (
      <PanelCard 
        title={`${range.charAt(0).toUpperCase() + range.slice(1)} Screening Results`}
        headerRight={
          totalScreenings > 0 ? (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : undefined
        }
      >
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContentPadding}>
        {totalScreenings > 0 ? (
        <View style={styles.chartRow}>
          <View style={styles.chartWrapper}>
            <SvgPieChart 
              key={`screenings-pie-${range}-${passedCount}-${flaggedCount}`}
              radius={80} 
              innerRadius={40} 
              data={dynamicScreeningsData} 
            />
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterNumber}>{totalScreenings.toLocaleString()}</Text><Text style={styles.pieCenterLabel}>Screenings</Text>
            </View>
          </View>
          <View style={styles.legendContainer}>
            {dynamicScreeningsData.map((item, index) => (<View key={index} style={styles.pieLegendRow}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{`${item.label} (${item.value.toLocaleString()})`}</Text></View>))}
          </View>
        </View>
        ) : (
          <NoDataView icon="shield-checkmark-outline" message="No screenings found" />
        )}
        </View>
        </ViewShot>
      </PanelCard>
    );
});

const ScreeningTrendCard: React.FC<{ range: "daily" | "weekly" | "monthly"; screeningTrend: any; chartWidth: number; labels: string[], viewShotRef: React.RefObject<ViewShot | null>, onDownload: () => void, hasError?: boolean, onWarningPress?: () => void }> = memo(({ range, screeningTrend, chartWidth, labels, viewShotRef, onDownload, hasError, onWarningPress }) => {
    const hasData = useMemo(() => screeningTrend[range]?.some((v: number) => v > 0), [screeningTrend, range]);
    return (
    <PanelCard 
      title={`${range.charAt(0).toUpperCase() + range.slice(1)} Screening Trend`}
      headerRight={
        <View style={styles.headerRightContainer}>
          {hasError && <WarningIcon onPress={onWarningPress} />}
          {hasData && (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContent}>
      {hasData ? (
        <ChartContainer isScrollable={range === 'monthly'}>
          <SvgLineChart data={screeningTrend[range]} width={chartWidth} height={200} labels={labels} color={COLORS.warning} />
        </ChartContainer>
      ) : (
        <NoDataView icon="shield-checkmark-outline" message="No screenings activity" />
      )}
        </View>
      </ViewShot>
    </PanelCard>
)});

const ViolationsCard: React.FC<{
  range: "daily" | "weekly" | "monthly";
  violationSeries: any;
  chartWidth: number;
  scrollRef: React.RefObject<ScrollView | null>;
  setSwipeEnabled: (enabled: boolean) => void;
  viewShotRef: React.RefObject<ViewShot | null>;
  onDownload: () => void;
  hasError?: boolean;
  onWarningPress?: () => void;
}> = memo(({ range, violationSeries, chartWidth, scrollRef, setSwipeEnabled, viewShotRef, onDownload, hasError, onWarningPress }) => {
    const totalViolations = useMemo(() => {
      const data = violationSeries[range] || [];
      return data.reduce((acc: number, item: any) => acc + Number(item.spam || 0) + Number(item.offensive || 0) + Number(item.harassment || 0), 0);
    }, [violationSeries, range]);

    return (
    <PanelCard 
      title={`${range.charAt(0).toUpperCase() + range.slice(1)} Violation Breakdown`}
      headerRight={
        <View style={styles.headerRightContainer}>
          {hasError && <WarningIcon onPress={onWarningPress} />}
          {totalViolations > 0 && (
            <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContent}>
      <Text style={styles.reportSummary}>Total Violations: <Text style={styles.boldText}>{totalViolations.toLocaleString()}</Text></Text>
      {totalViolations > 0 ? (
        <View style={styles.centeredChart}>
          <ChartContainer isScrollable={range === 'monthly'} scrollRef={scrollRef} onTouchStart={() => setSwipeEnabled(false)} onTouchEnd={() => setSwipeEnabled(true)}>
            <SvgBarChart data={violationSeries[range].map((v: any) => ({ spam: v.spam, offensive: v.offensive, harassment: v.harassment }))} width={chartWidth} labels={violationSeries[range].map((v: any) => v.label)} height={250} stackColors={{ spam: COLORS.danger, offensive: COLORS.warning, harassment: "#9B59B6" }} />
          </ChartContainer>
          <View style={styles.barChartLegend}>
            {Object.entries({ Spam: COLORS.danger, Offensive: COLORS.warning, Harassment: "#9B59B6" }).map(([key, color]) => (<View key={key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{key}</Text></View>))}
          </View>
        </View>
      ) : (
        <NoDataView icon="alert-circle-outline" message="No violations recorded" />
      )}
        </View>
      </ViewShot>
    </PanelCard>
    );
});

const TopViolatorsCard: React.FC<{ range: "daily" | "weekly" | "monthly"; topViolators: any; hasError?: boolean; onWarningPress?: () => void; viewShotRef: React.RefObject<ViewShot | null>; onDownload: () => void; onViewAll: () => void }> = memo(({ range, topViolators, hasError, onWarningPress, viewShotRef, onDownload, onViewAll }) => {
    const currentViolators = (topViolators[range] || []).slice(0, 5);
    const totalViolations = useMemo(() => currentViolators.reduce((sum: number, user: any) => sum + (Number(user.violationCount) || 0), 0), [currentViolators]);
    const hasData = currentViolators.length > 0 && totalViolations > 0;
    const navigation = useNavigation<any>();

    return (
      <PanelCard 
        title={`${range.charAt(0).toUpperCase() + range.slice(1)} Top Violators`}
        headerRight={
          <View style={styles.headerRightContainer}>
            {hasError && <WarningIcon onPress={onWarningPress} />}
            {hasData && (
              <TouchableOpacity onPress={onDownload} style={styles.iconButton}>
                <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        }
      >
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={styles.cardContent}>
        {hasData && (
          <Text style={styles.reportSummary}>A total of <Text style={styles.boldText}>{totalViolations} violations</Text> from the top 5 users this period.</Text>
        )}
        {hasData ? (
          currentViolators.map((user: any) => (
            <LiveActivityItem
              key={user.id}
              icon="alert-circle-outline"
              iconColor={COLORS.danger}
              iconBgColor="rgba(231, 76, 60, 0.1)"
              title={user.name}
              subtitle={user.mostFrequentType || 'Unknown'}
              tag={`${user.violationCount}`}
              tagColor={COLORS.danger}
              onPress={() => navigation.navigate("Users", { userId: user.id })}
            />
          ))
        ) : (
          <NoDataView icon="people-outline" message="No violators found" />
        )}
        </View>
        </ViewShot>
        {hasData && (
            <TouchableOpacity onPress={onViewAll} style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderLighter, marginTop: 4 }}>
               <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14 }}>View All Violations</Text>
            </TouchableOpacity>
        )}
      </PanelCard>
    );
});

/* -------------------------- ReportsTab -------------------------- */
const ReportsTab: React.FC = memo(() => {
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const { setSwipeEnabled, users, loadingUsers, violations } = useDashboardContext();
  const navigation = useNavigation<any>();
  const showAlert = useAlert();
  const [messageData, setMessageData] = useState<number[]>([]);
  const [userRegistrationData, setUserRegistrationData] = useState<number[]>([]);
  const [screeningTrend, setScreeningTrend] = useState<Record<string, number[]>>({ daily: [], weekly: [], monthly: [] });
  const [screeningStats, setScreeningStats] = useState<Record<string, { passed: number, flagged: number }>>({ daily: { passed: 0, flagged: 0 }, weekly: { passed: 0, flagged: 0 }, monthly: { passed: 0, flagged: 0 } });
  const [violationSeries, setViolationSeries] = useState<Record<string, any[]>>({ daily: [], weekly: [], monthly: [] });
  const [topViolators, setTopViolators] = useState<Record<string, any[]>>({ daily: [], weekly: [], monthly: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartErrors, setChartErrors] = useState<Record<string, boolean>>({});
  const [showViolationsModal, setShowViolationsModal] = useState(false);

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

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' | 'destructive' }>({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' | 'destructive' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const monthlyMessagesScrollViewRef = useRef<ScrollView>(null);
  const monthlyUsersScrollViewRef = useRef<ScrollView>(null);
  const monthlyViolationsScrollViewRef = useRef<ScrollView>(null);

  const userStatusChartRef = useRef<ViewShot>(null);
  const newRegistrationsChartRef = useRef<ViewShot>(null);
  const messagesChartRef = useRef<ViewShot>(null);
  const screeningTrendChartRef = useRef<ViewShot>(null);
  const screeningsChartRef = useRef<ViewShot>(null);
  const violationsChartRef = useRef<ViewShot>(null);
  const topViolatorsChartRef = useRef<ViewShot>(null);

  const handleSetRange = useCallback((r: "daily" | "weekly" | "monthly") => {
    setRange(r);
    // isLoading is set to true within the processData effect.
  }, []);

  const labels = useMemo(() => {
    const newLabels: string[] = [];
    if (range === 'daily') {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
      for (let i = 0; i < 7; i++) {
        const d = new Date(curr);
        d.setDate(first + i);
        newLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      }
    } else if (range === 'weekly') {
      for (let i = 3; i >= 0; i--) {
         newLabels.push(`W${4-i}`);
      }
    } else { // monthly
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        newLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
      }
    }
    return newLabels;
  }, [range]);

  const handleWarningPress = useCallback((chartName: string) => {
    showAlert({
      title: "Data Load Error",
      message: `We couldn't load the data for "${chartName}". This might be due to a network issue or a temporary server glitch.`,
      buttons: [{ text: "OK" }]
    });
  }, [showAlert]);

  const handleDownloadReport = useCallback(async () => {
    const exportCSV = async () => {
      try {
        const headers = "Section,Metric,Value\n";
        const rows: string[] = [];
        labels.forEach((label, i) => {
          rows.push(`Messages Sent (${range}),${label},${messageData[i] || 0}`);
          rows.push(`New Registrations (${range}),${label},${userRegistrationData[i] || 0}`);
        });
        const active = users.filter(u => u.status === 'active').length;
        const suspended = users.filter(u => u.status === 'suspended').length;
        rows.push(`User Status,Active,${active}`);
        rows.push(`User Status,Suspended,${suspended}`);
        
        const sStats = screeningStats[range] || { passed: 0, flagged: 0 };
        rows.push(`Screenings,Passed,${sStats.passed}`);
        rows.push(`Screenings,Flagged,${sStats.flagged}`);

        const vData = violationSeries[range] || [];
        const spamTotal = vData.reduce((acc, item) => acc + (Number(item.spam)||0), 0);
        const offensiveTotal = vData.reduce((acc, item) => acc + (Number(item.offensive)||0), 0);
        const harassmentTotal = vData.reduce((acc, item) => acc + (Number(item.harassment)||0), 0);
        rows.push(`Violations,Spam,${spamTotal}`);
        rows.push(`Violations,Offensive,${offensiveTotal}`);
        rows.push(`Violations,Harassment,${harassmentTotal}`);

        const csv = headers + rows.join('\n');
        const filename = `report_${range}_${new Date().toISOString().split('T')[0]}.csv`;

        if (Platform.OS === "android") {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, "text/csv");
            await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
            showToast("CSV Report saved successfully.", "success");
          }
        } else {
          const fileUri = `${FileSystem.documentDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(fileUri);
        }
      } catch (error) {
        showToast("Failed to export CSV.", "error");
      }
    };

    const exportPDF = async () => {
      try {
        const vData = violationSeries[range] || [];
        const spamTotal = vData.reduce((acc, item) => acc + (Number(item.spam)||0), 0);
        const offensiveTotal = vData.reduce((acc, item) => acc + (Number(item.offensive)||0), 0);
        const harassmentTotal = vData.reduce((acc, item) => acc + (Number(item.harassment)||0), 0);
        const sStats = screeningStats[range] || { passed: 0, flagged: 0 };

        const html = `
          <html>
            <head><style>body{font-family:Helvetica;padding:20px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}.section{margin-top:30px}</style></head>
            <body>
              <h1>Report: ${range.toUpperCase()}</h1>
              <p>Generated: ${new Date().toLocaleString()}</p>
              <div class="section"><h2>Activity</h2><table><tr><th>Period</th><th>Messages</th><th>New Registrations</th></tr>${labels.map((l, i) => `<tr><td>${l}</td><td>${messageData[i] || 0}</td><td>${userRegistrationData[i] || 0}</td></tr>`).join('')}</table></div>
              <div class="section"><h2>Overall Status</h2><p>Active: ${users.filter(u => u.status === 'active').length}</p><p>Suspended: ${users.filter(u => u.status === 'suspended').length}</p></div>
              <div class="section">
                <h2>Screenings</h2>
                <p>Passed: ${sStats.passed}</p><p>Flagged: ${sStats.flagged}</p>
              </div>
              <div class="section">
                <h2>Violations</h2>
                <p>Spam: ${spamTotal}</p><p>Offensive: ${offensiveTotal}</p><p>Harassment: ${harassmentTotal}</p>
              </div>
            </body>
          </html>`;
        const { uri } = await Print.printToFileAsync({ html });
        const filename = `report_${range}_${new Date().toISOString().split('T')[0]}.pdf`;

        if (Platform.OS === "android") {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            const safUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, "application/pdf");
            await FileSystem.writeAsStringAsync(safUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            showToast("PDF Report saved successfully.", "success");
          }
        } else {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
      } catch (error) {
        showToast("Failed to export PDF.", "error");
      }
    };

    showAlert({
      title: "Export Report",
      message: "Choose a format",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "CSV", onPress: exportCSV },
        { text: "PDF", onPress: exportPDF }
      ]
    });
  }, [range, labels, messageData, userRegistrationData, users, violationSeries, screeningStats, showAlert, showToast]);

  const handleDownloadChart = useCallback(async (chartName: string, ref: React.RefObject<ViewShot | null>) => {
    if (!ref.current?.capture) {
        showToast("Failed to capture chart. Component not ready.", "error");
        return;
    }
    try {
        const uri = await ref.current.capture();
        if (!uri) throw new Error("Failed to capture chart URI.");

        const filename = `${chartName}_${range}_${new Date().toISOString().split('T')[0]}.png`;

        if (Platform.OS === "android") {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const safUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, "image/png");
                await FileSystem.writeAsStringAsync(safUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                showToast("Chart image saved successfully.", "success");
            }
        } else {
            await Sharing.shareAsync(uri, { UTI: '.png', mimeType: 'image/png' });
        }
    } catch (error) {
        console.error("Chart download error:", error);
        showToast("Failed to save chart image.", "error");
    }
  }, [range, showToast]);

  const parseDate = useCallback((str: string) => {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }, []);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchReportData = useCallback(async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      setChartErrors({}); // Reset errors
      
      // The API now returns arrays of the correct length, so we can fetch data directly.
      // Label generation is handled by the `useMemo` hook above.

      // Helper to safely fetch data without throwing
      const fetchData = (type: string) => 
        axios.get(`${API_BASE_URL}/reports.php?type=${type}&range=${range}`)
          .catch(e => {
            console.error(`Failed to fetch ${type} report data`, e);
            return { data: { success: false, data: [] } };
          });

      try {
        const [userRes, msgRes, screeningRes, violationRes, topViolatorsRes] = await Promise.all([
          fetchData('users'),
          fetchData('messages'),
          fetchData('screenings'),
          fetchData('violations'),
          fetchData('top_violators')
        ]);

        if (!isMounted.current) return;

        const newErrors: Record<string, boolean> = {};

        if (userRes.data?.success && Array.isArray(userRes.data.data)) {
          setUserRegistrationData(userRes.data.data.map((v: any) => Number(v) || 0));
        } else {
          setUserRegistrationData(new Array(labels.length).fill(0));
          newErrors.registrations = true;
        }

        if (msgRes.data?.success && Array.isArray(msgRes.data.data)) {
          setMessageData(msgRes.data.data.map((v: any) => Number(v) || 0));
        } else {
          setMessageData(new Array(labels.length).fill(0));
          newErrors.messages = true;
        }

        // Process Screening Trend (response index 2)
        if (screeningRes.data?.success) {
          if (Array.isArray(screeningRes.data.data)) {
            setScreeningTrend(prev => ({ ...prev, [range]: screeningRes.data.data.map((v: any) => Number(v) || 0) }));
          }
          if (screeningRes.data.stats) {
            setScreeningStats(prev => ({ ...prev, [range]: screeningRes.data.stats }));
          }
        } else {
          setScreeningTrend(prev => ({ ...prev, [range]: new Array(labels.length).fill(0) }));
          newErrors.screeningTrend = true;
        }

        // Process Violation Breakdown (response index 3)
        if (violationRes.data?.success && Array.isArray(violationRes.data.data)) {
          // Map API data to labels if needed, though API returns aligned array
          const formattedViolations = violationRes.data.data.map((d: any, i: number) => ({ ...d, label: labels[i] }));
          setViolationSeries(prev => ({ ...prev, [range]: formattedViolations }));
        } else {
          setViolationSeries(prev => ({ ...prev, [range]: labels.map(l => ({ label: l, spam: 0, offensive: 0, harassment: 0 })) }));
          newErrors.violations = true;
        }

        // Process Top Violators (response index 4)
        if (topViolatorsRes.data?.success && Array.isArray(topViolatorsRes.data.data)) {
          setTopViolators(prev => ({ ...prev, [range]: topViolatorsRes.data.data }));
        } else {
          // Don't necessarily clear old data, but mark error
          newErrors.topViolators = true;
        }

        setChartErrors(newErrors);
        
        if (Object.keys(newErrors).length > 0) {
          showToast("Failed to load some report data.", "warning");
        }

      } catch (e) {
        if (!isMounted.current) return;
        console.error("Failed to fetch report data", e);
        setUserRegistrationData(new Array(labels.length).fill(0));
        setMessageData(new Array(labels.length).fill(0));
        setScreeningTrend(prev => ({ ...prev, [range]: new Array(labels.length).fill(0) }));
        setViolationSeries(prev => ({ ...prev, [range]: labels.map(l => ({ label: l, spam: 0, offensive: 0, harassment: 0 })) }));
        showToast("Failed to fetch report data.", "error");
      } finally {
        if (isMounted.current) {
          if (isRefresh) setIsRefreshing(false);
          else setIsLoading(false);
        }
      }
  }, [range, labels, showToast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const onRefresh = useCallback(() => fetchReportData(true), [fetchReportData]);

  useEffect(() => {
    if (range === 'monthly') {
      setTimeout(() => { // A small delay to ensure layout is complete before scrolling
        monthlyMessagesScrollViewRef.current?.scrollToEnd({ animated: true });
        monthlyUsersScrollViewRef.current?.scrollToEnd({ animated: true });
        monthlyViolationsScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [range]);

  const screenWidth = Dimensions.get("window").width;
  const baseChartWidth = screenWidth - 32;

  const chartWidth = useMemo(() => {
    if (range === 'monthly') return Math.max(baseChartWidth, labels.length * 60);
    return baseChartWidth;
  }, [range, baseChartWidth, labels.length]);

  if ((loadingUsers && users.length === 0) || isLoading) return <ReportsSkeleton />;

  return (
    <View style={{ flex: 1 }}>
    <Animated.ScrollView 
      ref={scrollViewRef}
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: 32 }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <ReportsHeader range={range} setRange={handleSetRange} onDownload={handleDownloadReport} />
      <Animated.View key={range} entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)}>
        <UserStatusCard 
            users={users} 
            viewShotRef={userStatusChartRef} 
            onDownload={() => handleDownloadChart('user_status', userStatusChartRef)} 
        />
        <NewRegistrationsCard 
            range={range} 
            data={userRegistrationData} 
            labels={labels} 
            chartWidth={chartWidth} 
            scrollRef={monthlyUsersScrollViewRef} 
            setSwipeEnabled={setSwipeEnabled} 
            viewShotRef={newRegistrationsChartRef}
            onDownload={() => handleDownloadChart('new_registrations', newRegistrationsChartRef)}
            hasError={chartErrors.registrations}
            onWarningPress={() => handleWarningPress("New Registrations")}
        />
        <MessagesChartCard 
            range={range} 
            data={messageData} 
            labels={labels} 
            chartWidth={chartWidth} 
            scrollRef={monthlyMessagesScrollViewRef} 
            setSwipeEnabled={setSwipeEnabled} 
            viewShotRef={messagesChartRef}
            onDownload={() => handleDownloadChart('messages_sent', messagesChartRef)}
            hasError={chartErrors.messages}
            onWarningPress={() => handleWarningPress("Messages Sent")}
        />
        <ScreeningTrendCard 
            range={range} 
            screeningTrend={screeningTrend} 
            chartWidth={chartWidth} 
            labels={labels} 
            viewShotRef={screeningTrendChartRef}
            onDownload={() => handleDownloadChart('screening_trend', screeningTrendChartRef)}
            hasError={chartErrors.screeningTrend}
            onWarningPress={() => handleWarningPress("Screening Trend")}
        />
        <ScreeningsCard 
            range={range} 
            stats={screeningStats[range]} 
            viewShotRef={screeningsChartRef}
            onDownload={() => handleDownloadChart('screening_results', screeningsChartRef)}
        />
        <ViolationsCard 
            range={range} 
            violationSeries={violationSeries} 
            chartWidth={chartWidth} 
            scrollRef={monthlyViolationsScrollViewRef} 
            setSwipeEnabled={setSwipeEnabled} 
            viewShotRef={violationsChartRef}
            onDownload={() => handleDownloadChart('violation_breakdown', violationsChartRef)}
            hasError={chartErrors.violations}
            onWarningPress={() => handleWarningPress("Violation Breakdown")}
        />
        <TopViolatorsCard 
            range={range} 
            topViolators={topViolators} 
            hasError={chartErrors.topViolators} 
            onWarningPress={() => handleWarningPress("Top Violators")} 
            viewShotRef={topViolatorsChartRef}
            onDownload={() => handleDownloadChart('top_violators', topViolatorsChartRef)}
            onViewAll={() => setShowViolationsModal(true)}
        />
      </Animated.View>
    </Animated.ScrollView>
      
      <Modal transparent visible={showViolationsModal} animationType="fade" onRequestClose={() => setShowViolationsModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowViolationsModal(false)}>
          <View style={[styles.modalContent, { height: '80%' }]} onStartShouldSetResponder={() => true}>
             <TouchableOpacity onPress={() => setShowViolationsModal(false)} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
             <Text style={styles.modalSectionTitle}>All Recent Violations</Text>
             <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
               {violations && violations.length > 0 ? violations.map((v, i) => (
                  <LiveActivityItem
                    key={v.id || i}
                    icon="alert-circle-outline"
                    iconColor={COLORS.danger}
                    iconBgColor="rgba(231, 76, 60, 0.1)"
                    title={v.userName || 'Unknown'}
                    subtitle={`${v.type} • ${v.date}`}
                    tag="Review"
                    tagColor={COLORS.primary}
                    onPress={() => { setShowViolationsModal(false); navigation.navigate("Users", { userId: v.userId }); }}
                  />
               )) : <Text style={styles.emptyStateText}>No violations found.</Text>}
             </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Animated.View style={[styles.scrollToTopButton, scrollToTopStyle]}>
        <TouchableOpacity onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-up" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
      </Animated.View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast(prev => ({ ...prev, visible: false }))} />
    </View>
  );
});

export default ReportsTab;
