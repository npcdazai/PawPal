import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { useResponsive } from '../theme/responsive';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
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
import { SOCIETIES } from '../booking/societies';
import { INSURANCE_COVER, clockLabel, formatMoney } from '../booking/walkPlans';
import { prefetchWalkLoop, usePickupRoute } from '../booking/walkRoutes';
import { MapLine, MapMarker, PawMap } from '../maps/PawMap';
import { BARNABY_PIN_OFFSET, BarnabyPin, WALKER_PIN_OFFSET, WalkerPin, useFrameClock } from '../maps/MapPins';
import { WALKERS, type Walker } from '../data/careTeam';

const START_DELAY_MS = 750;
/** The backup walker is already inside the township. */
const BACKUP_ETA_MIN = 3;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
/** Room for the batch pill above, the lobby pill below and the sheet's rounded top. */
const MAP_PADDING = { top: 120, right: 70, bottom: 110, left: 70 };
/** Narrow phones wrap the batch pill onto a second line: keep Barnaby's label clear of it. */
const MAP_PADDING_COMPACT = { ...MAP_PADDING, top: MAP_PADDING.top + 24 };
const ROUTE_DASH = [2, 2] as const;
const MINT = '#E8F8F0';

/** Screen 7 — WALKER_EN_ROUTE_OTP: the assigned society walker, auto-backup and the insurance OTP. */
export function WalkerEnRouteScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, compact } = useResponsive();
  const { go } = useAppNavigation();
  const { barkWith, glance } = useMascotActions();
  const { startWalk, cancelWalk, reassignToBackup, societyProfile } = useBookings();
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

  // The walker's path across the complex: previous slot's tower → Barnaby's lift lobby.
  const pickup = booking?.pickup ?? SOCIETIES.hiranandani.center;
  const from = booking?.walkerFrom ?? pickup;
  const route = usePickupRoute(from, pickup);

  // Route the walk loop now, so the live map has the township's real paths from the first step.
  const [pickupLng, pickupLat] = pickup;
  useEffect(() => {
    prefetchWalkLoop([pickupLng, pickupLat]);
  }, [pickupLng, pickupLat]);

  if (!booking) {
    return <NoActiveWalk onBack={() => go('exitTracking')} />;
  }

  const society = SOCIETIES[booking.society];
  const walker = WALKERS[booking.walkerId];
  const regular = WALKERS[booking.regularWalkerId];
  const backup = booking.backupWalkerId ? WALKERS[booking.backupWalkerId] : null;
  const firstName = walker.name.split(' ')[0];
  const status = enRouteStatus(booking, now, route.lengthKm);
  const mapHeight = Math.round(windowHeight * 0.44);
  // Narrow phones keep the map pills inside the margins and wrap their text instead.
  const pillLines = compact ? 2 : 1;
  const pillStyle = compact ? styles.pillCompact : undefined;
  const express = booking.tier === 'express';
  const handsOn = societyProfile?.temperament === 'pulls' && walker.heavyDuty;

  const arrivalText = status.arrived
    ? `${firstName} is at the ${booking.tower} lift lobby`
    : `Arriving in ${status.remainingMin} min${status.remainingMin === 1 ? '' : 's'}`;
  const batchLine = booking.reassigned
    ? `${firstName} was pre-briefed on Barnaby and is crossing the complex now (${arrivalText.toLowerCase()}).`
    : booking.walkerFromTower
      ? `Currently finishing the ${clockLabel(booking.slotStart - 30)} walk in Tower ${booking.walkerFromTower} (${
          status.arrived ? `waiting at the ${booking.tower} lift lobby` : `arriving at the ${booking.tower} lift lobby in ${status.remainingMin} mins`
        })`
      : express
        ? `Express walker squeezed in between ${society.shortName}’s stacked slots — already inside the complex.`
        : `Starting the batch inside ${society.shortName} — heading to the ${booking.tower} lift lobby.`;

  const maskedCall = () => show(`📞 Connecting to ${firstName} via PawPal’s masked line — numbers stay private`);

  const simulateSickLeave = () => {
    if (!backup) return;
    reassignToBackup(booking.id, BACKUP_ETA_MIN);
    glance();
    barkWith(`Woof! ${backup.name.split(' ')[0]} is on it 🔄`);
    show(`🤒 ${regular.name.split(' ')[0]} called in sick — ${backup.shortName} keeps your ${clockLabel(booking.slotStart)} slot`);
  };

  const verifyAndStart = () => {
    if (starting) return;
    setStarting(true);
    barkWith("Woof! Insurance on — let's go! 🐾");
    startTimer.current = setTimeout(() => {
      startWalk(booking.id);
      go('startLiveWalk');
    }, START_DELAY_MS);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TrackingTopBar
        title="Walker Match & OTP"
        onBack={() => go('exitTracking')}
        onInfo={() => show(`Society walkers only work inside ${society.shortName} — no traffic, no delays`)}
      />

      <View style={[styles.mapArea, { height: mapHeight }]}>
        <PawMap
          initialCenter={pickup}
          initialBounds={{ bounds: boundsOf([from, pickup]), padding: compact ? MAP_PADDING_COMPACT : MAP_PADDING }}
          style={StyleSheet.absoluteFill}
        >
          {/* Barnaby waits at his lobby with the leash (IDLE_WAG; tap him to woof). */}
          <MapMarker lngLat={pickup} anchor="bottom" offset={BARNABY_PIN_OFFSET}>
            <BarnabyPin
              label={
                <>
                  <Icon name="home" size={13} color={colors.onPrimary} />
                  <Text style={styles.pinText}>Barnaby (Pickup)</Text>
                </>
              }
            />
          </MapMarker>
          <WalkerOnRoute route={route} booking={booking} walker={walker} running={!status.arrived} />
        </PawMap>

        <View style={styles.topPillRow} pointerEvents="none">
          <MapPill style={pillStyle}>
            <PulsingDot />
            <Text style={styles.pillText} numberOfLines={pillLines}>
              {booking.reassigned
                ? `Backup ${walker.shortName} assigned`
                : booking.walkerFromTower
                  ? `Finishing ${clockLabel(booking.slotStart - 30)} slot at Tower ${booking.walkerFromTower}`
                  : express
                    ? 'Express walker dispatched'
                    : `Starting ${society.shortName} batch`}{' '}
              <Text style={styles.pillStrong}>• 0 m travel delay</Text>
            </Text>
          </MapPill>
        </View>
        <View style={styles.bottomPillRow} pointerEvents="none">
          <MapPill style={pillStyle}>
            <Icon name="place" size={17} color={colors.coral} />
            <Text style={styles.pillText} numberOfLines={pillLines}>
              {booking.tower} Main Lobby • <Text style={styles.pillStrong}>{arrivalText}</Text>
            </Text>
          </MapPill>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View>
            <View style={styles.inlineRow}>
              <Icon name="verified" size={17} color={colors.successInk} />
              <Text style={styles.assigned}>
                {booking.reassigned ? 'BACKUP SOCIETY WALKER ASSIGNED' : 'SOCIETY RESIDENT WALKER ASSIGNED'}
              </Text>
            </View>
            <Text style={styles.sheetTitle}>Your Society Walker is Ready!</Text>
            <Text style={styles.meta}>
              Operating exclusively within {society.label} • {booking.slotLabel}
            </Text>
          </View>

          <View style={styles.walkerCard}>
            <View>
              <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={56} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.walkerName}>{walker.name}</Text>
              <View style={styles.inlineRow}>
                <Icon name="star" size={15} color={colors.amber} />
                <Text style={styles.rating}>{walker.rating.toFixed(2)}</Text>
                <Text style={styles.meta}>
                  ({walker.societyWalks ?? walker.totalWalks} Walks in {society.shortName.split(' ')[0]})
                </Text>
              </View>
              <View style={styles.passBadge}>
                <Icon name="badge" size={14} color={colors.successInk} />
                <Text style={styles.passText}>
                  ✓ Verified Society {society.gateApp} Pass #{walker.gatePass ?? '—'}
                </Text>
              </View>
              {handsOn ? <Text style={styles.heavy}>🏋️ Heavy-duty handler for pullers</Text> : null}
            </View>
            <View style={styles.actions}>
              <RoundIconButton icon="call" label={`Call ${walker.name} (masked)`} onPress={maskedCall} />
              <RoundIconButton icon="chat" label={`Chat with ${walker.name}`} onPress={() => setChatOpen(true)} badge />
            </View>
          </View>

          <View style={styles.batchLine}>
            <Icon name="directions-walk" size={18} color={colors.primary} />
            <Text style={styles.batchText}>{batchLine}</Text>
          </View>

          {/* The zero-ghosting moat */}
          <View style={styles.backup}>
            <View style={styles.backupIcon}>
              <Icon name={backup ? 'autorenew' : 'check-circle'} size={22} color={colors.successInk} />
            </View>
            <View style={styles.flex}>
              {backup ? (
                <Text style={styles.backupText}>
                  <Text style={styles.backupStrong}>🔄 Guaranteed Backup Active: </Text>
                  {backup.shortName} (⭐ {backup.rating.toFixed(2)}) is pre-briefed on Barnaby’s harness & route notes
                  if {regular.name.split(' ')[0]} calls in sick.
                </Text>
              ) : (
                <Text style={styles.backupText}>
                  <Text style={styles.backupStrong}>✓ Auto-reassigned: </Text>
                  {walker.shortName} took over {regular.name.split(' ')[0]}’s {clockLabel(booking.slotStart)} slot —
                  same slot, same route notes, zero ghosting.
                </Text>
              )}
              {backup ? (
                <Pressable
                  onPress={simulateSickLeave}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.simulate, pressed && styles.pressed]}
                >
                  <Icon name="sick" size={16} color={colors.successInk} />
                  <Text style={styles.simulateText}>Simulate Regular Walker Sick Leave</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* OTP leash handover + insurance activation */}
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Text style={[styles.otpTitle, styles.flex]}>
                🔒 Share OTP at doorstep to start the {booking.minutes}-min GPS timer and unlock{' '}
                {formatMoney(INSURANCE_COVER)} Active Walk Vet & Accident Insurance.
              </Text>
            </View>
            <View style={styles.digits} aria-label={`One-time code ${booking.otp.split('').join(' ')}`}>
              {booking.otp.split('').map((digit, index) => (
                <View key={`${digit}-${index}`} style={styles.digitBox}>
                  <Text style={styles.digit}>{digit}</Text>
                </View>
              ))}
            </View>
            <View style={styles.inlineRow}>
              <Icon name="info-outline" size={15} color={colors.slate} />
              <Text style={[styles.meta, styles.flex]}>
                {firstName} verifies this code on the PawPal Partner app before starting the walk.
              </Text>
            </View>
            <View style={styles.warning}>
              <Text style={styles.warningText}>⚠️ Off-app walks are uninsured and unmonitored.</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <PrimaryButton
            label={starting ? 'Verifying OTP…' : 'Verify OTP & Start GPS Walk'}
            trailingIcon={starting ? null : 'arrow-forward'}
            disabled={starting}
            onPress={verifyAndStart}
          />
          <View style={styles.footerLinks}>
            <Pressable onPress={maskedCall} accessibilityRole="button" hitSlop={8} style={[styles.inlineRow, styles.shrink]}>
              <Icon name="support-agent" size={16} color={colors.slate} />
              <Text style={[styles.footerText, styles.shrink]}>
                Call {firstName} (Walker) • Gate Pass #{walker.gatePass ?? '—'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setConfirmCancel(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Toast message={message} bottomOffset={150} />

      {chatOpen ? (
        <WalkerChatSheet
          walker={walker}
          latest={`Hi! I'm ${firstName}, your ${society.shortName} walker 🐾 ${
            status.arrived ? `I'm at the ${booking.tower} lift lobby.` : `See you at the ${booking.tower} lift lobby in ${Math.max(1, status.remainingMin)} min.`
          }`}
          quickReplies={['Harness is by the door 🦺', 'Coming down now', 'Thanks! 🐾']}
          onClose={() => setChatOpen(false)}
        />
      ) : null}

      {confirmCancel ? (
        <ActionSheet
          title="Cancel this walk?"
          subtitle={`${firstName} is already inside ${society.shortName}. Cancelling now is free.`}
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
 * The walker gliding along the township path every animation frame, with the
 * dashed path ahead of them trimmed as they go. Kept separate so only this
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
        <WalkerPin initials={walker.initials} name={walker.shortName} bearing={bearingAlong(route, progress)} />
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
        Book a society walk from the dashboard and you can follow it live here.
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
  shrink: {
    flexShrink: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapArea: {
    overflow: 'hidden',
    backgroundColor: '#FFFDF9',
  },
  pinText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  topPillRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bottomPillRow: {
    position: 'absolute',
    bottom: 42,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pillCompact: {
    maxWidth: '100%',
  },
  pillText: {
    ...typography.label,
    flexShrink: 1,
  },
  pillStrong: {
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
  assigned: {
    fontFamily: fonts.extrabold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.successInk,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 22,
    marginTop: 4,
  },
  meta: {
    ...typography.bodySm,
    fontSize: 12.5,
  },
  walkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.successTint,
  },
  passText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.successInk,
  },
  heavy: {
    marginTop: 4,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.amberInk,
  },
  actions: {
    gap: 8,
  },
  batchLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  batchText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  backup: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: MINT,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
  },
  backupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  backupText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  backupStrong: {
    fontFamily: fonts.bold,
    color: colors.successInk,
  },
  simulate: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.successInk,
    backgroundColor: colors.card,
  },
  simulateText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.successInk,
  },
  otpCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.stage,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  otpTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.coralInk,
  },
  digits: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  digitBox: {
    width: 56,
    height: 60,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  digit: {
    fontFamily: MONO,
    fontWeight: '700',
    fontSize: 26,
    color: colors.primary,
  },
  warning: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.coralTint,
  },
  warningText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.coralInk,
  },
  footer: {
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 18,
    alignItems: 'stretch',
    backgroundColor: colors.card,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.slate,
  },
  cancelLink: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.coralInk,
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
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
