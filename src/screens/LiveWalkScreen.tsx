import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { ActionSheet } from '../components/ActionSheet';
import { Toast, useToast } from '../components/Toast';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, useTrackedWalk, type WalkBooking } from '../booking/BookingsProvider';
import { WalkerChatSheet } from '../booking/WalkerChatSheet';
import { WalkCompleteModal } from '../booking/WalkCompleteModal';
import { MapPill, PulsingDot, RoundIconButton, TrackingTopBar } from '../booking/trackingUi';
import {
  EVENT_META,
  SIMULATED_ACTIONS,
  eventDetail,
  formatCountdown,
  liveWalkStatus,
  walkClock,
  type WalkEventKind,
} from '../booking/liveWalk';
import { boundsOf, headingAlong, pointAlong, splitLine, type GeoLine } from '../booking/geo';
import { SOCIETIES } from '../booking/societies';
import { BATCHES, INSURANCE_COVER, SUBSCRIPTION_PER_WALK, formatMoney, slotRange } from '../booking/walkPlans';
import { useWalkLoop, walkLoopWaypoints } from '../booking/walkRoutes';
import { MapLine, MapMarker, PawMap } from '../maps/PawMap';
import {
  BARNABY_PIN_OFFSET,
  BarnabyPin,
  EVENT_PIN_OFFSET,
  EventPin,
  START_DOT_OFFSET,
  StartDot,
  useFrameClock,
} from '../maps/MapPins';
import { arrivalBuzz } from '../booking/WalkArrivalBanner';
import { NoActiveWalk } from './WalkerEnRouteScreen';
import { WALKERS, type Walker } from '../data/careTeam';

/** The mid-walk check-in, captured through the walker's in-app camera. */
const LIVE_PHOTO = require('../../assets/corgi_dashboard.jpg');

const TICK_MS = 250;
const COMPLETE_DELAY_MS = 650;
/** Room for the insurance pill above and Barnaby's pin wherever he is on the loop. */
const MAP_PADDING = { top: 120, right: 60, bottom: 90, left: 60 };
const TRAIL_AHEAD = '#8FAEFF';
const STAGES = ['gate', 'Garden Loop', 'Return & Handover'] as const;

const EVENT_COLOR: Record<WalkEventKind, string> = {
  pee: colors.primary,
  poop: colors.coral,
  photo: colors.primary,
};

const ACTION_LABEL: Record<WalkEventKind, string> = {
  pee: '💧 Pee',
  poop: '💩 Poop',
  photo: '📸 Photo',
};

const ACTION_BARK: Record<WalkEventKind, string> = {
  pee: 'Woof! 💧 Pee logged',
  poop: 'Woof! 💩 Scooped!',
  photo: 'Woof! 📸 Say cheese!',
};

const ACTION_TOAST: Record<WalkEventKind, string> = {
  pee: '💧 a pee stop',
  poop: '💩 a poop stop (scooped & binned)',
  photo: '📸 a live camera photo',
};

/** A freshly dropped pin shows its detail briefly, then folds back to its time chip. */
const PIN_DETAIL_MS = 3500;

/** Screen 8 — LIVE_WALK_TRACKER: the society loop with timestamped proof of care. */
export function LiveWalkScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { go } = useAppNavigation();
  const { bark, barkWith, navigate, setWalking, face } = useMascotActions();
  const { hapticsEnabled } = useMascotStatus();
  const { completeWalk, logEvent } = useBookings();
  const booking = useTrackedWalk();
  const { message, show } = useToast();

  const [now, setNow] = useState(() => Date.now());
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeading = useRef<1 | -1>(1);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    const pending = completeTimer;
    return () => {
      clearInterval(tick);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  // An opened pin detail folds away on its own, so it never hides Barnaby for long.
  useEffect(() => {
    if (!openPin) return undefined;
    const timer = setTimeout(() => setOpenPin(null), PIN_DETAIL_MS);
    return () => clearTimeout(timer);
  }, [openPin]);

  // Barnaby walks (WALKING bob) for as long as this screen tracks the walk.
  useEffect(() => {
    setWalking(true);
    return () => setWalking(false);
  }, [setWalking]);

  // The township loop from Barnaby's lobby; telemetry follows how far along it they are.
  const pickup = booking?.pickup ?? SOCIETIES.hiranandani.center;
  const loop = useWalkLoop(pickup);
  const status = booking ? liveWalkStatus(booking, now, loop.lengthKm) : null;

  // Face the direction of travel; stop walking once home.
  const progressNow = status?.progress ?? 0;
  const done = status?.done ?? false;
  useEffect(() => {
    if (done) {
      setWalking(false);
      return;
    }
    const heading = headingAlong(loop, progressNow);
    if (heading !== lastHeading.current) {
      lastHeading.current = heading;
      face(heading);
    }
  }, [loop, progressNow, done, face, setWalking]);

  // Back at the lobby: buzz, Barnaby woofs, and the arrival sheet asks for the drop-off.
  const [arrivalSeen, setArrivalSeen] = useState(false);
  const announced = useRef(false);
  useEffect(() => {
    if (!done || announced.current) return;
    announced.current = true;
    arrivalBuzz(hapticsEnabled);
    barkWith("Woof! I'm home! 🏠");
  }, [done, hapticsEnabled, barkWith]);

  if (!booking || !status) {
    return <NoActiveWalk onBack={() => go('exitTracking')} />;
  }

  const society = SOCIETIES[booking.society];
  const walker = WALKERS[booking.walkerId];
  const firstName = walker.name.split(' ')[0];
  const mapHeight = Math.round(windowHeight * 0.46);
  const percent = Math.round(status.progress * 100);
  const { done: trail, rest: ahead } = splitLine(loop, status.progress);
  const photo = status.photos[0] ?? null;
  const stageIndex = status.progress >= 0.85 ? 2 : status.progress >= 0.12 ? 1 : 0;
  const nextAction = SIMULATED_ACTIONS[actionIndex % SIMULATED_ACTIONS.length];
  const slotName = booking.batch ? BATCHES[booking.batch].label.replace(' Batch', '') : 'Express';

  const simulateAction = () => {
    if (status.done) {
      show('The walk is over — no more stops to log');
      return;
    }
    const kind = nextAction;
    logEvent(booking.id, kind, status.progress);
    setActionIndex((index) => index + 1);
    setOpenPin(`logged-${booking.loggedEvents.length}`);
    barkWith(ACTION_BARK[kind]);
    show(`${firstName} logged ${ACTION_TOAST[kind]} at ${walkClock(booking, status.progress)}`);
  };

  const complete = () => {
    if (completing) return;
    setCompleting(true);
    setWalking(false);
    bark();
    completeTimer.current = setTimeout(() => navigate(() => setCompleted(true)), COMPLETE_DELAY_MS);
  };

  const masked = (who: string) => show(`📞 Connecting to ${who} via PawPal’s masked line…`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TrackingTopBar
        title="Live Society Walk"
        onBack={() => go('exitTracking')}
        onInfo={() => show('Every stop is GPS-stamped by the walker’s app — gallery uploads are disabled')}
      />

      <View style={[styles.mapArea, { height: mapHeight }]}>
        <PawMap
          initialCenter={pickup}
          initialBounds={{ bounds: boundsOf(walkLoopWaypoints(pickup, 0.42)), padding: MAP_PADDING }}
          style={StyleSheet.absoluteFill}
        >
          <MapLine id="walk-ahead" coords={ahead} color={TRAIL_AHEAD} width={4} dash={[1.5, 1.5]} opacity={0.9} />
          <MapLine id="walk-trail" coords={trail} color={colors.primary} width={5} />

          <MapMarker lngLat={pickup} anchor="bottom" offset={START_DOT_OFFSET}>
            <StartDot />
          </MapMarker>

          {status.events.map((event) => {
            const open = openPin === event.id;
            const time = walkClock(booking, event.at);
            return (
              <MapMarker key={event.id} lngLat={pointAlong(loop, event.at)} anchor="bottom" offset={EVENT_PIN_OFFSET}>
                <EventPin
                  emoji={EVENT_META[event.kind].emoji}
                  time={time}
                  verified={event.kind === 'poop'}
                  color={EVENT_COLOR[event.kind]}
                  detail={`${EVENT_META[event.kind].title} (${time} — ${eventDetail(booking, event.kind)})`}
                  open={open}
                  onPress={() => setOpenPin(open ? null : event.id)}
                />
              </MapMarker>
            );
          })}

          <BarnabyOnLoop loop={loop} booking={booking} walker={walker} running={!status.done} active={!completed} />
        </PawMap>

        <View style={styles.liveRow} pointerEvents="none">
          <MapPill style={styles.livePill}>
            <PulsingDot />
            <Text style={styles.liveText} numberOfLines={2}>
              LIVE SOCIETY WALK{' '}
              <Text style={styles.liveCover}>• 🛡️ {formatMoney(INSURANCE_COVER)} Vet Insurance Cover ACTIVE</Text>
            </Text>
          </MapPill>
        </View>

        <View style={styles.simulateRow} pointerEvents="box-none">
          <Pressable
            onPress={simulateAction}
            accessibilityRole="button"
            aria-label={`Simulate walker action: drop a ${nextAction} pin`}
            style={({ pressed }) => [styles.simulate, status.done && styles.simulateDone, pressed && styles.pressed]}
          >
            <Icon name="add-location-alt" size={17} color={colors.onPrimary} />
            <Text style={styles.simulateText}>
              Simulate Walker Action <Text style={styles.simulateNext}>+ {ACTION_LABEL[nextAction]} Pin</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <View style={styles.countLine}>
                <Text style={styles.countdown}>{formatCountdown(status.remainingSec)}</Text>
                <Text style={styles.remaining}>{status.done ? 'Back home' : 'Remaining'}</Text>
              </View>
              <Text style={styles.meta}>
                {booking.minutes}-Min {slotName} Slot ({slotRange(booking.slotStart, booking.minutes)})
              </Text>
            </View>
            <View style={styles.coverPill}>
              <Icon name="verified-user" size={16} color={colors.successInk} />
              <Text style={styles.coverText}>Accident Cover{'\n'}Active</Text>
            </View>
          </View>

          <View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <View style={styles.stageLabels}>
              {STAGES.map((stage, index) => (
                <Text
                  key={stage}
                  style={[
                    styles.stageLabel,
                    index === 1 && styles.stageCenter,
                    index === 2 && styles.stageRight,
                    index === stageIndex && styles.stageActive,
                    index > stageIndex && styles.stageFuture,
                  ]}
                >
                  {stage === 'gate' ? `${booking.tower} Gate` : stage}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.bento}>
            <View style={styles.tile}>
              <View style={styles.tileHead}>
                <Icon name="route" size={16} color={colors.primary} />
                <Text style={styles.tileLabel}>Distance & Pace</Text>
              </View>
              <Text style={styles.tileValue}>
                {status.km.toFixed(2)} <Text style={styles.tileUnit}>km</Text>
              </Text>
              <Text style={styles.tileMeta}>{status.pace ? `${Math.round(status.pace)} min/km 🐾` : 'Warming up 🐾'}</Text>
            </View>
            <View style={styles.tile}>
              <View style={styles.tileHead}>
                <Icon name="water-drop" size={16} color={colors.coral} />
                <Text style={styles.tileLabel}>Potty Count</Text>
              </View>
              <Text style={[styles.tileValue, styles.tileValueSmall]} numberOfLines={1}>
                {status.pee}💧 · {status.poop}💩
              </Text>
              <Text style={[styles.tileMeta, status.poop > 0 && styles.tileGood]}>
                {status.poop > 0 ? '✓ Bagged & binned' : 'Waiting for stops'}
              </Text>
            </View>
            <View style={styles.tile}>
              <View style={styles.tileHead}>
                <Icon name="health-and-safety" size={16} color={colors.successInk} />
                <Text style={styles.tileLabel}>Insurance</Text>
              </View>
              <Text style={styles.tileValue}>₹10K</Text>
              <Text style={[styles.tileMeta, styles.tileGood]}>{status.done ? 'Closed safely ✓' : 'Active • GPS stamped'}</Text>
            </View>
          </View>

          {photo ? (
            <Pressable
              onPress={() => setPhotoOpen(true)}
              accessibilityRole="button"
              aria-label="Open the live check-in photo"
              style={({ pressed }) => [styles.proof, pressed && styles.pressedSoft]}
            >
              <Image source={LIVE_PHOTO} style={styles.proofPhoto} resizeMode="cover" />
              <View style={styles.flex}>
                <View style={styles.spaceBetween}>
                  <Text style={styles.proofLabel}>MANDATORY IN-APP CHECK-IN</Text>
                  <Text style={styles.proofTime}>{walkClock(booking, photo.at)}</Text>
                </View>
                <Text style={styles.proofTitle}>Barnaby is having a great stroll!</Text>
                <Text style={styles.proofQuote} numberOfLines={2}>
                  “Doing his morning stretch on the lawn — harness snug ✓”
                </Text>
                <Text style={styles.proofMeta}>
                  Captured via In-App Live Camera (Gallery Upload Disabled) • {walkClock(booking, photo.at)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.proof, styles.proofPending]}>
              <View style={styles.proofIcon}>
                <Icon name="photo-camera" size={24} color={colors.coral} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.proofLabel}>MANDATORY HALFWAY LIVE PHOTO</Text>
                <Text style={styles.proofTitle}>Due at {walkClock(booking, 0.5)}</Text>
                <Text style={styles.proofMeta}>
                  {firstName} must snap Barnaby in his harness with the in-app camera — gallery uploads are disabled.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.update}>
            <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={42} />
            <View style={styles.flex}>
              <Text style={styles.updateName}>
                {walker.name} • {society.shortName}
              </Text>
              <Text style={styles.updateText} numberOfLines={2}>
                “{status.update.text}”
              </Text>
            </View>
            <RoundIconButton icon="chat" label={`Chat with ${walker.name}`} onPress={() => setChatOpen(true)} tint={colors.card} />
            <RoundIconButton icon="call" label={`Call ${walker.name} (masked)`} onPress={() => masked(firstName)} tint={colors.card} />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            onPress={() => setSosOpen(true)}
            accessibilityRole="button"
            aria-label="SOS Vet"
            style={({ pressed }) => [styles.sos, pressed && styles.pressed]}
          >
            <Text style={styles.sosStar}>✱</Text>
            <Text style={styles.sosText}>SOS Vet</Text>
          </Pressable>
          <Pressable
            onPress={complete}
            disabled={completing}
            accessibilityRole="button"
            aria-label="Complete drop-off"
            style={({ pressed }) => [styles.complete, pressed && styles.completePressed]}
          >
            <Text style={styles.completeText} numberOfLines={1}>
              Complete Drop-Off
            </Text>
            <Icon name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      <Toast message={message} bottomOffset={100} />

      {photoOpen && photo ? (
        <Pressable style={styles.photoBackdrop} onPress={() => setPhotoOpen(false)} aria-label="Close photo">
          <View style={styles.photoCard}>
            <Image source={LIVE_PHOTO} style={styles.photo} resizeMode="cover" />
            <Text style={styles.photoCaption}>📸 Barnaby in his chest harness • {walkClock(booking, photo.at)}</Text>
            <Text style={styles.meta}>In-App Live Camera • GPS {pointAlong(loop, photo.at).map((n) => n.toFixed(4)).reverse().join(', ')}</Text>
            <Text style={styles.meta}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      ) : null}

      {chatOpen ? (
        <WalkerChatSheet
          walker={walker}
          latest={status.update.text}
          quickReplies={['Thank you! 🐾', 'One more lap please', 'Please send a photo 📸']}
          onClose={() => setChatOpen(false)}
        />
      ) : null}

      {status.done && !arrivalSeen && !completing && !completed ? (
        <ActionSheet
          title={`🏠 Barnaby is back at ${booking.tower}!`}
          subtitle={`${firstName} finished the loop — ${status.km.toFixed(2)} km, ${status.pee} pee • ${status.poop} poop, photo-verified.`}
          cancelLabel="Not now"
          options={[
            {
              icon: 'check-circle',
              label: 'Confirm Drop-off',
              detail: `Rate ${firstName} and add a tip`,
              tone: 'primary',
              onPress: () => {
                setArrivalSeen(true);
                complete();
              },
            },
          ]}
          onClose={() => setArrivalSeen(true)}
        />
      ) : null}

      {sosOpen ? (
        <ActionSheet
          title="SOS Vet"
          subtitle={`Your ${formatMoney(INSURANCE_COVER)} vet & accident cover is active for this walk.`}
          options={[
            {
              icon: 'local-hospital',
              label: 'PawPal Vet Line (24/7)',
              detail: 'A vet on call in under a minute — covered',
              tone: 'coral',
              onPress: () => {
                setSosOpen(false);
                masked('the PawPal vet line');
              },
            },
            {
              icon: 'call',
              label: `Call ${firstName} now`,
              detail: 'Masked number — talk to your walker',
              onPress: () => {
                setSosOpen(false);
                masked(firstName);
              },
            },
            {
              icon: 'security',
              label: 'Report an issue with this walk',
              detail: 'PawPal Safety reviews it with the GPS trail',
              tone: 'coral',
              onPress: () => {
                setSosOpen(false);
                show('🛡️ Report sent — PawPal Safety will call you shortly');
              },
            },
          ]}
          onClose={() => setSosOpen(false)}
        />
      ) : null}

      {completed ? (
        <WalkCompleteModal
          walker={walker}
          minutesWalked={status.elapsedSec / 60}
          km={status.km}
          kcal={status.kcal}
          fare={booking.tier === 'subscription' ? SUBSCRIPTION_PER_WALK : booking.total}
          onDone={(rating, tip) => {
            completeWalk(booking.id, { distanceKm: Math.round(status.km * 100) / 100, rating, tip });
            go('exitTracking');
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Barnaby (WALKING) with his walker's badge, advanced along the loop every
 * animation frame. Separate so only the marker re-renders per frame.
 */
function BarnabyOnLoop({
  loop,
  booking,
  walker,
  running,
  active,
}: {
  loop: GeoLine;
  booking: WalkBooking;
  walker: Walker;
  running: boolean;
  active: boolean;
}) {
  const now = useFrameClock(running);
  const { progress } = liveWalkStatus(booking, now, loop.lengthKm);
  return (
    <MapMarker lngLat={pointAlong(loop, progress)} anchor="bottom" offset={BARNABY_PIN_OFFSET}>
      <BarnabyPin
        active={active}
        ringColor={colors.primary}
        label={
          <Text style={styles.pinLabelText} numberOfLines={1}>
            Barnaby <Text style={styles.pinStar}>★</Text> with {walker.shortName}
          </Text>
        }
        badge={
          <Avatar initials={walker.initials} tint={colors.card} ink={colors.primary} size={30} style={styles.walkerBadge} />
        }
      />
    </MapMarker>
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
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapArea: {
    overflow: 'hidden',
    backgroundColor: '#FFFDF9',
  },
  walkerBadge: {
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  pinLabelText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  pinStar: {
    color: colors.amber,
  },
  liveRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  livePill: {
    maxWidth: '100%',
  },
  liveText: {
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  liveCover: {
    fontFamily: fonts.bold,
    color: colors.successInk,
    letterSpacing: 0,
  },
  simulateRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    alignItems: 'center',
  },
  simulate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
    ...shadows.float,
  },
  simulateDone: {
    opacity: 0.5,
  },
  simulateText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.onPrimary,
  },
  simulateNext: {
    color: colors.amber,
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  countLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  countdown: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  remaining: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
  },
  coverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.successTint,
  },
  coverText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.successInk,
  },
  track: {
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  stageLabels: {
    flexDirection: 'row',
    marginTop: 8,
  },
  stageLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.slate,
  },
  stageCenter: {
    textAlign: 'center',
  },
  stageRight: {
    textAlign: 'right',
  },
  stageActive: {
    color: colors.primary,
  },
  stageFuture: {
    color: colors.placeholder,
  },
  bento: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: '#F4F6FB',
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileLabel: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.ink,
  },
  tileValue: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.ink,
  },
  tileValueSmall: {
    fontSize: 16,
  },
  tileUnit: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
  },
  tileMeta: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.slate,
  },
  tileGood: {
    color: colors.successInk,
  },
  proof: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.stage,
  },
  proofPending: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.coral,
  },
  proofPhoto: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.card,
  },
  proofIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  proofLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.coralInk,
  },
  proofTime: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.slate,
  },
  proofTitle: {
    ...typography.subhead,
    marginTop: 2,
  },
  proofQuote: {
    fontFamily: fonts.medium,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.slate,
    marginTop: 2,
  },
  proofMeta: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.successInk,
    marginTop: 4,
  },
  update: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: '#F4F6FB',
  },
  updateName: {
    ...typography.label,
  },
  updateText: {
    ...typography.bodySm,
    color: colors.ink,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
  },
  sos: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: '#FFE1DA',
  },
  sosStar: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.coralInk,
  },
  sosText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.coralInk,
  },
  complete: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  completePressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.98 }],
  },
  completeText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.onPrimary,
    flexShrink: 1,
  },
  photoBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(24, 26, 32, 0.7)',
  },
  photoCard: {
    width: '100%',
    gap: 8,
    padding: 12,
    alignItems: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
  },
  photoCaption: {
    ...typography.label,
  },
  meta: {
    ...typography.bodySm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  pressedSoft: {
    opacity: 0.9,
  },
});
