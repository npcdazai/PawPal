import React, { memo, useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { useResponsive } from '../theme/responsive';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { CircularProgress } from '../components/CircularProgress';
import { ProgressBar } from '../components/ProgressBar';
import { Toast, useToast } from '../components/Toast';
import { BOTTOM_NAV_HEIGHT, bottomNavClearance } from '../components/BottomNavigation';
import { DASHBOARD_SECTIONS, type DashboardSection } from '../navigation/navigation';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { Avatar } from '../components/Avatar';
import { useBookings, type WalkBooking, type WalkStatus } from '../booking/BookingsProvider';
import { SUBSCRIPTION_PER_WALK, TRIAL_PRICE, formatMoney } from '../booking/walkPlans';
import { SOCIETIES } from '../booking/societies';
import { WALKERS, WALKER_IDS, type WalkerId } from '../data/careTeam';

const WALK_GOAL_KM = 4;
const TODAY_WALK_KM = 3.2;
const KCAL_PER_KM = 65.6;
const DAILY_MEALS = 2;
/** Recent Moments shows the newest few until "See all"; the log keeps at most MAX_MOMENTS. */
const VISIBLE_MOMENTS = 5;
const MAX_MOMENTS = 30;

type QuickAction = 'walk' | 'feed' | 'meds' | 'bowl';

interface Moment {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: string;
  tint: string;
  ink: string;
}

const QUICK_ACTIONS: { key: QuickAction; label: string; icon: string; tint: string; ink: string }[] = [
  { key: 'walk', label: 'Log Walk', icon: 'directions-walk', tint: colors.primaryTint, ink: colors.primary },
  { key: 'feed', label: 'Feed Now', icon: 'restaurant', tint: colors.stage, ink: colors.coral },
  { key: 'meds', label: 'Log Meds', icon: 'medication', tint: colors.primaryTint, ink: colors.primary },
  { key: 'bowl', label: 'Refill Bowl', icon: 'water-drop', tint: colors.stage, ink: colors.coral },
];

const INITIAL_MOMENTS: Moment[] = [
  {
    id: 'riverside',
    title: 'Sunny Riverside Walk',
    detail: '32 min · Made a beagle friend!',
    time: '08:15 AM',
    icon: 'park',
    tint: colors.primaryTint,
    ink: colors.primary,
  },
  {
    id: 'breakfast',
    title: 'Breakfast Kibble + Bone Broth',
    detail: '1.5 cups · Slow feeder cleared',
    time: '07:40 AM',
    icon: 'restaurant',
    tint: colors.stage,
    ink: colors.coral,
  },
  {
    id: 'glucosamine',
    title: 'Daily Glucosamine Chew',
    detail: 'Joint support · Accepted happily',
    time: '07:30 AM',
    icon: 'medication',
    tint: colors.amberTint,
    ink: colors.amberInk,
  },
];

const formatClock = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Dashboard sections reachable from the common tab bar (see NAVIGATION.tabBar). */
const toSection = (value: string | undefined): DashboardSection =>
  DASHBOARD_SECTIONS.find((section) => section === value) ?? DASHBOARD_SECTIONS[0];

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { compact } = useResponsive();
  const { go, goToTab } = useAppNavigation();
  const { bookings } = useBookings();
  const nextWalk = bookings.find((booking) => booking.status !== 'cancelled');
  const completedWalks = bookings.filter((booking) => booking.status === 'completed');
  const { bark } = useMascotActions();
  const { message, show } = useToast();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionY = useRef<Partial<Record<DashboardSection, number>>>({});

  // The `section` param (set by the common tab bar) picks where to scroll.
  const params = useLocalSearchParams<{ section?: string }>();
  const section = toSection(params.section);
  const [treats, setTreats] = useState(3);
  // Completed walker walks add to today's distance.
  const walkKm =
    Math.round(
      (TODAY_WALK_KM + completedWalks.reduce((sum, walk) => sum + (walk.distanceKm ?? 0), 0)) * 10
    ) / 10;
  const [mealsServed, setMealsServed] = useState(2);
  const [bonusSnacks, setBonusSnacks] = useState(0);
  const [moments, setMoments] = useState<Moment[]>(INITIAL_MOMENTS);
  const [showAllMoments, setShowAllMoments] = useState(false);
  const momentSeq = useRef(0);

  const walkMoments: Moment[] = completedWalks.map((walk) => ({
    id: walk.id,
    title: `Walk with ${WALKERS[walk.walkerId].shortName}`,
    detail: `${walk.distanceKm?.toFixed(2) ?? '0.00'} km · ${'★'.repeat(walk.rating ?? 5)} · Home safe`,
    time: walk.completedAt ? formatClock(new Date(walk.completedAt)) : '',
    icon: 'directions-walk',
    tint: colors.successTint,
    ink: colors.successInk,
  }));

  const allMoments = [...walkMoments, ...moments].slice(0, MAX_MOMENTS);
  const shownMoments = showAllMoments ? allMoments : allMoments.slice(0, VISIBLE_MOMENTS);

  const walkPercent = Math.min(100, Math.round((walkKm / WALK_GOAL_KM) * 100));
  const kcal = Math.round(walkKm * KCAL_PER_KM);

  const logMoment = (moment: Omit<Moment, 'id' | 'time'>) => {
    momentSeq.current += 1;
    const entry = { ...moment, id: `log-${momentSeq.current}`, time: formatClock(new Date()) };
    setMoments((current) => [entry, ...current].slice(0, MAX_MOMENTS));
  };

  const runQuickAction = (action: QuickAction) => {
    // "Log Walk" starts the Book a Walk flow; Barnaby walks ahead instead of barking.
    if (action === 'walk') {
      go('bookWalk');
      return;
    }
    bark();
    switch (action) {
      case 'feed': {
        if (mealsServed < DAILY_MEALS) setMealsServed((served) => served + 1);
        else setBonusSnacks((snacks) => snacks + 1);
        logMoment({
          title: mealsServed < DAILY_MEALS ? 'Meal Served' : 'Bonus Snack',
          detail: mealsServed < DAILY_MEALS ? 'Kibble bowl cleared' : 'Crunchy carrot treat',
          icon: 'restaurant',
          tint: colors.stage,
          ink: colors.coral,
        });
        show(mealsServed < DAILY_MEALS ? 'Meal served 🍲' : 'Bonus snack logged 🥕');
        break;
      }
      case 'meds': {
        logMoment({
          title: 'Meds Logged',
          detail: 'Glucosamine dose recorded',
          icon: 'medication',
          tint: colors.amberTint,
          ink: colors.amberInk,
        });
        show('Meds logged 💊');
        break;
      }
      case 'bowl': {
        logMoment({
          title: 'Water Bowl Refilled',
          detail: 'Fresh 750 ml, nice and cool',
          icon: 'water-drop',
          tint: colors.primaryTint,
          ink: colors.primary,
        });
        show('Fresh water poured 💧');
        break;
      }
    }
  };

  const dispenseTreat = () => {
    if (treats === 0) return;
    setTreats((count) => count - 1);
    bark();
    logMoment({
      title: 'Treat Dispensed',
      detail: 'Crunch crunch — caught mid-air!',
      icon: 'cookie',
      tint: colors.coralTint,
      ink: colors.coral,
    });
  };

  // Runs on focus too, so returning from Profile lands on the chosen section once visible.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: sectionY.current[section] ?? 0, animated: true });
      }, 60);
      return () => clearTimeout(timer);
    }, [section])
  );

  const openProfile = () => goToTab('profile');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance(insets.bottom) + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top navigation */}
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoGlyph}>🐾</Text>
            </View>
            <View>
              <Text style={styles.brandName}>PawPal</Text>
              <Text style={styles.brandSection}>Home</Text>
            </View>
          </View>
          <Pressable
            onPress={openProfile}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>S</Text>
          </Pressable>
        </View>

        {/* Greeting & mascot banner */}
        <View style={styles.banner}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerCopy}>
              <Badge label="Barnaby is feeling playful" tone="white" dot />
              <Text style={styles.bannerTitle}>Welcome back, Sarah & Barnaby! 🐾</Text>
              <Text style={styles.bannerSubtitle}>
                {"Ready for today's joyful tail-wags and outdoor adventures."}
              </Text>
            </View>
            <View style={styles.dock}>
              <MascotDockSlot variant="dashboard-dock" />
              <Pressable onPress={bark} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.dockLabel}>TAP TO PET</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.treatBar}>
            <Text style={styles.treatText}>
              🦴 Daily Treat Jar{' '}
              <Text style={styles.treatCount}>
                ({treats === 0 ? 'empty' : `${treats} left`})
              </Text>
            </Text>
            <Pressable
              onPress={dispenseTreat}
              disabled={treats === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: treats === 0 }}
              style={({ pressed }) => [
                styles.dispense,
                pressed && styles.pressed,
                treats === 0 && styles.dispenseEmpty,
              ]}
            >
              <Text style={styles.dispenseText}>{treats === 0 ? 'Refills 6 PM' : 'Dispense'}</Text>
            </Pressable>
          </View>
        </View>

        <WalkerBookingCard
          booking={nextWalk}
          onBook={() => go('bookWalk')}
          onRebook={(walkerId) => go('bookWalk', { walker: walkerId })}
          onTrack={(status) => go(status === 'inProgress' ? 'openLiveWalk' : 'trackWalker')}
        />

        {/* Quick care */}
        <View style={styles.section}>
          <SectionHeader title="Quick Care" meta="Tap to log instantly" />
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => runQuickAction(action.key)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
              >
                <View style={[styles.quickCircle, { backgroundColor: action.tint }]}>
                  <Icon name={action.icon} size={26} color={action.ink} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Today's rhythm */}
        <View
          style={styles.section}
          onLayout={(event) => {
            sectionY.current.health = event.nativeEvent.layout.y;
          }}
        >
          <SectionHeader title="Today's Rhythm" meta={`Goal: ${WALK_GOAL_KM.toFixed(1)} km`} />

          <View style={[styles.card, styles.walkCard]}>
            <View style={styles.walkCopy}>
              <View style={styles.cardTitleRow}>
                <Icon name="directions-run" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Daily Walk</Text>
              </View>
              <Text style={styles.walkMetric}>
                {walkKm.toFixed(1)}
                <Text style={styles.walkGoal}> / {WALK_GOAL_KM.toFixed(1)} km</Text>
              </Text>
              <Text style={styles.cardMeta}>{kcal} kcal burned today</Text>
            </View>
            <CircularProgress percentage={walkPercent} size={76} strokeWidth={8} />
          </View>

          <View style={styles.bentoRow}>
            <View style={[styles.card, styles.bento]}>
              <View style={styles.bentoTop}>
                <View style={[styles.bentoIcon, { backgroundColor: colors.stage }]}>
                  <Icon name="restaurant" size={18} color={colors.coral} />
                </View>
                <Badge label="On track" tone="success" />
              </View>
              <Text style={styles.cardTitle}>Meals Served</Text>
              <Text style={styles.bentoValue}>
                {mealsServed} of {DAILY_MEALS}
              </Text>
              <ProgressBar progress={mealsServed / DAILY_MEALS} color={colors.success} height={6} />
              {bonusSnacks > 0 ? (
                <Text style={styles.cardMeta}>
                  +{bonusSnacks} bonus {bonusSnacks === 1 ? 'snack' : 'snacks'}
                </Text>
              ) : null}
            </View>

            <View style={[styles.card, styles.bento]}>
              <View style={styles.bentoTop}>
                <View style={[styles.bentoIcon, { backgroundColor: colors.primaryTint }]}>
                  <Icon name="medical-services" size={18} color={colors.primary} />
                </View>
                <Badge label="Annual" tone="primary" />
              </View>
              <Text style={styles.cardTitle}>Next Vet Checkup</Text>
              <Text style={styles.bentoValue}>12 days left</Text>
              <Text style={styles.cardMeta}>Dr. Ava Wells</Text>
            </View>
          </View>
        </View>

        {/* Recent moments */}
        <View
          style={styles.section}
          onLayout={(event) => {
            sectionY.current.activities = event.nativeEvent.layout.y;
          }}
        >
          <SectionHeader title="Recent Moments" meta="Today" />

          <View style={styles.highlight}>
            <Image
              source={require('../../assets/corgi_dashboard.jpg')}
              style={styles.highlightThumb}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.highlightCopy}>
              <Badge label="Highlight" tone="coral" />
              <Text style={styles.highlightTitle}>Morning sprint at Elm Creek</Text>
              <Text style={styles.cardMeta}>2.1 km · Personal best pace!</Text>
            </View>
          </View>

          <View style={styles.momentList}>
            {shownMoments.map((moment) => (
              <MomentRow
                key={moment.id}
                title={moment.title}
                detail={moment.detail}
                time={moment.time}
                icon={moment.icon}
                tint={moment.tint}
                ink={moment.ink}
                lines={compact ? 2 : 1}
              />
            ))}
          </View>
          {allMoments.length > VISIBLE_MOMENTS ? (
            <Pressable
              onPress={() => setShowAllMoments((all) => !all)}
              accessibilityRole="button"
              aria-expanded={showAllMoments}
              hitSlop={8}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            >
              <Text style={styles.seeAllText}>{showAllMoments ? 'Show less' : `See all ${allMoments.length}`}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Toast message={message} bottomOffset={BOTTOM_NAV_HEIGHT + 28} />
    </SafeAreaView>
  );
}

interface WalkerBookingCardProps {
  booking: WalkBooking | undefined;
  onBook: () => void;
  onRebook: (walkerId: WalkerId) => void;
  onTrack: (status: WalkStatus) => void;
}

const CARD_COPY: Record<
  Exclude<WalkStatus, 'cancelled'>,
  { title: string; badge: string; tone: 'success' | 'coral' | 'primary'; action: string }
> = {
  enRoute: { title: 'Walker on the way', badge: 'Matched', tone: 'success', action: 'Track walker' },
  inProgress: { title: 'Walk in progress', badge: 'Live', tone: 'coral', action: 'Live walk' },
  scheduled: { title: 'Next walk booked', badge: 'Confirmed', tone: 'primary', action: 'Book again' },
  completed: { title: 'Last walk complete', badge: 'Home safe', tone: 'success', action: 'Book again' },
};

/** "Book a Dog Walker" entry point; follows the latest walk through tracking to completion. */
function WalkerBookingCard({ booking, onBook, onRebook, onTrack }: WalkerBookingCardProps) {
  if (booking && booking.status !== 'cancelled') {
    const walker = WALKERS[booking.walkerId];
    const society = SOCIETIES[booking.society];
    const copy = CARD_COPY[booking.status];
    const tracking = booking.status === 'enRoute' || booking.status === 'inProgress';
    const detail =
      booking.status === 'completed'
        ? `${booking.distanceKm?.toFixed(2) ?? '0.00'} km with ${walker.shortName} · ${'★'.repeat(booking.rating ?? 5)}`
        : booking.status === 'inProgress'
          ? `with ${walker.shortName} · neighbourhood walk`
          : booking.status === 'enRoute'
            ? `${walker.shortName} ⭐ ${walker.rating.toFixed(1)} · heading to ${booking.tower} lobby`
            : `${walker.shortName} ⭐ ${walker.rating.toFixed(1)} · ${booking.whenLabel}`;
    return (
      <View style={[styles.card, styles.walkerCard]}>
        <View style={styles.walkerTop}>
          <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={48} />
          <View style={styles.walkerCopy}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.walkerTitle}>{copy.title}</Text>
              <Badge label={copy.badge} tone={copy.tone} dot />
            </View>
            <Text style={styles.cardMeta}>{detail}</Text>
            <Text style={styles.cardMeta}>
              {booking.minutes} min walk · 🏘️ {society.shortName}, {booking.tower}
            </Text>
          </View>
        </View>
        <View style={styles.walkerBottom}>
          <Text style={styles.walkerTotal}>
            {booking.tier === 'subscription'
              ? formatMoney(SUBSCRIPTION_PER_WALK + (booking.tip ?? 0))
              : formatMoney(booking.total + (booking.tip ?? 0))}
            {booking.tier === 'subscription' ? <Text style={styles.cardMeta}>/walk</Text> : null}
            {booking.tip ? <Text style={styles.cardMeta}> incl. tip</Text> : null}
            {booking.payment ? (
              <Text style={styles.cardMeta}>
                {booking.tier === 'subscription' ? ' · Monthly plan paid via UPI' : ' · Paid via UPI'}
                {booking.payment.verified ? '' : ` (ref …${booking.payment.reference.slice(-4)})`}
              </Text>
            ) : null}
          </Text>
          <Pressable
            onPress={() => (tracking ? onTrack(booking.status) : onRebook(booking.walkerId))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.walkerButton, pressed && styles.pressed]}
          >
            <Text style={styles.walkerButtonText}>{copy.action}</Text>
            <Icon name={tracking ? 'near-me' : 'arrow-forward'} size={16} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onBook}
      accessibilityRole="button"
      aria-label="Book a dog walker"
      style={({ pressed }) => [styles.card, styles.walkerCard, pressed && styles.pressed]}
    >
      <View style={styles.walkerTop}>
        <View style={styles.walkerIcon}>
          <Icon name="directions-walk" size={26} color={colors.onPrimary} />
        </View>
        <View style={styles.walkerCopy}>
          <Text style={styles.walkerTitle}>🦮 Book a Dog Walker</Text>
          <Text style={styles.cardMeta}>
            Society walkers, zero travel delay · {formatMoney(SUBSCRIPTION_PER_WALK)}/walk · Trial{' '}
            {formatMoney(TRIAL_PRICE)}
          </Text>
        </View>
        <View style={styles.avatarStack}>
          {WALKER_IDS.slice(0, 3).map((id, index) => {
            const walker = WALKERS[id];
            return (
              <Avatar
                key={id}
                initials={walker.initials}
                tint={walker.tint}
                ink={walker.ink}
                size={30}
                style={[styles.stackedAvatar, index > 0 && styles.stackedOverlap]}
              />
            );
          })}
        </View>
      </View>
      <View style={styles.walkerBottom}>
        <View style={styles.walkerPerks}>
          <Badge label="Insured" tone="success" dot />
          <Badge label="Live GPS" tone="primary" />
        </View>
        <View style={styles.walkerButton}>
          <Text style={styles.walkerButtonText}>Book now</Text>
          <Icon name="arrow-forward" size={16} color={colors.onPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * One Recent Moments row; primitive props so unchanged rows skip re-rendering.
 * `lines`: narrow phones give the title and detail a second line instead of cutting them off.
 */
const MomentRow = memo(function MomentRow({
  title,
  detail,
  time,
  icon,
  tint,
  ink,
  lines,
}: Omit<Moment, 'id'> & { lines: number }) {
  return (
    <View style={styles.momentRow}>
      <View style={[styles.momentIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={20} color={ink} />
      </View>
      <View style={styles.momentCopy}>
        <Text style={styles.momentTitle} numberOfLines={lines}>
          {title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={lines}>
          {detail}
        </Text>
      </View>
      <Text style={styles.momentTime}>{time}</Text>
    </View>
  );
});

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 22,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    fontSize: 20,
  },
  brandName: {
    ...typography.headline,
    lineHeight: 22,
  },
  brandSection: {
    ...typography.bodySm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
    ...shadows.soft,
  },
  avatarText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    color: colors.card,
  },
  banner: {
    padding: 16,
    gap: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.stage,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerCopy: {
    flex: 1,
    gap: 8,
  },
  bannerTitle: {
    ...typography.headline,
    fontSize: 19,
  },
  bannerSubtitle: {
    ...typography.bodySm,
    fontSize: 13,
    lineHeight: 18,
  },
  dock: {
    alignItems: 'center',
    gap: 6,
  },
  dockLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.coralInk,
  },
  treatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  treatText: {
    ...typography.label,
    flexShrink: 1,
  },
  treatCount: {
    fontFamily: fonts.medium,
    color: colors.slate,
  },
  dispense: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.coral,
    ...shadows.coral,
  },
  dispenseEmpty: {
    backgroundColor: colors.placeholder,
    boxShadow: 'none',
  },
  dispenseText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onPrimary,
  },
  walkerCard: {
    gap: 14,
  },
  walkerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walkerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  walkerCopy: {
    flex: 1,
    gap: 3,
  },
  walkerTitle: {
    ...typography.subhead,
    fontSize: 16,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: colors.card,
  },
  stackedOverlap: {
    marginLeft: -10,
  },
  walkerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  walkerPerks: {
    flexDirection: 'row',
    gap: 6,
  },
  walkerTotal: {
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.ink,
  },
  walkerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  walkerButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.headline,
  },
  sectionMeta: {
    ...typography.bodySm,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickItem: {
    width: '24%',
    alignItems: 'center',
    gap: 8,
  },
  quickCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...typography.label,
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    ...typography.label,
  },
  cardMeta: {
    ...typography.bodySm,
  },
  walkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walkCopy: {
    gap: 4,
  },
  walkMetric: {
    ...typography.metric,
  },
  walkGoal: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.slate,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bento: {
    flex: 1,
    gap: 6,
  },
  bentoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bentoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoValue: {
    ...typography.headline,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.stage,
  },
  highlightThumb: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
  },
  highlightCopy: {
    flex: 1,
    gap: 4,
  },
  highlightTitle: {
    ...typography.subhead,
  },
  momentList: {
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    paddingVertical: 4,
    ...shadows.card,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  momentIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentCopy: {
    flex: 1,
    gap: 2,
  },
  momentTitle: {
    ...typography.subhead,
    fontSize: 14,
  },
  momentTime: {
    ...typography.bodySm,
    color: colors.placeholder,
  },
  seeAll: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  seeAllText: {
    ...typography.label,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
