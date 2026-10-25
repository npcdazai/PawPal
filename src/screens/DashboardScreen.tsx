import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useMe, queryKeys } from '../api/queries';
import { useRefetchOnFocus } from '../api/useRefetchOnFocus';
import { initialsOf } from '../api/parse';
import type { Booking, ExpressMinutes, NearbyWalkers, Pricing, Subscription } from '../api/types';
import { PawsomeGradientScreen } from '../components/PawsomeGradientScreen';
import { Icon } from '../components/Icon';
import { Toast, useToast } from '../components/Toast';
import { BOTTOM_NAV_HEIGHT, bottomNavClearance } from '../components/BottomNavigation';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings } from '../booking/BookingsProvider';
import {
  arrivalLine,
  expressChoice,
  insurancePill,
  latestCompletedWalk,
  nextWalkLine,
  packAccentLine,
  peeLabel,
  placeLine,
  poopLabel,
  proofCard,
  radarLine,
  walkersActiveLine,
  type HomeContext,
} from '../booking/homeModel';
import {
  BackupStrip,
  CALL_SOON,
  ProgressRing,
  RescheduleSheet,
  RetryRow,
  Skeleton,
  StartPlanCard,
  WalkerRow,
} from '../booking/PackWidgets';
import { clearPlanIntent, planIntentParams, setPlanIntent, type PlanIntent } from '../booking/planIntent';
import { useHomeData } from '../booking/useHomeData';
import { useNow } from '../booking/useNow';
import { formatMoney } from '../booking/walkPlans';
import { colors, radii } from '../theme/colors';
import { gradients } from '../theme/gradients';
import { fonts } from '../theme/typography';
import { useResponsive } from '../theme/responsive';

/** Long enough for Barnaby's bark to read before he sprints off with the booking. */
const WOOF_LEAD_MS = 280;

const INK = '#181A20';
const SLATE = '#757B8A';
const BLUE_WASH = '#E8F0FE';
const CORAL = '#FF6B4A';

/**
 * Home: the greeting header over the sky, the monthly society pack, the
 * instant/express walk and the latest walk's proof — all from the API
 * (DASHBOARD_API.md). Missing data means a skeleton, a retry row or an honest
 * empty card, never sample figures.
 */
export function DashboardScreen() {
  const focused = useIsFocused();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const { compact } = useResponsive();
  const { go, goToTab } = useAppNavigation();
  const { bark, glance } = useMascotActions();
  const { societyProfile } = useBookings();
  const { message, show } = useToast();
  const { data: me } = useMe();
  const home = useHomeData({ focused });
  const { bookingsQuery, packsQuery, pricingQuery, nearbyQuery, bookings, pack, context, weather } = home;

  const [minutes, setMinutes] = useState<ExpressMinutes>(30);
  const [rescheduling, setRescheduling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const woofTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRefetchOnFocus([queryKeys.bookings, queryKeys.subscriptions]);
  // Back home: a booking started from a card and abandoned doesn't carry its plan into the next one.
  useFocusEffect(useCallback(() => clearPlanIntent(), []));
  useEffect(
    () => () => {
      if (woofTimer.current) clearTimeout(woofTimer.current);
    },
    []
  );

  const startBooking = (intent: PlanIntent) => {
    setPlanIntent(intent);
    // With the society profile already filled in, go straight to the plan.
    if (societyProfile) go('planWalk', planIntentParams(intent));
    else go('bookWalk');
  };

  const bookExpress = () => {
    bark();
    if (woofTimer.current) clearTimeout(woofTimer.current);
    woofTimer.current = setTimeout(() => startBooking({ tier: 'express', minutes }), WOOF_LEAD_MS);
  };

  const chooseMinutes = (next: ExpressMinutes) => {
    if (next === minutes) return;
    setMinutes(next);
    glance();
  };

  const openOtp = () => {
    const next = pack?.nextWalk;
    if (!next?.bookingId || !next.pickupOtp) {
      show('Your walk OTP shows here once the walk is booked, the evening before');
      return;
    }
    // Forward move: Barnaby sprints off (EXITING) before the OTP screen opens.
    go('trackWalker', { id: next.bookingId });
  };

  const refresh = () => {
    setRefreshing(true);
    home.refetchAll().finally(() => setRefreshing(false));
  };

  const insurance = insurancePill(bookings);
  const place = placeLine(context);
  const userInitials = me?.user.name.trim() ? initialsOf(me.user.name) : null;
  const lastWalk = latestCompletedWalk(bookings);

  return (
    <PawsomeGradientScreen variant="HERO">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance(insets.bottom) + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <TopBar
          place={place}
          nearby={context.pickup ? nearbyQuery.data : undefined}
          dogName={context.dogName}
          userInitials={userInitials}
          onSetUp={() => go('bookWalk')}
          onProfile={() => goToTab('profile')}
        />

        {/* Zone 1: glass greeting header, blending into the sky */}
        <View style={styles.glass}>
          <View style={styles.pillRow}>
            <View style={[styles.insurancePill, insurance.active && styles.insurancePillActive]}>
              <Text style={styles.insuranceText}>{insurance.text}</Text>
            </View>
            {weather ? (
              <View style={styles.weatherPill} aria-label={`${Math.round(weather.tempC)} degrees`}>
                <Text style={styles.weatherText}>
                  {weather.icon} {Math.round(weather.tempC)}°C
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.greetRow}>
            <View style={styles.greetCopy}>
              <Text style={[styles.greetTitle, compact && styles.greetTitleCompact]}>
                {context.dogName ? `Ready for a walk, ${context.dogName}? 🐾` : 'Ready for a walk? 🐾'}
              </Text>
              <Text style={styles.greetSub}>Choose your daily society batch or book an instant walk below.</Text>
            </View>
            <View style={styles.stage}>
              <MascotDockSlot variant="compact-dock" />
              <Pressable
                onPress={bark}
                accessibilityRole="button"
                aria-label="Pet Barnaby"
                hitSlop={8}
                style={({ pressed }) => [styles.petMe, pressed && styles.pressed]}
              >
                <Text style={styles.petMeText}>PET ME</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Zone 2: monthly society subscription */}
        {packsQuery.isPending ? (
          <PackSkeleton />
        ) : packsQuery.isError && !packsQuery.data ? (
          <RetryRow
            message="Couldn’t load your monthly plan."
            busy={packsQuery.isFetching}
            onRetry={() => void packsQuery.refetch()}
          />
        ) : pack ? (
          <PackCard
            pack={pack}
            now={now}
            onReschedule={() => setRescheduling(true)}
            onOtp={openOtp}
            onCall={() => show(CALL_SOON)}
          />
        ) : (
          <StartPlanCard pricing={pricingQuery.data} onStart={() => startBooking({ tier: 'subscription' })} />
        )}

        {/* Zone 3: instant / express walk */}
        <ExpressCard
          pricing={pricingQuery.data}
          pricingFailed={pricingQuery.isError && !pricingQuery.data}
          retryingPricing={pricingQuery.isFetching}
          onRetryPricing={() => void pricingQuery.refetch()}
          nearby={context.pickup ? nearbyQuery.data : undefined}
          nearbyLoading={context.pickup !== null && nearbyQuery.isPending}
          context={context}
          minutes={minutes}
          compact={compact}
          onMinutes={chooseMinutes}
          onBook={bookExpress}
        />

        {/* Zone 4: the latest walk's proof */}
        {bookingsQuery.isPending ? (
          <Skeleton height={112} radius={20} />
        ) : bookingsQuery.isError && !bookingsQuery.data ? (
          <RetryRow
            message="Couldn’t load your walks."
            busy={bookingsQuery.isFetching}
            onRetry={() => void bookingsQuery.refetch()}
          />
        ) : lastWalk ? (
          <ProofCard walk={lastWalk} now={now} />
        ) : null}
      </ScrollView>

      {rescheduling && pack ? (
        <RescheduleSheet pack={pack} now={now} onClose={() => setRescheduling(false)} onResult={show} />
      ) : null}
      <Toast message={message} bottomOffset={BOTTOM_NAV_HEIGHT + 20} />
    </PawsomeGradientScreen>
  );
}

function TopBar({
  place,
  nearby,
  dogName,
  userInitials,
  onSetUp,
  onProfile,
}: {
  place: string | null;
  nearby: NearbyWalkers | undefined;
  dogName: string | null;
  userInitials: string | null;
  onSetUp: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topCopy}>
        {place ? (
          <View style={styles.placeRow}>
            <Icon name="location-on" size={17} color={colors.primary} />
            <Text style={styles.placeText} numberOfLines={2}>
              {place}
            </Text>
          </View>
        ) : (
          <Pressable onPress={onSetUp} accessibilityRole="button" style={styles.placeRow} hitSlop={6}>
            <Icon name="add-location-alt" size={17} color={colors.primary} />
            <Text style={[styles.placeText, styles.placeLink]}>Add your society</Text>
          </Pressable>
        )}
        {nearby ? (
          <View style={styles.activeRow}>
            <View style={[styles.activeDot, nearby.count === 0 && styles.activeDotIdle]} />
            <Text style={[styles.activeText, nearby.count === 0 && styles.activeTextIdle]}>
              {walkersActiveLine(nearby)}
            </Text>
          </View>
        ) : null}
      </View>
      {dogName ? (
        <View style={styles.dogChip}>
          <Text style={styles.dogChipText} numberOfLines={1}>
            🐕 {dogName}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onProfile}
        accessibilityRole="button"
        aria-label="Your profile"
        hitSlop={4}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
        {userInitials ? (
          <Text style={styles.avatarText}>{userInitials}</Text>
        ) : (
          <Icon name="person-outline" size={18} color={colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

function PackSkeleton() {
  return (
    <View style={[styles.packCard, styles.skeletonCard]} aria-label="Loading your monthly plan">
      <View style={styles.packHead}>
        <View style={styles.flexGap}>
          <Skeleton width={190} height={22} radius={11} />
          <Skeleton width="80%" height={22} />
          <Skeleton width="60%" height={14} />
        </View>
        <Skeleton width={80} height={80} radius={40} />
      </View>
      <Skeleton height={104} radius={18} />
      <View style={styles.actions}>
        <Skeleton height={44} radius={22} style={styles.flex} />
        <Skeleton height={44} radius={22} style={styles.flex} />
      </View>
    </View>
  );
}

function PackCard({
  pack,
  now,
  onReschedule,
  onOtp,
  onCall,
}: {
  pack: Subscription;
  now: number;
  onReschedule: () => void;
  onOtp: () => void;
  onCall: () => void;
}) {
  const accent = packAccentLine(pack);
  const otp = pack.nextWalk?.bookingId ? pack.nextWalk.pickupOtp : null;
  return (
    <View style={styles.packCard}>
      <View style={styles.packHead}>
        <View style={styles.flexGap}>
          <View style={styles.packBadge}>
            <Text style={styles.packBadgeText}>📅 MONTHLY SOCIETY SUBSCRIPTION</Text>
          </View>
          <Text style={styles.packTitle}>Daily {pack.slotLabel} Slot</Text>
          <Text style={styles.packSub}>{nextWalkLine(pack.nextWalk, now)}</Text>
        </View>
        <ProgressRing done={pack.walksBooked} total={pack.walksTotal} />
      </View>
      {accent ? <Text style={styles.packAccent}>{accent}</Text> : null}

      <View style={styles.walkerBox}>
        <WalkerRow walker={pack.walker} societyId={pack.society?.societyId} onCall={onCall} />
        <BackupStrip backup={pack.backup} walkerName={pack.walker?.name ?? null} slotLabel={pack.slotLabel} />
      </View>

      <View style={styles.actions}>
        {pack.status === 'active' ? (
          <Pressable
            onPress={onReschedule}
            accessibilityRole="button"
            style={({ pressed }) => [styles.softPill, pressed && styles.pressed]}
          >
            <Text style={styles.softPillText}>📅 Reschedule / Skip</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onOtp}
          accessibilityRole="button"
          aria-label={otp ? 'View walk OTP' : 'Walk OTP not ready yet'}
          style={({ pressed }) => [styles.otpPill, !otp && styles.otpPillWaiting, pressed && styles.pressed]}
        >
          <Text style={[styles.otpPillText, !otp && styles.otpPillTextWaiting]}>
            {otp ? `🔑 View OTP (${otp})` : '🔑 OTP the evening before'}
          </Text>
          {otp ? <Icon name="arrow-forward" size={15} color={colors.onPrimary} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

function ExpressCard({
  pricing,
  pricingFailed,
  retryingPricing,
  onRetryPricing,
  nearby,
  nearbyLoading,
  context,
  minutes,
  compact,
  onMinutes,
  onBook,
}: {
  pricing: Pricing | undefined;
  pricingFailed: boolean;
  retryingPricing: boolean;
  onRetryPricing: () => void;
  nearby: NearbyWalkers | undefined;
  nearbyLoading: boolean;
  context: HomeContext;
  minutes: ExpressMinutes;
  compact: boolean;
  onMinutes: (minutes: ExpressMinutes) => void;
  onBook: () => void;
}) {
  const choice = pricing ? expressChoice(pricing, minutes) : null;
  const arrival = arrivalLine(nearby);
  const radar = nearby ? radarLine(nearby, context) : null;
  return (
    <View style={styles.expressCard}>
      <View style={styles.expressTop}>
        <View style={styles.coralBadge}>
          <Text style={styles.coralBadgeText}>⚡ INSTANT / EXPRESS WALK</Text>
        </View>
        <View style={styles.priceCol}>
          {choice ? (
            <Text style={styles.price}>
              {formatMoney(choice.price)}
              <Text style={styles.priceUnit}> / {choice.minutes} Mins</Text>
            </Text>
          ) : pricingFailed ? null : (
            <Skeleton width={92} height={18} radius={9} />
          )}
          {arrival ? <Text style={styles.arrival}>{arrival}</Text> : null}
        </View>
      </View>

      <View style={styles.expressCopy}>
        <Text style={styles.expressTitle}>Need an unscheduled walk right now?</Text>
        <Text style={styles.expressSub}>Dispatch a verified walker already inside your society complex.</Text>
      </View>

      {radar ? (
        <View style={styles.radar}>
          <Text style={styles.radarText}>🏃 {radar.text}</Text>
          {radar.badge ? (
            <View style={styles.mintBadge}>
              <Text style={styles.mintBadgeText}>{radar.badge}</Text>
            </View>
          ) : null}
        </View>
      ) : nearbyLoading ? (
        <Skeleton height={44} radius={16} />
      ) : null}

      <View style={styles.durations}>
        <Text style={styles.overline}>SELECT DURATION</Text>
        {pricing ? (
          <View style={styles.chips} role="radiogroup">
            {pricing.express.map((option) => {
              const selected = option.minutes === choice?.minutes;
              return (
                <Pressable
                  key={option.minutes}
                  onPress={() => onMinutes(option.minutes)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${option.minutes} minutes, ${formatMoney(option.price)}`}
                  style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {compact
                      ? `${option.minutes} Mins\n${formatMoney(option.price)}`
                      : `${option.minutes} Mins (${formatMoney(option.price)})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : pricingFailed ? (
          <RetryRow message="Couldn’t load today’s prices." busy={retryingPricing} onRetry={onRetryPricing} />
        ) : (
          <View style={styles.chips}>
            <Skeleton height={40} style={styles.flex} />
            <Skeleton height={40} style={styles.flex} />
            <Skeleton height={40} style={styles.flex} />
          </View>
        )}
        {pricing?.peak ? (
          <Text style={styles.peakNote}>
            Peak-hour prices{pricing.peakWindows.length ? ` (${pricing.peakWindows.join(', ')})` : ''}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onBook}
        accessibilityRole="button"
        style={({ pressed }) => [styles.coralCta, pressed && styles.pressed]}
      >
        {/* Narrow phones drop "Now" so the price always shows. */}
        <Text style={[styles.coralCtaText, compact && styles.coralCtaTextCompact]} numberOfLines={1}>
          {`⚡ Book Instant Walk${compact ? '' : ' Now'}${choice ? ` (${formatMoney(choice.price)})` : ''}`}
        </Text>
        <Icon name="arrow-forward" size={18} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function ProofCard({ walk, now }: { walk: Booking; now: number }) {
  const proof = proofCard(walk, now);
  return (
    <View style={styles.proof}>
      <View style={styles.proofTop}>
        <View style={styles.routeBadge}>
          <Icon name="route" size={18} color="#E8590C" />
        </View>
        <View style={styles.flexGap2}>
          <Text style={styles.proofTitle}>{proof.title}</Text>
          <Text style={styles.proofSub}>{proof.subtitle}</Text>
        </View>
        {proof.time ? <Text style={styles.proofTime}>{proof.time}</Text> : null}
      </View>
      <View style={styles.proofPills}>
        <View style={[styles.proofPill, { backgroundColor: BLUE_WASH }]}>
          <Text style={[styles.proofPillText, { color: colors.primary }]}>{peeLabel(proof.pee)}</Text>
        </View>
        <View style={[styles.proofPill, { backgroundColor: '#FFF3E8' }]}>
          <Text style={[styles.proofPillText, { color: '#8A4B0F' }]}>{poopLabel(proof.poop)}</Text>
        </View>
        {proof.photo ? (
          <View style={[styles.proofPill, { backgroundColor: '#E8F8F0' }]}>
            <Text style={[styles.proofPillText, { color: colors.successInk }]}>📷 Live Photo Verified ✓</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexGap: {
    flex: 1,
    gap: 6,
  },
  flexGap2: {
    flex: 1,
    gap: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 16,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
  },
  topCopy: {
    flex: 1,
    gap: 3,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  placeText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: INK,
  },
  placeLink: {
    color: colors.primary,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    boxShadow: '0px 0px 0px 3px rgba(16, 185, 129, 0.2)',
  },
  activeDotIdle: {
    backgroundColor: colors.placeholder,
    boxShadow: 'none',
  },
  activeText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: '#047857',
  },
  activeTextIdle: {
    color: SLATE,
  },
  dogChip: {
    maxWidth: 110,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(41, 98, 255, 0.1)',
  },
  dogChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_WASH,
    borderWidth: 1,
    borderColor: 'rgba(41, 98, 255, 0.2)',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.primary,
  },

  // Zone 1
  glass: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    backgroundImage: gradients.glassHeader,
    backgroundColor: 'rgba(255, 236, 214, 0.8)',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  insurancePill: {
    flexShrink: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  insurancePillActive: {
    backgroundColor: '#E8F8F0',
    borderColor: '#6EE7B7',
  },
  insuranceText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
    color: '#047857',
  },
  weatherPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  weatherText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: '#78350F',
  },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greetCopy: {
    flex: 1,
    gap: 6,
  },
  greetTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: INK,
  },
  greetTitleCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  greetSub: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: SLATE,
  },
  stage: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  petMe: {
    marginTop: -10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    boxShadow: '0px 3px 8px rgba(41, 98, 255, 0.3)',
  },
  petMeText: {
    fontFamily: fonts.extrabold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: colors.onPrimary,
  },

  // Zone 2
  packCard: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundImage: gradients.subscriptionCard,
    backgroundColor: colors.card,
    boxShadow: '0px 14px 32px rgba(41, 98, 255, 0.08)',
  },
  skeletonCard: {
    borderColor: 'rgba(41, 98, 255, 0.25)',
  },
  packHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  packBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: BLUE_WASH,
  },
  packBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  packTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: INK,
  },
  packSub: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: SLATE,
  },
  packAccent: {
    marginTop: -4,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  walkerBox: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BLUE_WASH,
    backgroundColor: colors.card,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  softPill: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: BLUE_WASH,
  },
  softPillText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.primary,
  },
  otpPill: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundImage: gradients.primaryPill,
    backgroundColor: colors.primary,
    boxShadow: '0px 8px 20px rgba(41, 98, 255, 0.28)',
  },
  otpPillWaiting: {
    backgroundImage: 'none',
    backgroundColor: '#F1F4FA',
    boxShadow: 'none',
  },
  otpPillText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.onPrimary,
  },
  otpPillTextWaiting: {
    color: SLATE,
  },

  // Zone 3
  expressCard: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: CORAL,
    backgroundImage: gradients.expressCard,
    backgroundColor: colors.card,
    boxShadow: '0px 14px 32px rgba(255, 107, 74, 0.09)',
  },
  expressTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  coralBadge: {
    flexShrink: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundImage: gradients.coralBadge,
    backgroundColor: CORAL,
  },
  coralBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: colors.onPrimary,
  },
  priceCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  price: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 22,
    color: INK,
  },
  priceUnit: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: SLATE,
  },
  arrival: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: CORAL,
  },
  expressCopy: {
    gap: 4,
  },
  expressTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    color: INK,
  },
  expressSub: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: SLATE,
  },
  radar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    backgroundImage: gradients.peachStrip,
    backgroundColor: '#FFF3E8',
  },
  radarText: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: INK,
  },
  mintBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(209, 250, 229, 0.85)',
  },
  mintBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#047857',
  },
  durations: {
    gap: 8,
  },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: SLATE,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: CORAL,
    backgroundImage: gradients.peachChip,
    backgroundColor: '#FFF3E8',
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: '#3F3F46',
  },
  chipTextSelected: {
    fontFamily: fonts.bold,
    color: CORAL,
  },
  peakNote: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.coralInk,
  },
  coralCta: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundImage: gradients.coralPill,
    backgroundColor: CORAL,
    boxShadow: '0px 8px 22px rgba(255, 107, 74, 0.32)',
  },
  coralCtaTextCompact: {
    fontSize: 14.5,
  },
  coralCtaText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.onPrimary,
  },

  // Zone 4
  proof: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundImage: gradients.proofCard,
    backgroundColor: colors.card,
    boxShadow: '0px 8px 20px rgba(24, 26, 32, 0.05)',
  },
  proofTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEDD5',
  },
  proofTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  proofSub: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: SLATE,
  },
  proofTime: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.placeholder,
  },
  // Centred, so pills that wrap on a narrow phone still sit as a tidy group.
  proofPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  proofPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  proofPillText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
});
