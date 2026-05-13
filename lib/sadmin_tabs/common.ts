import { createContext, useContext } from "react";

// --- Types ---

export interface UserItem {
  id: number;
  name: string;
  status: 'active' | 'suspended';
  role?: string;
  joinedDate: string;
  suspensionReason?: string;
  suspensionEndDate?: string;
}

export interface Violation {
  id: number;
  userId: number;
  userName: string;
  type: string;
  date: string;
  reason?: string;
  reporter?: string;
}

export interface Screening {
  id: number;
  userId: number;
  userName: string;
  type: string;
  result: 'passed' | 'flagged' | 'Pending';
  date: string;
  reason?: string;
  reporter?: string;
  screeningDetails?: any;
}

export interface ModerationLog {
  id: number;
  admin_name: string;
  action: string;
  target_name: string;
  reason?: string;
  created_at: string;
  resulting_status?: string;
}

export interface Metric {
  activeUsers: number;
  suspendedUsers: number;
  totalUsers: number;
  screeningsToday: number;
  violationsToday: number;
}

export interface CustomAlertOptions {
  title: string;
  message: string;
  buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
}

export interface PieItem {
  value: number;
  color: string;
  label?: string;
}

export interface SvgLineChartProps {
  data: number[];
  width: number;
  height: number;
  color?: string;
  labels?: string[];
}

export type BarChartDataPoint = number | { label: string; [key: string]: number | string };

export type SadminNavProp = any;

// --- Constants ---

export const INITIAL_METRICS: Metric = {
  activeUsers: 0,
  suspendedUsers: 0,
  totalUsers: 0,
  screeningsToday: 0,
  violationsToday: 0,
};

export const STATUS_COLORS: Record<string, string> = {
  OK: "#2ECC71",
  Running: "#2ECC71",
  Connected: "#2ECC71",
  Down: "#E74C3C",
  Stopped: "#E74C3C",
  Disconnected: "#E74C3C",
  Unknown: "#95a5a6",
  Checking: "#F39C12"
};

// --- Contexts ---

export const DashboardContext = createContext<{
  metrics: Metric;
  violations: Violation[];
  users: UserItem[];
  screenings: Screening[];
  swipeEnabled: boolean;
  loadingUsers: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
  suspendUser: (userId: number, duration: number, reason: string) => void;
  liftSuspension: (userId: number) => void;
  removeUser: (userId: number) => void;
  removeUsersBulk: (userIds: Set<number>) => void;
  refreshData: () => Promise<UserItem[] | undefined>;
} | null>(null);

export const AlertContext = createContext<((options: CustomAlertOptions) => void) | null>(null);

// --- Hooks ---

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboardContext must be used within a DashboardProvider");
  return context;
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error("useAlert must be used within an AlertProvider");
  return context;
};

// --- Utilities ---

export const parseStatus = (status: string) => {
  const key = status === "OK" || status === "Running" || status === "Connected" ? "OK" :
              status === "Down" || status === "Stopped" || status === "Disconnected" ? "Down" :
              status === "Checking..." ? "Checking" : "Unknown";
  return { key, label: status };
};

export const getUsageColor = (usage: number) => {
  if (usage < 50) return "#2ECC71";
  if (usage < 80) return "#F39C12";
  return "#E74C3C";
};

export const controlPoint = (current: any, previous: any, next: any, reverse?: boolean) => {
  const p = previous || current;
  const n = next || current;
  const smoothing = 0.2;
  const o = {
    x: n.x - p.x,
    y: n.y - p.y,
  };
  const angle = Math.atan2(o.y, o.x) + (reverse ? Math.PI : 0);
  const length = Math.sqrt(Math.pow(o.x, 2) + Math.pow(o.y, 2)) * smoothing;
  const x = current.x + Math.cos(angle) * length;
  const y = current.y + Math.sin(angle) * length;
  return [x, y];
};