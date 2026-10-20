import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/Button';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../theme/motion';
import { WALKERS, type WalkerId } from '../data/careTeam';
import { PulseRings } from './PulseRings';
import { formatMoney, type WalkMinutes, type WalkTiming } from './walkPlans';

const SEARCH_MS = 4000;
/** Below this window height the radar shrinks so the dialog fits without scrolling. */
const COMPACT_HEIGHT = 740;

export interface WalkSummary {
  timing: WalkTiming;
  slotLabel: string | null;
  minutes: WalkMinutes;
  total: number;
  placeEmoji: string;
  placeLabel: string;
}

interface FindingWalkersModalProps {
  summary: WalkSummary;
  preferredWalkerId: WalkerId | null;
  onCancel: () => void;
  onDone: (walkerId: WalkerId, etaMinutes: number) => void;
}

const statusFor = (percent: number) =>
  percent < 35
    ? 'Contacting 4 walkers nearby...'
    : percent < 70
      ? "Checking Barnaby's favourite walkers..."
      : 'Locking walker availability...';

/**
 * Screen 7 — dispatch radar over the pickup map. Barnaby walks in place,
 * scanning left and right, until a walker is matched after 4 seconds.
 */
export function FindingWalkersModal({
  summary,
  preferredWalkerId,
  onCancel,
  onDone,
}: FindingWalkersModalProps) {
  const { bark, setScanning } = useMascotActions();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < COMPACT_HEIGHT;
  const radarSize = compact ? 118 : 150;
  const [phase, setPhase] = useState<'searching' | 'matched'>('searching');
  const [percent, setPercent] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));

  const walkerId: WalkerId = preferredWalkerId ?? 'alex';
  const walker = WALKERS[walkerId];
  const etaMinutes = preferredWalkerId ? 9 : 12;

  useEffect(() => {
    setScanning(true);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();

    const listener = progress.addListener(({ value }) => setPercent(Math.round(value * 100)));
    const search = Animated.timing(progress, {
      toValue: 1,
      duration: SEARCH_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    search.start(({ finished }) => {
      if (!finished) return;
      setScanning(false);
      setPhase('matched');
      bark();
    });

    return () => {
      search.stop();
      progress.removeListener(listener);
      setScanning(false);
    };
  }, [bark, enter, progress, setScanning]);

  const barWidth = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [progress]
  );

  const matched = phase === 'matched';
  const when =
    summary.timing === 'instant' ? `Arriving in ${etaMinutes} mins` : `Confirmed for ${summary.slotLabel}`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]} />

      <PingChip top="12%" left="6%" label="⭐ 4.9 Marcus" tint={colors.primary} />
      <PingChip top="7%" left="54%" label="⭐ 5.0 Elena" tint={colors.coral} delay={500} />
      <PingChip top="19%" left="44%" label="⭐ 4.8 David" tint={colors.amber} delay={1000} />

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          role="dialog"
          aria-label={matched ? 'Walker matched' : 'Fetching nearby walkers'}
          style={[
            styles.dialog,
            {
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
        >
          <View style={[styles.dialogContent, compact && styles.dialogContentCompact]}>
            <View style={styles.livePill}>
              <View style={[styles.liveDot, matched && styles.liveDotDone]} />
              <Text style={styles.liveText}>{matched ? 'WALKER LOCKED IN' : 'LIVE SEARCH RADIUS'}</Text>
            </View>

            <View style={[styles.radar, { height: radarSize + 50 }]}>
              {matched ? null : (
                <PulseRings
                  size={radarSize}
                  colors={[colors.primary, colors.coral, colors.primary]}
                  scaleTo={1.45}
                />
              )}
              <View
                style={[
                  styles.radarCore,
                  { width: radarSize, height: radarSize, borderRadius: radarSize / 2 },
                  matched && styles.radarCoreDone,
                ]}
              >
                <MascotDockSlot variant="popup" diameter={radarSize} />
              </View>
              <View style={styles.pawBadge}>
                <Icon name="pets" size={16} color={colors.coral} />
              </View>
            </View>

            <Text style={styles.title}>{matched ? '🎉 Walker Matched!' : 'Fetching Nearby Walkers...'}</Text>
            <Text style={styles.subtitle}>
              {matched
                ? `${walker.shortName} • ⭐ ${walker.rating.toFixed(1)} — ${when}`
                : 'Matching Barnaby with top-rated, background-checked walkers within 1.5 km'}
            </Text>

            <View style={styles.summary}>
              <Icon
                name={summary.timing === 'instant' ? 'bolt' : 'event'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.summaryText}>
                {summary.timing === 'instant' ? 'Instant' : summary.slotLabel} • {summary.minutes} Mins
                Walk •{' '}
                <Text style={styles.summaryPrice}>{formatMoney(summary.total)}</Text> •{' '}
                {summary.placeEmoji} {summary.placeLabel}
              </Text>
            </View>

            {matched ? (
              <View style={styles.matchCard}>
                <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={48} />
                <View style={styles.flex}>
                  <Text style={styles.matchName}>{walker.name}</Text>
                  <Text style={styles.meta}>
                    {walker.badges.join(' • ')}
                  </Text>
                </View>
                <View style={styles.etaPill}>
                  <Text style={styles.etaText}>
                    {summary.timing === 'instant' ? `${etaMinutes} min` : 'Booked'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.progressBlock}>
                <View style={styles.spaceBetween}>
                  <Text style={styles.meta}>{statusFor(percent)}</Text>
                  <Text style={styles.percent}>{percent}%</Text>
                </View>
                <View
                  style={styles.track}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: percent }}
                >
                  <Animated.View style={[styles.fill, { width: barWidth }]} />
                </View>
                <View style={styles.statusRow}>
                  <Icon name="check-circle" size={15} color={colors.primary} />
                  <Text style={styles.statusStrong}>Route verified</Text>
                  <View style={styles.statusDot} />
                  <View style={[styles.liveDot, styles.liveDotSmall]} />
                  <Text style={styles.meta}>Dispatching radar</Text>
                </View>
              </View>
            )}

            {matched ? (
              <PrimaryButton
                label="Done"
                trailingIcon="check"
                onPress={() => onDone(walkerId, etaMinutes)}
                style={styles.stretch}
              />
            ) : null}
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Icon name="close" size={18} color={colors.ink} />
              <Text style={styles.cancelText}>Cancel Request</Text>
            </Pressable>

            <View style={styles.footer}>
              <Icon name="verified-user" size={14} color={colors.successInk} />
              <Text style={styles.meta}>100% PawPal Certified & GPS Insured</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** Walker avatar pin pinging and drifting over the dimmed map. */
function PingChip({
  top,
  left,
  label,
  tint,
  delay = 0,
}: {
  top: `${number}%`;
  left: `${number}%`;
  label: string;
  tint: string;
  delay?: number;
}) {
  const [ping] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ping, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: NATIVE_DRIVER,
          }),
          Animated.timing(ping, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: NATIVE_DRIVER,
          }),
        ])
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, ping]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ping,
        {
          top,
          left,
          transform: [
            { translateX: ping.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
            { translateY: ping.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
            { scale: ping.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.pingDot, { backgroundColor: tint }]} />
      <Text style={styles.pingText}>{label}</Text>
    </Animated.View>
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
  dialogContent: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  dialogContentCompact: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 14,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: '#F5F7FA',
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.coral,
  },
  liveDotDone: {
    backgroundColor: colors.success,
  },
  liveDotSmall: {
    width: 7,
    height: 7,
  },
  liveText: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.slate,
  },
  radar: {
    width: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stage,
    borderWidth: 6,
    borderColor: colors.coralTint,
  },
  radarCoreDone: {
    borderColor: colors.successTint,
  },
  pawBadge: {
    position: 'absolute',
    top: 18,
    right: 34,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  meta: {
    ...typography.bodySm,
  },
  summary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: '#F5F7FA',
  },
  summaryText: {
    ...typography.label,
    flexShrink: 1,
    textAlign: 'center',
  },
  summaryPrice: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  progressBlock: {
    alignSelf: 'stretch',
    gap: 8,
  },
  percent: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    color: colors.primary,
  },
  track: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusStrong: {
    ...typography.label,
    fontSize: 12,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 4,
    backgroundColor: colors.placeholder,
  },
  matchCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.successTint,
  },
  matchName: {
    ...typography.subhead,
  },
  etaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  etaText: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    color: colors.successInk,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  cancel: {
    alignSelf: 'stretch',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ping: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  pingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pingText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
