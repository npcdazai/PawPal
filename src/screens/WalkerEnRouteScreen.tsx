import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { ActionSheet } from '../components/ActionSheet';
import { Toast, useToast } from '../components/Toast';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../theme/motion';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, useTrackedWalk } from '../booking/BookingsProvider';
import { NeighborhoodMap } from '../booking/NeighborhoodMap';
import { PulseRings } from '../booking/PulseRings';
import { WalkerChatSheet } from '../booking/WalkerChatSheet';
import { MapPill, PulsingDot, RoundIconButton, TrackingTopBar } from '../booking/trackingUi';
import { enRouteStatus, realMsFor } from '../booking/liveWalk';
import { PICKUP_ROUTE, routeCenter, routeOffset, splitRoute, toSvgPath } from '../booking/walkRoutes';
import { MAP_SIZE } from '../booking/pickupPlaces';
import { WALKERS } from '../data/careTeam';

/** The map-pin slot at Home. */
const HOME_PIN = 68;
const WALKER_PIN = 54;
const START_DELAY_MS = 750;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Screen 8 — walker heading to the pickup, with the handover OTP. */
export function WalkerEnRouteScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { go } = useAppNavigation();
  const { barkWith } = useMascotActions();
  const { startWalk, cancelWalk } = useBookings();
  const booking = useTrackedWalk();
  const { message, show } = useToast();

  const [now, setNow] = useState(() => Date.now());
  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [walkerProgress] = useState(() => new Animated.Value(0));
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [starting, setStarting] = useState(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const pending = startTimer;
    return () => {
      clearInterval(tick);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  // Glide the walker pin from where they are now to the front door.
  const matchedAt = booking?.matchedAt;
  const etaMinutes = booking?.etaMinutes;
  useEffect(() => {
    if (!matchedAt || !etaMinutes) return undefined;
    const status = enRouteStatus({ matchedAt, etaMinutes }, Date.now());
    walkerProgress.setValue(status.progress);
    const glide = Animated.timing(walkerProgress, {
      toValue: 1,
      duration: realMsFor(status.remainingSec),
      easing: Easing.linear,
      useNativeDriver: NATIVE_DRIVER,
    });
    glide.start();
    return () => glide.stop();
  }, [matchedAt, etaMinutes, walkerProgress]);

  const walkerOffset = useMemo(() => routeOffset(PICKUP_ROUTE, walkerProgress), [walkerProgress]);
  const heading = useMemo(() => headingFor(walkerProgress), [walkerProgress]);

  if (!booking) {
    return <NoActiveWalk onBack={() => go('exitTracking')} />;
  }

  const walker = WALKERS[booking.walkerId];
  const status = enRouteStatus(booking, now);
  const { rest } = splitRoute(PICKUP_ROUTE, status.progress);
  const start = PICKUP_ROUTE.points[0];
  const home = PICKUP_ROUTE.points[PICKUP_ROUTE.points.length - 1];
  const mapHeight = Math.round(windowHeight * 0.5);

  const verifyAndStart = () => {
    if (starting) return;
    setStarting(true);
    barkWith("Woof! Let's go! 🐾");
    startTimer.current = setTimeout(() => {
      startWalk(booking.id);
      go('startLiveWalk');
    }, START_DELAY_MS);
  };

  const call = () =>
    Linking.openURL(`tel:${walker.phone}`).catch(() => show('Calling isn’t available here'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TrackingTopBar
        title="Live Walker Tracking"
        onBack={() => go('exitTracking')}
        onInfo={() => show('Live GPS · your walker’s position updates every second')}
      />

      <View
        style={[styles.mapArea, { height: mapHeight }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          const center = routeCenter(PICKUP_ROUTE.points);
          pan.setValue({ x: width / 2 - center.x, y: height / 2 - center.y + 20 });
        }}
      >
        <View style={StyleSheet.absoluteFill}>
          <NeighborhoodMap pan={pan} showWalkers={false}>
            <Svg pointerEvents="none" style={styles.layer} width={MAP_SIZE.width} height={MAP_SIZE.height}>
              <Path
                d={toSvgPath(rest)}
                stroke={colors.primary}
                strokeWidth={5}
                strokeDasharray="12 9"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>

            {/* Pickup pin: Barnaby waits here with his leash */}
            <View
              pointerEvents="box-none"
              style={[
                styles.homePin,
                { left: home.x - HOME_PIN / 2, top: home.y - HOME_PIN / 2 },
              ]}
            >
              <PulseRings size={HOME_PIN} colors={[colors.coral, colors.coral]} scaleTo={1.7} />
              <MascotDockSlot variant="map-pin" style={styles.homeShadow} />
              <View pointerEvents="none" style={styles.pickupTag}>
                <Icon name="home" size={13} color={colors.onPrimary} />
                <Text style={styles.pickupText}>Pickup</Text>
              </View>
            </View>

            {/* Walker gliding toward home */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.walkerPin,
                {
                  left: start.x - WALKER_PIN / 2,
                  top: start.y - WALKER_PIN / 2,
                  transform: [{ translateX: walkerOffset.x }, { translateY: walkerOffset.y }],
                },
              ]}
            >
              <View style={styles.walkerLabel}>
                <View style={styles.walkerLabelDot} />
                <Text style={styles.walkerLabelText}>{walker.name.split(' ')[0]} (Walker)</Text>
              </View>
              <View style={styles.walkerGlow} />
              <Animated.View style={[styles.cone, { transform: [{ rotate: heading }] }]}>
                <Icon name="navigation" size={22} color={colors.primary} />
              </Animated.View>
              <Avatar
                initials={walker.initials}
                tint={colors.card}
                ink={colors.primary}
                size={WALKER_PIN}
                style={styles.walkerAvatar}
              />
              <View style={styles.walkingBadge}>
                <Icon name="directions-walk" size={13} color={colors.onPrimary} />
              </View>
            </Animated.View>
          </NeighborhoodMap>
        </View>

        <View style={styles.etaRow} pointerEvents="none">
          <MapPill>
            <PulsingDot />
            {status.arrived ? (
              <Text style={styles.etaText}>
                🎉 {walker.name.split(' ')[0]} has arrived · share your OTP
              </Text>
            ) : (
              <Text style={styles.etaText}>
                🐕 Walker arriving in{' '}
                <Text style={styles.etaStrong}>
                  {status.remainingMin} min{status.remainingMin === 1 ? '' : 's'}
                </Text>{' '}
                ({status.km.toFixed(1)} km away)
              </Text>
            )}
          </MapPill>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>
                {status.arrived
                  ? `${walker.name.split(' ')[0]} is at your door!`
                  : `${walker.name.split(' ')[0]} is on the way!`}
              </Text>
              <Text style={styles.meta}>Get Barnaby&apos;s red leash ready for pickup</Text>
            </View>
            <View style={styles.pawBadge}>
              <Icon name="pets" size={22} color={colors.ink} />
            </View>
          </View>

          <View style={styles.walkerCard}>
            <View>
              <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={54} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.flex}>
              <View style={styles.inlineRow}>
                <Text style={styles.walkerName}>{walker.name}</Text>
                <Badge label="Verified" tone="success" dot />
              </View>
              <View style={styles.inlineRow}>
                <Icon name="star" size={15} color={colors.amber} />
                <Text style={styles.rating}>{walker.rating.toFixed(1)}</Text>
                <Text style={styles.meta}>({walker.totalWalks} walks)</Text>
              </View>
            </View>
            <RoundIconButton icon="call" label={`Call ${walker.name}`} onPress={call} />
            <RoundIconButton
              icon="chat"
              label={`Chat with ${walker.name}`}
              onPress={() => setChatOpen(true)}
              badge
            />
          </View>

          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Icon name="lock" size={20} color={colors.coral} />
              <Text style={[styles.otpTitle, styles.flex]}>Share OTP with walker at pickup</Text>
              <View style={styles.securityTag}>
                <Text style={styles.securityText}>SECURITY</Text>
              </View>
            </View>
            <Text style={styles.meta}>Required to start the {booking.minutes}-min walk timer</Text>
            <View style={styles.digits} aria-label={`One-time code ${booking.otp.split('').join(' ')}`}>
              {booking.otp.split('').map((digit, index) => (
                <View key={`${digit}-${index}`} style={styles.digitBox}>
                  <Text style={styles.digit}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <PrimaryButton
            label={starting ? 'Verifying OTP…' : 'Verify OTP & Start Walk'}
            trailingIcon={starting ? null : 'arrow-forward'}
            disabled={starting}
            onPress={verifyAndStart}
          />
          <Pressable onPress={() => setConfirmCancel(true)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.cancelLink}>Cancel Walk</Text>
          </Pressable>
        </View>
      </View>

      <Toast message={message} bottomOffset={150} />

      {chatOpen ? (
        <WalkerChatSheet
          walker={walker}
          latest={`Hi! I'm ${walker.name.split(' ')[0]} — on my way to pick up Barnaby 🐾 See you in ${Math.max(1, status.remainingMin)} min${status.remainingMin === 1 ? '' : 's'}.`}
          quickReplies={['Leash is by the door 🦮', 'Ring the bell twice', 'Thanks! See you soon']}
          onClose={() => setChatOpen(false)}
        />
      ) : null}

      {confirmCancel ? (
        <ActionSheet
          title="Cancel this walk?"
          subtitle={`${walker.name.split(' ')[0]} is already on the way. Cancelling now is free.`}
          cancelLabel="Keep my walk"
          options={[
            {
              icon: 'event-busy',
              label: 'Yes, cancel walk',
              detail: 'Barnaby will stay home',
              tone: 'coral',
              onPress: () => {
                setConfirmCancel(false);
                cancelWalk(booking.id);
                go('exitTracking');
              },
            },
          ]}
          onClose={() => setConfirmCancel(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** Direction of travel for each route segment, held constant along the segment. */
function headingFor(progress: Animated.Value) {
  const { points, fractions } = PICKUP_ROUTE;
  const inputRange: number[] = [];
  const outputRange: string[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const angle =
      (Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x) * 180) / Math.PI + 90;
    inputRange.push(fractions[i - 1] + i * 1e-6, fractions[i] - 1e-4 + i * 1e-6);
    outputRange.push(`${angle}deg`, `${angle}deg`);
  }
  return progress.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
}

/** Shown when tracking is opened with no walker on the way. */
export function NoActiveWalk({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={[styles.safe, styles.empty]}>
      <Text style={styles.sheetTitle}>No walk in progress</Text>
      <Text style={[styles.meta, styles.emptyText]}>
        Book a walk from the dashboard and you can follow it live here.
      </Text>
      <PrimaryButton label="Back to dashboard" onPress={onBack} style={styles.emptyButton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  mapArea: {
    overflow: 'hidden',
    backgroundColor: '#F1F0EB',
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  homePin: {
    position: 'absolute',
    width: HOME_PIN,
    height: HOME_PIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeShadow: {
    borderRadius: HOME_PIN / 2,
    ...shadows.float,
  },
  pickupTag: {
    position: 'absolute',
    bottom: -14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.coralInk,
  },
  pickupText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  walkerPin: {
    position: 'absolute',
    width: WALKER_PIN,
    height: WALKER_PIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerGlow: {
    position: 'absolute',
    width: WALKER_PIN + 34,
    height: WALKER_PIN + 34,
    borderRadius: (WALKER_PIN + 34) / 2,
    backgroundColor: 'rgba(41, 98, 255, 0.14)',
  },
  cone: {
    position: 'absolute',
    width: WALKER_PIN + 40,
    height: WALKER_PIN + 40,
    alignItems: 'center',
  },
  walkerAvatar: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  walkingBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: colors.card,
  },
  walkerLabel: {
    position: 'absolute',
    top: -34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 116,
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  walkerLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  walkerLabelText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  etaRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  etaText: {
    ...typography.label,
    flexShrink: 1,
  },
  etaStrong: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    boxShadow: '0px -12px 32px rgba(24, 26, 32, 0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: 10,
    borderRadius: 3,
    backgroundColor: colors.inputBorder,
  },
  sheetContent: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 22,
  },
  meta: {
    ...typography.bodySm,
    fontSize: 13,
  },
  pawBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stage,
  },
  walkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: '#F4F6FB',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: colors.card,
    backgroundColor: colors.success,
  },
  walkerName: {
    ...typography.subhead,
    fontSize: 16,
  },
  rating: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  otpCard: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.coral,
    backgroundColor: colors.stage,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpTitle: {
    ...typography.subhead,
  },
  securityTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  securityText: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.coralInk,
  },
  digits: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
  },
  digitBox: {
    width: 54,
    height: 58,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  digit: {
    fontFamily: MONO,
    fontWeight: '700',
    fontSize: 24,
    color: colors.primary,
  },
  footer: {
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 18,
    alignItems: 'stretch',
    backgroundColor: colors.card,
  },
  cancelLink: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.slate,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
});
