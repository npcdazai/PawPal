import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { MascotRef, MascotSprite } from '../components/MascotSprite';
import { Toast } from '../components/Toast';

interface SplashScreenProps {
  onGetStarted: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onGetStarted }) => {
  const mascotRef = useRef<MascotRef>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [countdown, setCountdown] = useState(4);

  const [countdownProgress] = useState(() => new Animated.Value(0));
  const isNavigatingRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const handleStart = React.useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    showToast('Off to adventure! 🐾');

    if (mascotRef.current) {
      mascotRef.current.sprintOff(() => {
        onGetStarted();
      });
    } else {
      setTimeout(onGetStarted, 400);
    }
  }, [onGetStarted]);

  useEffect(() => {
    // 4-second linear progress bar
    Animated.timing(countdownProgress, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownProgress, handleStart]);

  const progressWidth = countdownProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Toast visible={toastVisible} message={toastMessage} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Helper Pill Badge */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            mascotRef.current?.hopAndBark('Woof! 🐾');
            showToast('Woof! 🐾');
          }}
          style={styles.pillBadge}
        >
          <Icon name="pets" size={16} color={colors.onSecondaryFixedVariant} />
          <Text style={styles.pillBadgeText}>Tap Corgi to bark</Text>
        </TouchableOpacity>

        {/* Center Mascot Spotlight Stage */}
        <View style={styles.spotlightWrapper}>
          <View style={styles.spotlightRing}>
            {/* Decorative accent dots */}
            <View style={[styles.dot, styles.dotTopRight]} />
            <View style={[styles.dot, styles.dotBottomLeft]} />
            <View style={[styles.dot, styles.dotTopLeft]} />

            {/* Mascot Character */}
            <MascotSprite
              ref={mascotRef}
              size={210}
              initialMessage="Woof! 🐾"
              onTap={() => showToast('Woof! Barnaby is happy! 🐾')}
            />
          </View>
        </View>

        {/* Typography & Messaging */}
        <View style={styles.textSection}>
          <Text style={styles.headline}>Your Loyal Pet Care Companion</Text>
          <Text style={styles.subhead}>
            Track health, daily walks, nutrition, and keep your best friend joyful every day.
          </Text>
        </View>

        {/* Daily Care Streak Floating Sheet Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <View style={styles.streakIconCircle}>
              <Icon name="local-fire-department" size={24} color={colors.secondaryContainer} />
            </View>
            <View style={styles.streakTextCol}>
              <Text style={styles.streakTitle}>Daily Care Streak</Text>
              <Text style={styles.streakSubtitle}>14 happy days logged!</Text>
            </View>
          </View>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>

        {/* Primary CTA & Countdown Telemetry */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStart}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <Icon name="arrow-forward" size={20} color={colors.onPrimaryContainer} />
          </TouchableOpacity>

          <View style={styles.countdownRow}>
            <View style={styles.countdownTrack}>
              <Animated.View
                style={[
                  styles.countdownFill,
                  {
                    width: progressWidth,
                  },
                ]}
              />
            </View>
            <Text style={styles.countdownLabel}>
              {countdown > 0 ? `Auto-advancing in ${countdown}s...` : 'Advancing...'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.secondaryFixed,
    marginTop: 4,
    marginBottom: 8,
  },
  pillBadgeText: {
    ...typography.labelSm,
    color: colors.onSecondaryFixedVariant,
  },
  spotlightWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  spotlightRing: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.peachBg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.glowSecondary,
  },
  dot: {
    position: 'absolute',
    borderRadius: radii.full,
  },
  dotTopRight: {
    top: -6,
    right: 28,
    width: 20,
    height: 20,
    backgroundColor: colors.tertiaryFixedDim,
    opacity: 0.6,
  },
  dotBottomLeft: {
    bottom: 24,
    left: 16,
    width: 14,
    height: 14,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.5,
  },
  dotTopLeft: {
    top: 48,
    left: 24,
    width: 10,
    height: 10,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  textSection: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  headline: {
    ...typography.headlineXlMobile,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subhead: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 290,
  },
  streakCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    padding: 16,
    marginVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  streakIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.peachBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTextCol: {
    flex: 1,
  },
  streakTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.onSurface,
  },
  streakSubtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
  },
  activeBadgeText: {
    ...typography.labelMd,
    color: colors.primary,
    fontWeight: '700',
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.glowPrimary,
  },
  primaryButtonText: {
    ...typography.labelLg,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  countdownTrack: {
    width: 96,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  countdownFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
  },
  countdownLabel: {
    ...typography.labelSm,
    color: colors.outline,
    fontWeight: '500',
  },
});
