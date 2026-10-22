import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/Button';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { NATIVE_DRIVER } from '../theme/motion';
import type { Walker } from '../data/careTeam';
import { formatMoney } from './walkPlans';

const TIPS = [20, 50, 100, 0] as const;
const COMPACT_HEIGHT = 740;

interface WalkCompleteModalProps {
  walker: Walker;
  minutesWalked: number;
  km: number;
  kcal: number;
  fare: number;
  onDone: (rating: number, tip: number) => void;
}

/** "Walk Completed! Barnaby is Home Safe" — rate the walker and add a tip. */
export function WalkCompleteModal({ walker, minutesWalked, km, kcal, fare, onDone }: WalkCompleteModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < COMPACT_HEIGHT;
  const badgeSize = compact ? 116 : 140;
  const [enter] = useState(() => new Animated.Value(0));
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState<number>(50);
  const firstName = walker.name.split(' ')[0];

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          role="dialog"
          aria-label="Walk completed"
          style={[
            styles.dialog,
            {
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
        >
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
              <MascotDockSlot variant="popup" diameter={badgeSize} />
              <View style={styles.homeBadge}>
                <Icon name="home" size={18} color={colors.onPrimary} />
              </View>
            </View>

            <Text style={styles.title}>🎉 Walk Completed!</Text>
            <Text style={styles.subtitle}>Barnaby is Home Safe</Text>

            <View style={styles.stats}>
              <Stat icon="timer" value={`${Math.round(minutesWalked)} min`} label="Walked" />
              <Stat icon="route" value={`${km.toFixed(2)} km`} label="Distance" />
              <Stat icon="local-fire-department" value={`${kcal}`} label="kcal" />
            </View>

            <Text style={styles.label}>Rate {firstName}</Text>
            <View style={styles.stars} role="radiogroup">
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  hitSlop={4}
                >
                  <Icon
                    name={value <= rating ? 'star' : 'star-border'}
                    size={34}
                    color={value <= rating ? colors.amber : colors.placeholder}
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Add a tip for {firstName}</Text>
            <View style={styles.tips}>
              {TIPS.map((amount) => {
                const selected = tip === amount;
                return (
                  <Pressable
                    key={amount}
                    onPress={() => setTip(amount)}
                    role="radio"
                    aria-checked={selected}
                    style={[styles.tip, selected && styles.tipSelected]}
                  >
                    <Text style={[styles.tipText, selected && styles.tipTextSelected]}>
                      {amount === 0 ? 'No tip' : formatMoney(amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.meta}>
              Walk {formatMoney(fare)} · Tip {formatMoney(tip)} · Total {formatMoney(fare + tip)}
            </Text>

            <PrimaryButton
              label="Done"
              trailingIcon="check"
              onPress={() => onDone(rating, tip)}
              style={styles.stretch}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24, 26, 32, 0.45)',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '90%',
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  content: {
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  contentCompact: {
    gap: 6,
    padding: 16,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stage,
    borderWidth: 6,
    borderColor: colors.successTint,
  },
  homeBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.card,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.successInk,
    marginTop: -4,
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    color: colors.ink,
  },
  meta: {
    ...typography.bodySm,
    textAlign: 'center',
  },
  label: {
    ...typography.label,
    marginTop: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  tips: {
    flexDirection: 'row',
    gap: 8,
  },
  tip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  tipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tipText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  tipTextSelected: {
    color: colors.onPrimary,
  },
  stretch: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
});
