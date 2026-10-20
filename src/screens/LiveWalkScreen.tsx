import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
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
import { ActionSheet } from '../components/ActionSheet';
import { Toast, useToast } from '../components/Toast';
import { MascotAnchor, MascotFrame } from '../mascot/MascotAnchor';
import { useMascotActions } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../mascot/MascotMachine';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, useTrackedWalk } from '../booking/BookingsProvider';
import { NeighborhoodMap } from '../booking/NeighborhoodMap';
import { PulseRings } from '../booking/PulseRings';
import { WalkerChatSheet } from '../booking/WalkerChatSheet';
import { WalkCompleteModal } from '../booking/WalkCompleteModal';
import { MapPill, PulsingDot, RoundIconButton, TrackingTopBar } from '../booking/trackingUi';
import {
  eventMinute,
  formatClockTime,
  formatCountdown,
  liveWalkStatus,
  realMsFor,
} from '../booking/liveWalk';
import { PARK_LOOP, PARK_LOOP_FOCUS, pointAt, routeOffset, splitRoute, toSvgPath } from '../booking/walkRoutes';
import { MAP_SIZE } from '../booking/pickupPlaces';
import { NoActiveWalk } from './WalkerEnRouteScreen';
import { WALKERS } from '../data/careTeam';

const CORGI = require('../../assets/corgi_mascot.png');
const PARK_PHOTO = require('../../assets/corgi_dashboard.png');

const PIN = 84;
const PIN_MASCOT = 66;
const MILESTONE = 34;
const TICK_MS = 250;
const COMPLETE_DELAY_MS = 650;
const SAFETY_LINE = '+18005550199';
const EMERGENCY_VET = '+14155550199';

interface MapMarker {
  key: string;
  at: number;
  emoji: string;
  label: string;
}

/** Screen 9 — live walk telemetry with Barnaby and his walker on the park loop. */
export function LiveWalkScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { go } = useAppNavigation();
  const { bark, navigate, setWalking, face } = useMascotActions();
  const { completeWalk, logWater: recordWater } = useBookings();
  const booking = useTrackedWalk();
  const { message, show } = useToast();

  const [now, setNow] = useState(() => Date.now());
  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [progress] = useState(() => new Animated.Value(0));
  const [openMarker, setOpenMarker] = useState<string | null>(null);
  const [manualMarkers, setManualMarkers] = useState<MapMarker[]>([]);
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

  // Barnaby walks (walking frames) for as long as this screen tracks the walk.
  useEffect(() => {
    setWalking(true);
    return () => setWalking(false);
  }, [setWalking]);

  // Move the walk pin (and Barnaby with it) smoothly along the loop on the native thread.
  const startedAt = booking?.startedAt;
  const minutes = booking?.minutes;
  useEffect(() => {
    if (!startedAt || !minutes) return undefined;
    const status = liveWalkStatus({ minutes, startedAt, extraWater: 0 }, Date.now());
    progress.setValue(status.progress);
    const walk = Animated.timing(progress, {
      toValue: 1,
      duration: realMsFor(status.remainingSec),
      easing: Easing.linear,
      useNativeDriver: NATIVE_DRIVER,
    });
    walk.start();
    return () => walk.stop();
  }, [startedAt, minutes, progress]);

  const offset = useMemo(() => routeOffset(PARK_LOOP, progress), [progress]);
  const status = booking ? liveWalkStatus(booking, now) : null;

  // Face the direction of travel; stop walking once home.
  const progressNow = status?.progress ?? 0;
  const done = status?.done ?? false;
  useEffect(() => {
    if (done) {
      setWalking(false);
      return;
    }
    const ahead = pointAt(PARK_LOOP, Math.min(1, progressNow + 0.01));
    const here = pointAt(PARK_LOOP, progressNow);
    const dx = ahead.x - here.x;
    if (Math.abs(dx) < 0.5) return;
    const heading = dx > 0 ? 1 : -1;
    if (heading !== lastHeading.current) {
      lastHeading.current = heading;
      face(heading);
    }
  }, [progressNow, done, face, setWalking]);

  if (!booking || !status) {
    return <NoActiveWalk onBack={() => go('exitTracking')} />;
  }

  const walker = WALKERS[booking.walkerId];
  const firstName = walker.name.split(' ')[0];
  const { done: trail, rest } = splitRoute(PARK_LOOP, status.progress);
  const home = PARK_LOOP.points[0];
  const mapHeight = Math.round(windowHeight * 0.47);
  const percent = Math.round(status.progress * 100);
  const startMs = booking.startedAt ?? now;
  const returnMs = startMs + booking.minutes * 60 * 1000;
  const photoTaken = status.reached.some((event) => event.kind === 'photo');

  const markers: MapMarker[] = [
    ...status.reached
      .filter((event) => event.pin)
      .map((event) => ({
        key: event.kind,
        at: event.at,
        emoji: event.pin ?? '',
        label: `${event.pin} ${event.title} • ${eventMinute(event, booking.minutes)}`,
      })),
    ...manualMarkers,
  ];

  const logWater = () => {
    if (status.done) return;
    recordWater(booking.id);
    const minute = Math.round(status.progress * booking.minutes);
    setManualMarkers((current) => [
      ...current,
      { key: `water-${current.length}`, at: status.progress, emoji: '💧', label: `💧 Water logged • ${minute}m` },
    ]);
    show('Water break logged 💧');
  };

  const openPhoto = () => {
    if (photoTaken) setPhotoOpen(true);
    else show(`No photos yet — ${firstName} snaps one at the park 📸`);
  };

  const complete = () => {
    if (completing) return;
    setCompleting(true);
    setWalking(false);
    bark();
    completeTimer.current = setTimeout(() => navigate(() => setCompleted(true)), COMPLETE_DELAY_MS);
  };

  const call = (number: string) =>
    Linking.openURL(`tel:${number}`).catch(() => show('Calling isn’t available here'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TrackingTopBar
        title="Live Walker Tracking"
        onBack={() => go('exitTracking')}
        onInfo={() => show('Live GPS route · blue = walked, coral = way home')}
      />

      <View
        style={[styles.mapArea, { height: mapHeight }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          pan.setValue({ x: width / 2 - PARK_LOOP_FOCUS.x, y: height / 2 - PARK_LOOP_FOCUS.y });
        }}
      >
        <MascotFrame style={StyleSheet.absoluteFill}>
          <NeighborhoodMap pan={pan} showWalkers={false}>
            <Svg pointerEvents="none" style={styles.layer} width={MAP_SIZE.width} height={MAP_SIZE.height}>
              <Path
                d={toSvgPath(rest)}
                stroke={colors.coral}
                strokeWidth={4}
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d={toSvgPath(trail)}
                stroke={colors.card}
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d={toSvgPath(trail)}
                stroke={colors.primary}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>

            {/* Home */}
            <View pointerEvents="none" style={[styles.homeDot, { left: home.x - 16, top: home.y - 16 }]}>
              <View style={styles.homeDotInner} />
            </View>

            {/* Milestones dropped along the trail */}
            {markers.map((marker) => {
              const point = pointAt(PARK_LOOP, marker.at);
              const open = openMarker === marker.key;
              return (
                <View
                  key={marker.key}
                  style={[styles.markerSlot, { left: point.x - MILESTONE / 2, top: point.y - MILESTONE / 2 }]}
                >
                  {open ? (
                    <View style={styles.tooltip} pointerEvents="none">
                      <Text style={styles.tooltipText} numberOfLines={1}>
                        {marker.label}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setOpenMarker(open ? null : marker.key)}
                    accessibilityRole="button"
                    aria-label={marker.label}
                    style={({ pressed }) => [styles.marker, pressed && styles.pressed]}
                  >
                    <Text style={styles.markerEmoji}>{marker.emoji}</Text>
                  </Pressable>
                </View>
              );
            })}

            {/* Barnaby's anchor stays at Home; his pin and stage follow the same route offset. */}
            <View pointerEvents="none" style={[styles.pinSlot, { left: home.x - PIN / 2, top: home.y - PIN / 2 }]}>
              <MascotAnchor id="liveWalk" size={PIN_MASCOT} offset={offset} active={!completed} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pinSlot,
                {
                  left: home.x - PIN / 2,
                  top: home.y - PIN / 2,
                  transform: [{ translateX: offset.x }, { translateY: offset.y }],
                },
              ]}
            >
              <PulseRings size={PIN} colors={[colors.primary, colors.primary]} scaleTo={1.6} />
              <View style={styles.pinCircle} />
              <Avatar
                initials={walker.initials}
                tint={colors.card}
                ink={colors.primary}
                size={30}
                style={styles.walkerBadge}
              />
              <View style={styles.pinLabelSlot}>
                <View style={styles.pinLabel}>
                  <Text style={styles.pinLabelText} numberOfLines={1}>
                    Barnaby <Text style={styles.pinStar}>★</Text> with {walker.shortName}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </NeighborhoodMap>
        </MascotFrame>

        <View style={styles.liveRow} pointerEvents="none">
          <MapPill style={styles.livePill}>
            <PulsingDot />
            <Text style={styles.liveText} numberOfLines={1}>
              LIVE WALK <Text style={styles.liveVerified}>• OTP Verified</Text>{' '}
              <Text style={styles.livePhase}>• {status.phase}</Text>
            </Text>
          </MapPill>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <View style={styles.countLine}>
                <Text style={styles.countdown}>{formatCountdown(status.remainingSec)}</Text>
                <Text style={styles.meta}>{status.done ? 'back home' : 'remaining'}</Text>
              </View>
              <View style={styles.inlineRow}>
                <Icon name="schedule" size={15} color={colors.primary} />
                <Text style={styles.returnText}>
                  {status.done ? 'Returned home at' : 'Est. return home at'} {formatClockTime(returnMs)}
                </Text>
              </View>
            </View>
            <View style={styles.walkPill}>
              <Icon name="timer" size={15} color={colors.coralInk} />
              <Text style={styles.walkPillText}>
                {booking.minutes} Min Walk • {percent}%
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <View style={[styles.trackMarker, { left: `${percent}%` }]} pointerEvents="none">
              <Image source={CORGI} style={styles.trackCorgi} />
            </View>
            <View style={styles.trackLabels}>
              <Text style={styles.trackLabel}>Start ({formatClockTime(startMs)})</Text>
              <Text style={[styles.trackLabel, styles.trackNow]}>🐾 {status.done ? 'Home' : 'Now'}</Text>
              <Text style={styles.trackLabel}>🏠 Home ({formatClockTime(returnMs)})</Text>
            </View>
          </View>

          <View style={styles.bento}>
            <View style={[styles.tile, styles.tileBlue]}>
              <View style={styles.tileHead}>
                <Text style={styles.tileLabel}>DISTANCE</Text>
                <Icon name="route" size={16} color={colors.primary} />
              </View>
              <Text style={styles.tileValue}>
                {status.km.toFixed(2)} <Text style={styles.tileUnit}>km</Text>
              </Text>
              <Text style={styles.tileMeta}>🐾 Pace: Brisk</Text>
            </View>
            <View style={[styles.tile, styles.tileSlate]}>
              <View style={styles.tileHead}>
                <Text style={styles.tileLabel}>ENERGY</Text>
                <Icon name="local-fire-department" size={16} color={colors.coral} />
              </View>
              <Text style={styles.tileValue}>
                {status.kcal} <Text style={styles.tileUnit}>kcal</Text>
              </Text>
              <Text style={[styles.tileMeta, { color: colors.coralInk }]}>🔥 Active burn</Text>
            </View>
            <View style={[styles.tile, styles.tileBlue]}>
              <View style={styles.tileHead}>
                <Text style={styles.tileLabel}>POTTY & WATER</Text>
              </View>
              <Text style={styles.tileSmallValue}>
                {status.pee} Pee • {status.poo} Poo
              </Text>
              <View style={styles.tileFoot}>
                <Text style={styles.tileMeta}>💧 {status.water}x</Text>
                <Pressable
                  onPress={logWater}
                  accessibilityRole="button"
                  aria-label="Log a water break"
                  hitSlop={6}
                  style={({ pressed }) => [styles.logPill, pressed && styles.pressed]}
                >
                  <Text style={styles.logText}>+ Log</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.update}>
            <View style={styles.updateRow}>
              <View>
                <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={46} />
                <View style={styles.verifiedBadge}>
                  <Icon name="check" size={11} color={colors.onPrimary} />
                </View>
              </View>
              <View style={styles.flex}>
                <View style={styles.spaceBetween}>
                  <Text style={styles.updateName}>{walker.name}</Text>
                  <Text style={styles.meta}>{status.updateAgo}</Text>
                </View>
                <Text style={styles.updateText}>“{status.update.text}”</Text>
              </View>
              {status.update.photo ? (
                <Pressable onPress={openPhoto} accessibilityRole="button" aria-label="View walk photo">
                  <Image source={PARK_PHOTO} style={styles.updatePhoto} resizeMode="cover" />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.updateActions}>
              <Pressable
                onPress={() => setChatOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.messagePill, pressed && styles.pressed]}
              >
                <Icon name="chat" size={18} color={colors.primary} />
                <Text style={styles.messageText}>Message {firstName}</Text>
              </Pressable>
              <RoundIconButton
                icon="call"
                label={`Call ${walker.name}`}
                onPress={() => call(walker.phone)}
                tint={colors.card}
              />
              <RoundIconButton
                icon="photo-camera"
                label="View walk photo"
                onPress={openPhoto}
                tint={colors.card}
                ink={colors.coral}
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            onPress={() => setSosOpen(true)}
            accessibilityRole="button"
            aria-label="SOS / Support"
            style={({ pressed }) => [styles.sos, pressed && styles.pressed]}
          >
            <Icon name="security" size={20} color={colors.coral} />
            <Text style={styles.sosText}>SOS / Support</Text>
          </Pressable>
          <Pressable
            onPress={complete}
            disabled={completing}
            accessibilityRole="button"
            aria-label="Complete walk and drop-off"
            style={({ pressed }) => [styles.complete, pressed && styles.completePressed]}
          >
            <Text style={styles.completeText} numberOfLines={1}>
              Complete & Drop-off
            </Text>
            <Icon name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      <Toast message={message} bottomOffset={100} />

      {photoOpen ? (
        <Pressable style={styles.photoBackdrop} onPress={() => setPhotoOpen(false)} aria-label="Close photo">
          <View style={styles.photoCard}>
            <Image source={PARK_PHOTO} style={styles.photo} resizeMode="cover" />
            <Text style={styles.photoCaption}>
              📸 Barnaby at Elm Creek Park · snapped by {firstName}
            </Text>
            <Text style={styles.meta}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      ) : null}

      {chatOpen ? (
        <WalkerChatSheet
          walker={walker}
          latest={status.update.text}
          quickReplies={['Thank you! 🐾', 'Extra treat for good boy?', 'Take a photo please 📸']}
          onClose={() => setChatOpen(false)}
        />
      ) : null}

      {sosOpen ? (
        <ActionSheet
          title="Need help?"
          subtitle="PawPal Safety is on call 24/7 during every walk."
          options={[
            {
              icon: 'call',
              label: `Call ${walker.name}`,
              detail: 'Talk to your walker right now',
              onPress: () => {
                setSosOpen(false);
                call(walker.phone);
              },
            },
            {
              icon: 'security',
              label: 'PawPal Safety Line (24/7)',
              detail: 'Report a problem with this walk',
              tone: 'coral',
              onPress: () => {
                setSosOpen(false);
                call(SAFETY_LINE);
              },
            },
            {
              icon: 'local-hospital',
              label: 'Emergency Vet · Mission Pet ER',
              detail: 'Open 24/7 · 1.2 km from the route',
              tone: 'coral',
              onPress: () => {
                setSosOpen(false);
                call(EMERGENCY_VET);
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
          fare={booking.total}
          onDone={(rating, tip) => {
            completeWalk(booking.id, { distanceKm: Math.round(status.km * 100) / 100, rating, tip });
            go('exitTracking');
          }}
        />
      ) : null}
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
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  homeDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  homeDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.card,
  },
  markerSlot: {
    position: 'absolute',
    width: MILESTONE,
    height: MILESTONE,
    alignItems: 'center',
  },
  marker: {
    width: MILESTONE,
    height: MILESTONE,
    borderRadius: MILESTONE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.float,
  },
  markerEmoji: {
    fontSize: 16,
  },
  tooltip: {
    position: 'absolute',
    bottom: MILESTONE + 6,
    width: 170,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
  },
  tooltipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  pinSlot: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircle: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    backgroundColor: colors.stage,
    borderWidth: 4,
    borderColor: colors.card,
    ...shadows.float,
  },
  walkerBadge: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  pinLabelSlot: {
    position: 'absolute',
    top: PIN + 8,
    left: (PIN - 200) / 2,
    width: 200,
    alignItems: 'center',
  },
  pinLabel: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
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
  },
  livePill: {
    alignSelf: 'stretch',
  },
  liveText: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.ink,
  },
  liveVerified: {
    color: colors.primary,
  },
  livePhase: {
    fontFamily: fonts.semibold,
    color: colors.slate,
    letterSpacing: 0,
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
    gap: 16,
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
  returnText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  walkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.coralTint,
  },
  walkPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.coralInk,
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
  trackMarker: {
    position: 'absolute',
    top: -12,
    marginLeft: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: colors.stage,
    borderWidth: 2,
    borderColor: colors.card,
    ...shadows.soft,
  },
  trackCorgi: {
    width: 32,
    height: 32,
    marginLeft: -2,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  trackLabel: {
    ...typography.bodySm,
    fontSize: 11,
  },
  trackNow: {
    color: colors.primary,
    fontFamily: fonts.bold,
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
  },
  tileBlue: {
    backgroundColor: colors.primaryTint,
  },
  tileSlate: {
    backgroundColor: '#F8FAFC',
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.slate,
  },
  tileValue: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    color: colors.ink,
  },
  tileUnit: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
  },
  tileSmallValue: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  tileMeta: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.primary,
  },
  tileFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  logText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  update: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.stage,
  },
  updateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.stage,
  },
  updateName: {
    ...typography.subhead,
  },
  updateText: {
    ...typography.body,
    color: colors.ink,
  },
  updatePhoto: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.card,
  },
  updateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  messagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  messageText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
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
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: '#FFF0ED',
  },
  sosText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coral,
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
    transform: [{ scale: 0.95 }],
  },
});
