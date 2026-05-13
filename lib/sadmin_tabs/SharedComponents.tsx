import React, { memo, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ViewStyle, Modal, Pressable, TextInput, StyleSheet, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, FadeIn, FadeOut, Easing } from "react-native-reanimated";
import Svg, { Circle, G, Path, Defs, LinearGradient, Stop, Line, Rect, Text as SvgText } from "react-native-svg";
import { BlurView } from 'expo-blur';
import { styles } from "./styles";
import { PieItem, SvgLineChartProps, controlPoint, BarChartDataPoint, CustomAlertOptions } from "./common";

export const PanelCard: React.FC<{
  title: string;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
}> = memo(({ title, children, onPress, style, headerRight }) => (
  <View style={[styles.panelCard, style]}>
    {onPress ? (
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={onPress} 
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`${title}, tap for action`}
      >
        <Text style={[styles.panelTitle, { marginBottom: 0 }]} accessibilityRole="header">{title}</Text>
        {headerRight}
      </TouchableOpacity>
    ) : (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={[styles.panelTitle, { marginBottom: 0 }]} accessibilityRole="header">{title}</Text>
        {headerRight}
      </View>
    )}
    {/* Render children outside the header touchable area to avoid nested interactive elements */}
    {children}
  </View>
));

export const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  textColor?: string;
  onPress?: () => void;
  badgeVisible?: boolean;
  style?: StyleProp<ViewStyle>;
  showArrow?: boolean;
}> = memo(({ title, value, icon, color = "#fff", textColor = "#333", onPress, badgeVisible, style, showArrow = true }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!badgeVisible) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, [badgeVisible]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: textColor === '#fff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name={icon} size={20} color={textColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: textColor, lineHeight: 24 }} numberOfLines={1}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
        <Text style={{ fontSize: 12, color: textColor, fontWeight: '600', marginTop: 0, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>{title}</Text>
      </View>
      {onPress && showArrow && <Ionicons name="chevron-forward" size={16} color={textColor} style={{ opacity: 0.6 }} />}
      
      {badgeVisible && (
        <Animated.View
          style={[{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#E74C3C", justifyContent: "center", alignItems: "center", zIndex: 10, borderWidth: 1.5, borderColor: '#fff' }, animatedBadgeStyle]}
        />
      )}
    </>
  );

  const containerStyle: StyleProp<ViewStyle> = [{ backgroundColor: color, flex: 1, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 3, shadowColor: color === "#fff" ? "#000" : color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, minHeight: 70 }, style];

  if (onPress) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
    >
      {content}
    </TouchableOpacity>
  );
  }

  return (
    <View style={containerStyle}>
      {content}
    </View>
  );
});

export const SvgPieChart: React.FC<{
  data: PieItem[];
  radius: number;
  innerRadius?: number;
}> = memo(({ data, radius, innerRadius = 0 }) => {
  const safeData = data || [];
  const total = safeData.reduce((s, d) => s + (Number(d.value) || 0), 0);
  let startAngle = 0;

  const polarToCartesian = (cx: number, cy: number, r: number, a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  });

  if (total === 0) {
    return (
      <Svg width={radius * 2} height={radius * 2} accessible accessibilityLabel="Pie chart: No data">
        <G transform={`translate(${radius}, ${radius})`}>
          <Circle cx={0} cy={0} r={radius} fill="#E0E0E0" />
          {innerRadius > 0 && <Circle cx={0} cy={0} r={innerRadius} fill="#fff" />}
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={radius * 2} height={radius * 2} accessible accessibilityLabel="Pie chart">
      <G transform={`translate(${radius}, ${radius})`}>
        {safeData.map((slice, i) => {
          const val = Number(slice.value) || 0;
          const sliceAngle = (val / total) * Math.PI * 2;
          const endAngle = startAngle + sliceAngle;
          const start = polarToCartesian(0, 0, radius, startAngle);
          const end = polarToCartesian(0, 0, radius, endAngle);
          const innerStart = polarToCartesian(0, 0, innerRadius, startAngle);
          const innerEnd = polarToCartesian(0, 0, innerRadius, endAngle);
          const largeArc = sliceAngle > Math.PI ? 1 : 0;

          const path = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
          startAngle = endAngle;
          return <Path key={i} d={path} fill={slice.color} />;
        })}

        {innerRadius > 0 && <Circle cx={0} cy={0} r={innerRadius} fill="#fff" />}
      </G>
    </Svg>
  );
});

export const SvgLineChart: React.FC<SvgLineChartProps> = memo(({ data, width, height, color = "#4A90E2", labels = [] }) => {
  const padding = { top: 30, bottom: 30, left: 35, right: 35 };
  const safeData = (data || []).map(d => {
    const n = Number(d);
    return isNaN(n) ? 0 : n;
  });
  const max = Math.max(...safeData, 1);
  const points = safeData.map((value, i) => {
    const denominator = safeData.length > 1 ? safeData.length - 1 : 1;
    const x = padding.left + (i / denominator) * (width - padding.left - padding.right);
    const y = height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);
    return { x, y, value };
  });
  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    return points.reduce((acc, point, i, a) => {
      if (i === 0) return `M ${point.x},${point.y}`;
      const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
      const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
      return `${acc} C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point.x},${point.y}`;
    }, "");
  }, [points]);

  if (!data || data.length === 0) return <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}><Text>No data</Text></View>;

  const areaPath = `${linePath} L ${points[points.length - 1].x},${height - padding.bottom} L ${points[0].x},${height - padding.bottom} Z`;

  // Optimization for large datasets
  const density = safeData.length;
  const showValues = density <= 12;
  const showDots = density <= 20;
  const labelStep = Math.ceil(labels.length / 10);

  return (
    <Svg width={width} height={height} accessible accessibilityLabel="Line chart">
      <Defs><LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.2" /><Stop offset="1" stopColor={color} stopOpacity="0" /></LinearGradient></Defs>
      <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#eee" />
      <Line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#eee" />
      {[0, 0.25, 0.5, 0.75, 1].map(tick => {
        const y = height - padding.bottom - tick * (height - padding.top - padding.bottom);
        const label = Math.round(tick * max);
        return (<G key={tick}><SvgText x={padding.left - 12} y={y + 4} fill="#888" fontSize="10" textAnchor="end">{label}</SvgText>{tick > 0 && (<Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f0f0f0" strokeDasharray="2,2" />)}</G>);
      })}
      {labels.map((label, i) => {
        if (i % labelStep !== 0) return null;
        if (safeData.length <= 1) return null;
        let x = padding.left + (i / (safeData.length - 1)) * (width - padding.left - padding.right);
        let textAnchor: "start" | "middle" | "end" = "middle";
        if (i === 0) textAnchor = "start";
        else if (i === labels.length - 1) textAnchor = "end";
        return (<SvgText key={i} x={x} y={height - padding.bottom + 15} fill="#555" fontSize="12" textAnchor={textAnchor}>{label}</SvgText>);
      })}
      <Path d={areaPath} fill="url(#grad)" />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" />
      {points.map((p, i) => (
        <G key={i}>
          {showDots && <Circle cx={p.x} cy={p.y} r={6} fill={color} fillOpacity={0.2} />}
          {showDots && <Circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke={color} strokeWidth={1.5} />}
          {showValues && (<>
            <SvgText x={p.x} y={p.y - 12} fill="transparent" fontSize="12" fontWeight="bold" textAnchor="middle" stroke="#fff" strokeWidth={3} strokeLinejoin="round">{p.value}</SvgText>
            <SvgText x={p.x} y={p.y - 12} fill="#333" fontSize="12" fontWeight="bold" textAnchor="middle">{p.value}</SvgText>
          </>)}
        </G>
      ))}
    </Svg>
  );
});

export const SvgBarChart: React.FC<{ data: BarChartDataPoint[]; width: number; height: number; color?: string; stackColors?: Record<string, string>; labels?: string[]; }> = memo(({ data, width, height, color = "#E74C3C", labels = [], stackColors }) => {
  const padding = { top: 30, bottom: 30, left: 35, right: 20 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const safeData = data || [];
  const barWidth = safeData.length > 0 ? chartWidth / safeData.length : 0;
  const totals = safeData.map(d => {
    if (typeof d === 'number') {
      const n = Number(d);
      return isNaN(n) ? 0 : n;
    }
    if (typeof d === 'object' && d !== null) {
      return Object.entries(d).reduce((s, [k, v]) => {
        if (k !== 'label') {
           const n = Number(v);
           return s + (isNaN(n) ? 0 : n);
        }
        return s;
      }, 0);
    }
    return 0;
  });
  const max = Math.max(...totals, 1);

  // Optimization for large datasets
  const density = safeData.length;
  const showValues = density <= 12;
  const labelStep = Math.ceil(labels.length / 10);
  const barGap = density > 20 ? 1 : density > 10 ? 2 : 6;
  const barRectWidth = Math.max(1, barWidth - barGap);

  return (
    <Svg width={width} height={height} accessible accessibilityLabel="Bar chart">
      {[0, 0.25, 0.5, 0.75, 1].map(tick => {
        const y = height - padding.bottom - tick * chartHeight;
        const label = Math.round(tick * max);
        return (<G key={tick}><SvgText x={padding.left - 8} y={y + 4} fill="#888" fontSize="10" textAnchor="end">{label}</SvgText>{tick > 0 && (<Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f0f0f0" strokeDasharray="2,2" />)}</G>);
      })}
      {safeData.map((v, i) => {
        const totalValue = totals[i];
        const totalHeight = (totalValue / max) * chartHeight;
        const x = padding.left + i * barWidth;
        const renderBar = () => {
          if (typeof v === 'number') return <Rect x={x} y={height - padding.bottom - totalHeight} width={barRectWidth} height={totalHeight} fill={color} rx={4} />;
          if (stackColors && typeof v === 'object' && v !== null) {
            let currentHeight = 0;
            return (
              <G>
                {Object.entries(v).map(([key, value]) => {
                  if (key === 'label') return null;
                  const val = Number(value);
                  if (isNaN(val)) return null;
                  const segmentHeight = (val / max) * chartHeight;
                  const rect = (<Rect key={key} x={x} y={height - padding.bottom - currentHeight - segmentHeight} width={barRectWidth} height={segmentHeight} fill={stackColors[key] || color} />);
                  currentHeight += segmentHeight;
                  return rect;
                })}
                <Rect x={x} y={height - padding.bottom - totalHeight} width={barRectWidth} height={totalHeight} fill="transparent" stroke="#fff" strokeWidth={0.5} rx={4} />
              </G>
            );
          }
          return null;
        };
        return (
          <G key={i}>
            {renderBar()}
            {showValues && <SvgText x={x + barRectWidth / 2} y={height - padding.bottom - totalHeight - 5} fill="#333" fontSize="12" textAnchor="middle">{totalValue}</SvgText>}
            {labels[i] && i % labelStep === 0 && (<SvgText x={x + barRectWidth / 2} y={height - padding.bottom + 15} fill="#555" fontSize="12" textAnchor="middle">{labels[i]}</SvgText>)}
          </G>
        );
      })}
    </Svg>
  );
});

// The default export has been removed to prevent Expo Router from treating this file as a route, which can cause module resolution issues.

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Dashboard ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
          <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 }}>
            An unexpected error occurred in the dashboard.
          </Text>
          <TouchableOpacity 
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#4A90E2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reload Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export const CustomAlert: React.FC<{
  visible: boolean;
  options: CustomAlertOptions | null;
  onClose: () => void;
}> = memo(({ visible, options, onClose }) => {
  if (!options) return null;

  const { title, message, buttons } = options;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.alertBackdrop} accessibilityLabel="Dismiss alert" accessibilityRole="button">
        <Pressable onPress={() => {}}>
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.alertContainer} accessibilityViewIsModal>
            <Text style={styles.alertTitle} accessibilityRole="header">{title}</Text>
            <Text style={styles.alertMessage}>{message}</Text>
            <View style={styles.alertButtonRow}>
            {buttons.map((button, index) => {
              const getButtonStyle = () => {
                if (button.style === 'destructive') return styles.alertButtonDestructive;
                if (button.style === 'cancel') return styles.alertButtonCancel;
                return styles.alertButtonDefault;
              };
              const getTextStyle = () => {
                if (button.style === 'destructive') return styles.alertButtonTextDestructive;
                if (button.style === 'cancel') return styles.alertButtonTextCancel;
                return styles.alertButtonTextDefault;
              };

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.alertButton, getButtonStyle()]}
                  onPress={() => { button.onPress?.(); onClose(); }}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                >
                  <Text style={getTextStyle()}>{button.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export const Toast: React.FC<{
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning' | 'destructive';
  onDismiss: () => void;
}> = memo(({ visible, message, type = 'success', onDismiss }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(100);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.exp) });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(100, { duration: 300 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return 'rgba(39, 174, 96, 0.95)'; // Darker Green
      case 'error': return 'rgba(192, 57, 43, 0.95)'; // Darker Red
      case 'info': return 'rgba(41, 128, 185, 0.95)'; // Darker Blue
      case 'warning': return 'rgba(211, 84, 0, 0.95)'; // Darker Orange
      case 'destructive': return 'rgba(192, 57, 43, 0.95)'; // Darker Red
      default: return 'rgba(39, 174, 96, 0.95)';
    }
  };

  const backgroundColor = getBackgroundColor();
  const iconName = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : type === 'warning' ? 'warning' : type === 'destructive' ? 'trash' : 'information-circle';

  return (
    <Animated.View 
      style={[styles.toastContainer, animatedStyle]} 
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
    >
      <View style={styles.toastBlurWrapper}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
        <View style={styles.toastContent}>
          <Ionicons name={iconName} size={24} color="#fff" style={{ marginRight: 10 }} />
          <Text style={[styles.toastText, { flex: 1 }]}>{message}</Text>
          <TouchableOpacity 
            onPress={onDismiss} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

export const SuspendUserModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (duration: number, reason: string) => void;
}> = memo(({ visible, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(7);
  const durations = [{ label: '1 Day', value: 1 }, { label: '7 Days', value: 7 }, { label: '30 Days', value: 30 }, { label: 'Permanent', value: -1 }];

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(duration, reason);
    onClose();
    setReason('');
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.modalBackdrop} accessibilityLabel="Dismiss modal" accessibilityRole="button">
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalSectionTitle} accessibilityRole="header">Suspend User</Text>
          <Text style={{ marginBottom: 16, color: '#555' }}>Select a duration and provide a reason for the suspension.</Text>
          <View style={styles.durationSelector} accessibilityRole="radiogroup">
            {durations.map(d => (
              <TouchableOpacity 
                key={d.value} 
                style={[styles.durationButton, duration === d.value && styles.durationButtonSelected]} 
                onPress={() => setDuration(d.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: duration === d.value }}
                accessibilityLabel={d.label}
              >
                <Text style={[styles.durationButtonText, duration === d.value && styles.durationButtonTextSelected]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.reasonInput} placeholder="Reason for suspension..." value={reason} onChangeText={setReason} multiline accessibilityLabel="Reason for suspension" />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#e0e0e0' }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel"><Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#E74C3C' }]} onPress={handleSubmit} accessibilityRole="button" accessibilityLabel="Confirm Suspension" accessibilityState={{ disabled: !reason.trim() }}><Text style={styles.modalButtonText}>Confirm Suspension</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export const LiveActivityItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  title: React.ReactNode;
  subtitle: string;
  tag?: string;
  tagColor?: string;
  onPress?: () => void;
}> = memo(({ icon, iconColor, iconBgColor, title, subtitle, tag, tagColor, onPress }) => (
  <TouchableOpacity 
    style={styles.activityItem} 
    onPress={onPress} 
    activeOpacity={0.7}
    accessibilityRole="button"
  >
    <View style={[styles.activityItemIcon, { backgroundColor: iconBgColor }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.activityItemContent}>
      {typeof title === 'string' ? <Text style={styles.activityItemTitle}>{title}</Text> : title}
      <Text style={styles.activityItemSubtitle}>{subtitle}</Text>
    </View>
    {tag && (
      <View style={[styles.activityItemTag, { backgroundColor: tagColor }]}>
        <Text style={styles.activityItemTagText}>{tag}</Text>
      </View>
    )}
  </TouchableOpacity>
));