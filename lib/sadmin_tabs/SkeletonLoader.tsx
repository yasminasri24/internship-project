// app/sadmin_tabs/SkeletonLoader.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SkeletonItem = ({ width, height, style, borderRadius = 4 }: { width?: number | string; height?: number | string; style?: ViewStyle; borderRadius?: number }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { backgroundColor: '#E1E9EE', borderRadius, width: width as any, height: height as any },
        style,
        animatedStyle,
      ]}
    />
  );
};

export const DashboardSkeleton = () => (
  <View style={styles.container}>
    <View style={styles.card}>
      <SkeletonItem width={120} height={20} style={{ marginBottom: 16 }} />
      <View style={styles.row}>
        <SkeletonItem width={(width - 64) / 2} height={80} borderRadius={12} />
        <SkeletonItem width={(width - 64) / 2} height={80} borderRadius={12} />
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        <SkeletonItem width={(width - 64) / 2} height={80} borderRadius={12} />
        <SkeletonItem width={(width - 64) / 2} height={80} borderRadius={12} />
      </View>
    </View>

    <View style={styles.card}>
      <SkeletonItem width={150} height={20} style={{ marginBottom: 16 }} />
      <View style={styles.row}>
        <SkeletonItem width={(width - 64) / 3} height={60} borderRadius={8} />
        <SkeletonItem width={(width - 64) / 3} height={60} borderRadius={8} />
        <SkeletonItem width={(width - 64) / 3} height={60} borderRadius={8} />
      </View>
      <SkeletonItem width="100%" height={10} style={{ marginTop: 20 }} />
      <SkeletonItem width="100%" height={10} style={{ marginTop: 12 }} />
      <SkeletonItem width="80%" height={10} style={{ marginTop: 12 }} />
    </View>
  </View>
);

export const UsersSkeleton = () => (
  <View style={styles.container}>
    <View style={[styles.row, { marginBottom: 16 }]}>
      <SkeletonItem width="75%" height={40} borderRadius={8} />
      <SkeletonItem width="20%" height={40} borderRadius={8} />
    </View>
    {[1, 2, 3, 4, 5, 6, 7].map((key) => (
      <View key={key} style={styles.userCard}>
        <View style={{ flex: 1 }}>
          <SkeletonItem width="60%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonItem width="40%" height={12} />
        </View>
        <SkeletonItem width={30} height={30} borderRadius={15} />
      </View>
    ))}
  </View>
);

export const ReportsSkeleton = () => (
  <View style={styles.container}>
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
      <SkeletonItem width="90%" height={40} borderRadius={20} />
    </View>
    <View style={styles.card}>
      <SkeletonItem width={150} height={20} style={{ marginBottom: 16 }} />
      <SkeletonItem width="100%" height={200} borderRadius={8} />
    </View>
    <View style={styles.card}>
      <SkeletonItem width={150} height={20} style={{ marginBottom: 16 }} />
      <SkeletonItem width="100%" height={200} borderRadius={8} />
    </View>
    <View style={styles.card}>
      <SkeletonItem width={120} height={20} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 }}>
        <SkeletonItem width={100} height={100} borderRadius={50} />
        <View>
          <SkeletonItem width={100} height={16} style={{ marginBottom: 8 }} />
          <SkeletonItem width={100} height={16} />
        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  }
});
