import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { ActionSheet } from '../components/ActionSheet';
import { Toast, useToast } from '../components/Toast';
import { useMascotActions } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, useTrackedWalk, type WalkBooking } from '../booking/BookingsProvider';
import { WalkerChatSheet } from '../booking/WalkerChatSheet';
import { MapPill, PulsingDot, RoundIconButton, TrackingTopBar } from '../booking/trackingUi';
import { enRouteStatus } from '../booking/liveWalk';
import { bearingAlong, boundsOf, pointAlong, splitLine, type GeoLine } from '../booking/geo';
import { PICKUP_PLACES, walkerStartFor } from '../booking/pickupPlaces';
import { usePickupRoute } from '../booking/walkRoutes';
import { MapLine, MapMarker, PawMap } from '../maps/PawMap';
import {
  BARNABY_PIN_OFFSET,
  BarnabyPin,
  WALKER_PIN_OFFSET,
  WalkerPin,
  useFrameClock,
} from '../maps/MapPins';
import { WALKERS, type Walker } from '../data/careTeam';

const START_DELAY_MS = 750;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
/** Room for the ETA pill above and the sheet's rounded top below. */
const MAP_PADDING = { top: 150, right: 56, bottom: 64, left: 56 };
/** Primary blue dashes: line-dasharray [2, 2]. */
const ROUTE_DASH = [2, 2] as const;

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

  // The walker's real street route (OSRM foot profile) from where they were matched.
  const pickup = booking?.pickup ?? PICKUP_PLACES.home.lngLat;
  const route = usePickupRoute(pickup);

  if (!booking) {
    return <NoActiveWalk onBack={() => go('exitTracking')} />;
  }

  const walker = WALKERS[booking.walkerId];
  const status = enRouteStatus(booking, now, route.lengthKm);
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

      <View style={[styles.mapArea, { height: mapHeight }]}>
        <PawMap
          initialCenter={pickup}
          initialBounds={{ bounds: boundsOf([walkerStartFor(pickup), pickup]), padding: MAP_PADDING }}
          style={StyleSheet.absoluteFill}
        >
          {/* Pickup pin: Barnaby waits here with his leash (IDLE_WAG; tap him to woof). */}
          <MapMarker lngLat={pickup} anchor="bottom" offset={BARNABY_PIN_OFFSET}>
            <BarnabyPin
              label={
                <>
                  <Icon name="home" size={13} color={colors.onPrimary} />
                  <Text style={styles.pickupText}>Pickup</Text>
                </>
              }
            />
          </MapMarker>
          <WalkerOnRoute route={route} booking={booking} walker={walker} running={!status.arrived} />
        </PawMap>

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

/**
 * The walker gliding along the GeoJSON route every animation frame, with the
 * dashed route ahead of them trimmed as they go. Kept separate so only this
 * re-renders per frame, not the whole screen.
 */
function WalkerOnRoute({
  route,
  booking,
  walker,
  running,
}: {
  route: GeoLine;
  booking: WalkBooking;
  walker: Walker;
  running: boolean;
}) {
  const now = useFrameClock(running);
  const { progress } = enRouteStatus(booking, now, route.lengthKm);
  // The line is trimmed in small steps; the marker itself moves every frame.
  const trimAt = Math.floor(progress * 400) / 400;
  const ahead = useMemo(() => splitLine(route, trimAt).rest, [route, trimAt]);

  return (
    <>
      <MapLine id="walker-route" coords={ahead} color={colors.primary} width={4} dash={ROUTE_DASH} />
      <MapMarker lngLat={pointAlong(route, progress)} anchor="bottom" offset={WALKER_PIN_OFFSET}>
        <WalkerPin
          initials={walker.initials}
          name={walker.name.split(' ')[0]}
          bearing={bearingAlong(route, progress)}
        />
      </MapMarker>
    </>
  );
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
    backgroundColor: '#FFFDF9',
  },
  pickupText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
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
