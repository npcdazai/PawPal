import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { errorMessage } from '../api/errors';
import { useBookingList, useCreateBooking, useNearbyWalkers, usePricing } from '../api/queries';
import type { Booking as ApiBooking, ExpressMinutes, Pricing } from '../api/types';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { useResponsive } from '../theme/responsive';
import { gradients } from '../theme/gradients';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/Button';
import { PawsomeGradientScreen } from '../components/PawsomeGradientScreen';
import { Toast, useToast } from '../components/Toast';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, usePastWalks, type SocietyProfile } from '../booking/BookingsProvider';
import { amountDue, bookingRequest, needsPayment } from '../booking/bookingRequest';
import { dogForBooking } from '../booking/dogProfile';
import { arrivalLine, expressChoice } from '../booking/homeModel';
import { clearPlanIntent, peekPlanIntent, planIntentFromParams } from '../booking/planIntent';
import {
  SOCIETIES,
  stackedSchedule,
  suggestedSlot,
  towerLobby,
  walkerOrigin,
  type Society,
} from '../booking/societies';
import {
  BATCHES,
  EXPRESS_ETA,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_PER_WALK,
  SUBSCRIPTION_WALKS,
  TIER_MINUTES,
  TIER_TITLES,
  TRIAL_PRICE,
  clockLabel,
  formatMoney,
  minuteOfDay,
  slotRange,
  type Batch,
  type WalkMinutes,
  type WalkTier,
} from '../booking/walkPlans';
import { WALKERS, isWalkerId, type WalkerId } from '../data/careTeam';
import { UpiPaymentSheet } from '../payments/UpiPaymentSheet';
import type { UpiReceipt } from '../payments/useUpiPayment';

const FOOTER_HEIGHT = 136;
/** The walker finishing the slot before Barnaby's is a lobby away. */
const STACKED_ETA_MIN = 4;

/** Screen 6 — BOOK_WALKER_CONFIG: plan tier, 30-minute stacked slot, then UPI. */
export function WalkPlanScreen() {
  const { societyProfile } = useBookings();
  const { go } = useAppNavigation();
  if (!societyProfile) {
    return (
      <PawsomeGradientScreen variant="CROWN" edges={['top', 'bottom']} style={styles.empty}>
        <Text style={styles.cardTitle}>Set up Barnaby’s society profile first</Text>
        <Text style={[styles.meta, styles.centerText]}>
          Plans and slots depend on your township and Barnaby’s handling needs.
        </Text>
        <PrimaryButton label="Society & Behavioral Profile" onPress={() => go('backToSociety')} style={styles.stretch} />
      </PawsomeGradientScreen>
    );
  }
  return <WalkPlan profile={societyProfile} />;
}

/** Express lengths the plan screen offers before /pricing answers (prices then come from it). */
const EXPRESS_LENGTHS: readonly ExpressMinutes[] = [30, 45, 60];

/** The payment sheet's line for a server-priced booking. */
function fareLines(booking: ApiBooking, pricing: Pricing | undefined) {
  const amount = amountDue(booking);
  switch (booking.tier) {
    case 'subscription': {
      const walks = pricing?.subscription.walks ?? SUBSCRIPTION_WALKS;
      return [{ label: `${walks} society walks × ${formatMoney(booking.price)}`, amount }];
    }
    case 'trial':
      return [{ label: `${booking.minutes}-min Meet & Greet co-walk`, amount }];
    case 'express':
      return [{ label: `Express walk (${booking.minutes} min)${pricing?.peak ? ' · peak hours' : ''}`, amount }];
  }
}

const walkMinutes = (minutes: number, tier: WalkTier): WalkMinutes =>
  minutes === 15 || minutes === 30 || minutes === 45 || minutes === 60 ? minutes : TIER_MINUTES[tier];

function WalkPlan({ profile }: { profile: SocietyProfile }) {
  const insets = useSafeAreaInsets();
  const { compact } = useResponsive();
  const { go } = useAppNavigation();
  const { glance, barkWith } = useMascotActions();
  const { addBooking } = useBookings();
  const pastWalks = usePastWalks();
  const params = useLocalSearchParams<{ walker?: string; tier?: string; minutes?: string }>();
  const { message, show } = useToast();
  const pricingQuery = usePricing();
  const pricing = pricingQuery.data;
  const { data: serverBookings } = useBookingList();
  const create = useCreateBooking();

  const society = SOCIETIES[profile.society];
  const reactive = profile.temperament === 'reactive';
  const firstTime = pastWalks.length === 0;
  const trialRecommended = reactive || firstTime;
  // Walkers Barnaby has already walked with in this society: the repeat-walker rule.
  const pastWalkers = [
    ...new Set(pastWalks.filter((walk) => walk.society === society.key).map((walk) => walk.walkerId)),
  ];
  const [lobbyLng, lobbyLat] = towerLobby(society, profile.tower);
  const nearby = useNearbyWalkers({ lat: lobbyLat, lng: lobbyLng }, profile.temperament).data;

  // A home-screen card can pick the plan: from the route, or held through the society screen.
  const [intent] = useState(() => planIntentFromParams(params) ?? peekPlanIntent());
  useEffect(() => clearPlanIntent(), []);

  const [tier, setTier] = useState<WalkTier>(() => intent?.tier ?? (reactive ? 'trial' : 'subscription'));
  const [minutes, setMinutes] = useState<ExpressMinutes>(() => intent?.minutes ?? 30);
  const [batch, setBatch] = useState<Batch>(() => (minuteOfDay() >= BATCHES.morning.to ? 'evening' : 'morning'));
  const [slotStart, setSlotStart] = useState<number | null>(() => suggestedSlot(society, batch));
  const [repeatWalker, setRepeatWalker] = useState<WalkerId | null>(() =>
    isWalkerId(params.walker) && pastWalkers.includes(params.walker) ? params.walker : null
  );
  /** The server booking waiting for its payment. */
  const [paying, setPaying] = useState<ApiBooking | null>(null);

  // Safety Lock: no first-time Express for a reactive dog without a walker he knows.
  const safetyLock = tier === 'express' && reactive && pastWalks.length === 0 && !repeatWalker;
  const schedule = stackedSchedule(society, batch);
  // Prices shown before checkout: the server's /pricing (the plan constants only until it answers).
  const perWalk = pricing?.subscription.perWalk ?? SUBSCRIPTION_PER_WALK;
  const monthly = pricing?.subscription.total ?? SUBSCRIPTION_MONTHLY;
  const packWalks = pricing?.subscription.walks ?? SUBSCRIPTION_WALKS;
  const trialPrice = pricing?.trial.price ?? TRIAL_PRICE;
  const express = pricing ? expressChoice(pricing, minutes) : null;
  const arrival = arrivalLine(nearby);

  const primary: WalkerId = repeatWalker ?? society.primaryWalker;
  const backup: WalkerId = primary === society.backupWalker ? society.primaryWalker : society.backupWalker;

  const chooseTier = (next: WalkTier) => {
    if (next === tier) return;
    setTier(next);
    glance();
  };

  const chooseMinutes = (next: ExpressMinutes) => {
    if (next === minutes) return;
    setMinutes(next);
    glance();
  };

  const chooseBatch = (next: Batch) => {
    if (next === batch) return;
    setBatch(next);
    setSlotStart(suggestedSlot(society, next));
    glance();
  };

  const chooseSlot = (start: number) => {
    setSlotStart(start);
    glance();
  };

  /** Booked (and paid, when the server asks for it): carry on to the walker. */
  const finish = (booking: ApiBooking, receipt: UpiReceipt | null) => {
    const isExpress = booking.tier === 'express';
    const start = isExpress ? minuteOfDay(new Date(booking.scheduledFor)) : (slotStart ?? 0);
    const origin = walkerOrigin(society, isExpress ? null : batch, start);
    const etaMinutes = isExpress ? (nearby?.arrival?.minMinutes ?? EXPRESS_ETA.min) : STACKED_ETA_MIN;
    addBooking({
      bookingId: booking.id,
      status: 'enRoute',
      tier: booking.tier,
      minutes: walkMinutes(booking.minutes, booking.tier),
      total: amountDue(booking),
      payment: receipt,
      society: society.key,
      tower: profile.tower,
      flat: profile.flat,
      pickup: towerLobby(society, profile.tower),
      walkerFrom: origin.at,
      walkerFromTower: origin.tower,
      batch: isExpress ? null : batch,
      slotStart: start,
      slotLabel: isExpress
        ? `Express ${booking.minutes}-min walk${arrival ? ` • ${arrival.toLowerCase()}` : ''}`
        : `${slotRange(start, booking.minutes)} • ${booking.tier === 'trial' ? 'Meet & Greet' : 'Daily'}`,
      whenLabel: `Arriving in ${etaMinutes} mins`,
      walkerId: primary,
      backupWalkerId: backup,
      // The server's doorstep code for this walk.
      otp: booking.pickupOtp,
      etaMinutes,
    });
    setPaying(null);
    barkWith('Woof! Slot locked 🐾');
    go('trackWalker', { id: booking.id });
  };

  const confirm = () => {
    if (create.isPending) return;
    if (safetyLock) {
      glance();
      show(`⚠️ Safety Lock: switch to the ${formatMoney(trialPrice)} Trial or pick a walker Barnaby knows`);
      return;
    }
    if (tier !== 'express' && slotStart === null) {
      show('Pick a 30-minute slot first');
      return;
    }
    const latest = serverBookings?.reduce<ApiBooking | null>(
      (newest, booking) => (!newest || booking.createdAt > newest.createdAt ? booking : newest),
      null
    );
    // The server prices the walk; it answers `awaiting_payment` when it wants paying first.
    create.mutate(bookingRequest({ profile, dog: dogForBooking(latest?.dog), tier, minutes, slotStart }), {
      onSuccess: (booking) => (needsPayment(booking) ? setPaying(booking) : finish(booking, null)),
      onError: (error) => show(errorMessage(error)),
    });
  };

  const summary =
    tier === 'express'
      ? `Express ${minutes} min${express ? ` • ${formatMoney(express.price)}` : ''}${
          arrival ? ` • ${arrival.toLowerCase()}` : ''
        } • ${society.shortName}`
      : slotStart !== null
        ? `${clockLabel(slotStart)} ${tier === 'trial' ? 'Meet & Greet' : 'Daily Batch'} • ${
            tier === 'trial' ? formatMoney(trialPrice) : `${formatMoney(perWalk)}/walk`
          } • ${society.shortName}`
        : `Pick a slot • ${society.shortName}`;

  return (
    <PawsomeGradientScreen variant="CROWN">
      <View style={[styles.topBar, compact && styles.topBarCompact]}>
        <Pressable
          onPress={() => go('backToSociety')}
          accessibilityRole="button"
          aria-label="Back"
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        {/* Narrow phones wrap the title onto a second line rather than cut it off. */}
        <Text style={[styles.topTitle, compact && styles.topTitleCompact]} numberOfLines={compact ? 2 : 1}>
          Slot Stacking & Subscription
        </Text>
        <View style={styles.headerAvatar}>
          <Image source={require('../../assets/corgi_mascot.png')} style={styles.headerAvatarImage} contentFit="cover" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: FOOTER_HEIGHT + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>⚡ ZERO TRAVEL DELAY • DEDICATED SOCIETY BATCH</Text>
          </View>
          <View style={styles.heroRow}>
            <View style={styles.flex}>
              <Text style={styles.heroTitle}>Stack Your Society Walk Slot</Text>
              <Text style={styles.meta}>
                Back-to-back walks inside {society.shortName} mean guaranteed zero commute delays.
              </Text>
            </View>
            <MascotDockSlot variant="dashboard-dock" style={styles.dock} />
          </View>
        </View>

        <View style={styles.spaceBetween}>
          <Text style={styles.overline}>CHOOSE WALK FREQUENCY</Text>
          <View style={styles.inlineRow}>
            <Icon name="verified" size={15} color={colors.primary} />
            <Text style={styles.linkText}>Verified Housing Batch</Text>
          </View>
        </View>

        <TierCard
          selected={tier === 'subscription'}
          onPress={() => chooseTier('subscription')}
          tags={[
            { label: '🔥 Most Popular', tone: 'coral' },
            { label: '✓ Guaranteed Backup Walker', tone: 'amber' },
          ]}
          title={TIER_TITLES.subscription}
          price={formatMoney(perWalk)}
          unit="/ walk"
          note={`(${formatMoney(monthly)}/mo • ${packWalks} Morning/Evening Walks)`}
          bullets={[
            { icon: 'schedule', text: 'Zero travel delay • fixed daily 30-min slot inside your township' },
            { icon: 'groups', text: 'Assigned society walker + automatic backup walker if they’re on leave' },
            { icon: 'health-and-safety', text: 'Vet & accident cover switches on at the doorstep OTP check' },
          ]}
        />
        <TierCard
          selected={tier === 'trial'}
          onPress={() => chooseTier('trial')}
          highlight={trialRecommended}
          tags={[
            { label: '🧪 Introductory Session', tone: 'slate' },
            ...(trialRecommended
              ? [{ label: reactive ? '⭐ Recommended for reactive dogs' : '⭐ Recommended first walk', tone: 'blue' as const }]
              : []),
          ]}
          title={TIER_TITLES.trial}
          price={formatMoney(trialPrice)}
          unit="(One-time)"
          description="15-min co-walk with you + your assigned society walker inside the complex gate, to build trust and check harness & temperament."
        />
        <TierCard
          selected={tier === 'express'}
          onPress={() => chooseTier('express')}
          tags={[
            { label: '⚡ Instant / Express', tone: 'red' },
            ...(pricing?.peak ? [{ label: 'Peak-hour price', tone: 'amber' as const }] : []),
          ]}
          title="Instant / Express Walk"
          price={express ? formatMoney(express.price) : '…'}
          priceTone="coral"
          unit={`/ ${minutes} min walk`}
          description="A verified walker already inside your society, for 30, 45 or 60 minutes. Only for Friendly/Low-Pull dogs or walkers Barnaby already knows."
        />

        {safetyLock ? (
          <View style={styles.lock} role="alert">
            <Text style={styles.lockTitle}>⚠️ Safety Lock</Text>
            <Text style={styles.lockText}>
              First-time Express walks are restricted to Friendly/Low-Pull dogs or dogs with a previous Repeat Walker.
              Switch to ₹99 Trial Walk or select a past walker.
            </Text>
            <Pressable
              onPress={() => chooseTier('trial')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.lockButton, pressed && styles.pressed]}
            >
              <Text style={styles.lockButtonText}>Switch to {formatMoney(trialPrice)} Trial Walk</Text>
            </Pressable>
            {pastWalkers.length ? (
              <View style={styles.walkerChips}>
                {pastWalkers.map((id) => (
                  <WalkerChip key={id} id={id} selected={repeatWalker === id} onPress={() => setRepeatWalker(id)} />
                ))}
              </View>
            ) : (
              <Text style={styles.meta}>No past walkers yet — your Trial walker becomes Barnaby’s repeat walker.</Text>
            )}
          </View>
        ) : null}

        {tier === 'express' && !safetyLock ? (
          <View style={styles.express}>
            <View style={styles.expressHead}>
              <Icon name="bolt" size={22} color={colors.coral} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{arrival ?? 'Arrival confirmed when a walker accepts'}</Text>
                <Text style={styles.meta}>
                  Squeezed between {society.shortName}’s stacked slots by a walker already inside the complex.
                  {repeatWalker ? ` Repeat walker: ${WALKERS[repeatWalker].name}.` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.overline}>SELECT DURATION</Text>
            <View style={styles.durationRow} role="radiogroup">
              {(pricing?.express ?? EXPRESS_LENGTHS.map((length) => ({ minutes: length, price: null }))).map((option) => {
                const selected = option.minutes === (express?.minutes ?? minutes);
                return (
                  <Pressable
                    key={option.minutes}
                    onPress={() => chooseMinutes(option.minutes)}
                    role="radio"
                    aria-checked={selected}
                    style={({ pressed }) => [styles.duration, selected && styles.durationSelected, pressed && styles.pressed]}
                  >
                    <Text style={[styles.durationText, selected && styles.durationTextSelected]}>
                      {option.minutes} Mins
                    </Text>
                    <Text style={[styles.durationPrice, selected && styles.durationTextSelected]}>
                      {option.price !== null ? formatMoney(option.price) : '…'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {pricingQuery.isError && !pricing ? (
              <Pressable onPress={() => void pricingQuery.refetch()} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.retryText}>Couldn’t load today’s prices. Tap to retry.</Text>
              </Pressable>
            ) : pricing?.peak ? (
              <Text style={styles.meta}>
                Peak-hour prices{pricing.peakWindows.length ? ` (${pricing.peakWindows.join(', ')})` : ''}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {tier !== 'express' ? (
          <SlotPicker
            society={society}
            batch={batch}
            schedule={schedule}
            slotStart={slotStart}
            trial={tier === 'trial'}
            onBatch={chooseBatch}
            onSlot={chooseSlot}
          />
        ) : null}

        <View style={styles.security}>
          <Icon name="verified-user" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.subhead}>Estate Security Pass Cleared</Text>
            <Text style={styles.meta}>
              Walkers carry {society.gateApp} passes registered at the tower main gate.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryDot} />
          <Text style={styles.summaryText} numberOfLines={2}>
            Selected: {summary}
          </Text>
        </View>
        <PrimaryButton
          label={create.isPending ? 'Booking…' : 'Confirm Slot & View Walker'}
          onPress={confirm}
          disabled={create.isPending}
          style={safetyLock ? styles.ctaLocked : undefined}
        />
      </View>

      <Toast message={message} bottomOffset={FOOTER_HEIGHT + 8} />

      {paying ? (
        <UpiPaymentSheet
          title={
            paying.tier === 'subscription'
              ? `Subscribe: ${society.shortName} walks`
              : `Pay for Barnaby’s ${paying.minutes}-min walk`
          }
          lines={fareLines(paying, pricing)}
          total={amountDue(paying)}
          description={`PawPal ${TIER_TITLES[paying.tier]} • ${society.shortName}`}
          metadata={{
            bookingId: paying.id,
            tier: paying.tier,
            minutes: String(paying.minutes),
            society: society.key,
            tower: profile.tower,
            flat: profile.flat,
            slot: paying.tier === 'express' ? 'express' : String(slotStart),
          }}
          onPaid={(receipt) => finish(paying, receipt)}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </PawsomeGradientScreen>
  );
}

type TagTone = 'coral' | 'amber' | 'blue' | 'slate' | 'red';

const TAG_COLORS: Record<TagTone, { bg: string; fg: string }> = {
  coral: { bg: colors.coral, fg: colors.onPrimary },
  amber: { bg: colors.amberTint, fg: colors.amberInk },
  blue: { bg: colors.primaryTint, fg: colors.primary },
  slate: { bg: colors.track, fg: colors.ink },
  red: { bg: '#C8432A', fg: colors.onPrimary },
};

function TierCard({
  selected,
  onPress,
  highlight = false,
  tags,
  title,
  price,
  priceTone = 'ink',
  unit,
  note,
  bullets,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  highlight?: boolean;
  tags: readonly { label: string; tone: TagTone }[];
  title: string;
  price: string;
  priceTone?: 'ink' | 'coral';
  unit: string;
  note?: string;
  bullets?: readonly { icon: string; text: string }[];
  description?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={selected}
      aria-label={`${title}, ${price} ${unit}`}
      style={({ pressed }) => [
        styles.tier,
        highlight && styles.tierHighlight,
        selected && styles.tierSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.tierTop}>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag.label} style={[styles.tag, { backgroundColor: TAG_COLORS[tag.tone].bg }]}>
              <Text style={[styles.tagText, { color: TAG_COLORS[tag.tone].fg }]}>{tag.label}</Text>
            </View>
          ))}
        </View>
        <Icon
          name={selected ? 'check-circle' : 'radio-button-unchecked'}
          size={26}
          color={selected ? colors.primary : colors.placeholder}
        />
      </View>
      <Text style={styles.tierTitle}>{title}</Text>
      <Text style={[styles.tierPrice, priceTone === 'coral' && { color: colors.coralInk }]}>
        {price} <Text style={styles.tierUnit}>{unit}</Text>
      </Text>
      {note ? <Text style={styles.tierNote}>{note}</Text> : null}
      {description ? <Text style={styles.tierDescription}>{description}</Text> : null}
      {bullets ? (
        <View style={styles.bullets}>
          {bullets.map((bullet) => (
            <View key={bullet.text} style={styles.bullet}>
              <Icon name={bullet.icon} size={17} color={colors.primary} />
              <Text style={styles.bulletText}>{bullet.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function SlotPicker({
  society,
  batch,
  schedule,
  slotStart,
  trial,
  onBatch,
  onSlot,
}: {
  society: Society;
  batch: Batch;
  schedule: ReturnType<typeof stackedSchedule>;
  slotStart: number | null;
  trial: boolean;
  onBatch: (batch: Batch) => void;
  onSlot: (start: number) => void;
}) {
  // Narrow phones: batch names sit above their times, and a slot's tag drops below its time when both don't fit.
  const { compact } = useResponsive();
  return (
    <View style={styles.slots}>
      <View style={styles.inlineRow}>
        <Icon name="place" size={15} color={colors.primary} />
        <Text style={styles.sequence}>
          TOWER {society.towers.slice(0, 3).join(', ')} ROUTE SEQUENCE
        </Text>
      </View>
      <Text style={styles.cardTitle}>Select 30-Min Walking Slot ({BATCHES[batch].label})</Text>
      <Text style={styles.meta}>
        Consecutive slots minimise wait times and eliminate walker delays.
        {trial ? ' Your 15-min co-walk starts at the slot time.' : ''}
      </Text>

      <View style={styles.segment} role="tablist">
        {(['morning', 'evening'] as const).map((option) => {
          const active = option === batch;
          return (
            <Pressable
              key={option}
              onPress={() => onBatch(option)}
              role="tab"
              aria-selected={active}
              style={[styles.segmentItem, active && styles.segmentActive]}
            >
              <Icon name={BATCHES[option].icon} size={16} color={active ? colors.onPrimary : colors.slate} />
              <Text
                style={[styles.segmentText, compact && styles.segmentTextCompact, active && styles.segmentTextActive]}
                numberOfLines={compact ? 2 : 1}
              >
                {option === 'morning' ? 'Morning' : 'Evening'}
                {compact ? '\n' : ' · '}
                {BATCHES[option].short}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.slotList} role="radiogroup">
        {schedule.map(({ startMin, state }) => {
          const time = slotRange(startMin);
          if (state.kind === 'booked') {
            return (
              <View
                key={startMin}
                style={[styles.slot, compact && styles.slotCompact, styles.slotBooked]}
                aria-label={`${time} booked`}
              >
                <Icon name="lock" size={17} color={colors.placeholder} />
                <Text style={[styles.slotTime, compact && styles.slotTimeCompact, styles.slotTimeBooked]}>{time}</Text>
                <View style={[styles.bookedTag, compact && styles.slotTagCompact]}>
                  <Text style={styles.bookedTagText} numberOfLines={1}>
                    Booked — Tower {state.walk.tower}, {state.walk.breed}
                  </Text>
                </View>
              </View>
            );
          }
          const selected = slotStart === startMin;
          return (
            <Pressable
              key={startMin}
              onPress={() => onSlot(startMin)}
              role="radio"
              aria-checked={selected}
              aria-label={`${time} available`}
              style={({ pressed }) => [
                styles.slot,
                compact && styles.slotCompact,
                selected && styles.slotSelected,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="schedule" size={17} color={selected ? colors.onPrimary : colors.slate} />
              <Text style={[styles.slotTime, compact && styles.slotTimeCompact, selected && styles.onPrimary]}>{time}</Text>
              <View
                style={[
                  styles.openTag,
                  compact && styles.slotTagCompact,
                  selected && styles.openTagSelected,
                  state.after && !selected && styles.stackTag,
                ]}
              >
                <Text
                  style={[styles.openTagText, selected && styles.primaryText, state.after && !selected && styles.stackTagText]}
                  numberOfLines={1}
                >
                  {selected
                    ? '✓ Selected'
                    : state.after
                      ? `0 min travel from Tower ${state.after.tower}`
                      : 'Available'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WalkerChip({ id, selected, onPress }: { id: WalkerId; selected: boolean; onPress: () => void }) {
  const walker = WALKERS[id];
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={selected}
      style={[styles.walkerChip, selected && styles.walkerChipSelected]}
    >
      <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={28} />
      <Text style={[styles.walkerChipText, selected && styles.primaryText]}>{walker.shortName}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  stretch: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  centerText: {
    textAlign: 'center',
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
    gap: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarCompact: {
    gap: 8,
  },
  topTitle: {
    ...typography.headline,
    flexShrink: 1,
  },
  topTitleCompact: {
    textAlign: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stage,
    borderWidth: 2,
    borderColor: colors.card,
    ...shadows.soft,
  },
  headerAvatarImage: {
    width: 50,
    height: 50,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  hero: {
    gap: 12,
    padding: 18,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
  },
  heroPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  heroPillText: {
    fontFamily: fonts.extrabold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.coralInk,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    ...typography.title,
    fontSize: 22,
    marginBottom: 4,
  },
  dock: {
    borderRadius: 38,
    ...shadows.card,
  },
  overline: {
    ...typography.overline,
    color: colors.ink,
  },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.primary,
  },
  meta: {
    ...typography.bodySm,
    fontSize: 12.5,
    lineHeight: 18,
  },
  cardTitle: {
    ...typography.headline,
    fontSize: 17,
  },
  subhead: {
    ...typography.subhead,
  },
  tier: {
    gap: 6,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  tierHighlight: {
    borderColor: 'rgba(41, 98, 255, 0.35)',
    borderStyle: 'dashed',
  },
  tierSelected: {
    borderStyle: 'solid',
    borderColor: colors.primary,
    backgroundColor: '#F5F8FF',
  },
  tierTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  tags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  tagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  tierTitle: {
    ...typography.headline,
    fontSize: 18,
    marginTop: 2,
  },
  tierPrice: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
  },
  tierUnit: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.slate,
  },
  tierNote: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.primary,
  },
  tierDescription: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  bullets: {
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  lock: {
    gap: 10,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.coral,
    backgroundColor: colors.coralTint,
  },
  lockTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    color: colors.coralInk,
  },
  lockText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  lockButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  lockButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onPrimary,
  },
  walkerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walkerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
  },
  walkerChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  walkerChipText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
  express: {
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 74, 0.35)',
    backgroundImage: gradients.expressCard,
    backgroundColor: colors.coralTint,
  },
  expressHead: {
    flexDirection: 'row',
    gap: 12,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  duration: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: colors.card,
  },
  durationSelected: {
    borderWidth: 1.5,
    borderColor: colors.coral,
    backgroundImage: gradients.peachChip,
  },
  durationText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: '#3F3F46',
  },
  durationPrice: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  durationTextSelected: {
    fontFamily: fonts.bold,
    color: colors.coral,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.coralInk,
  },
  slots: {
    gap: 10,
    marginTop: 4,
  },
  sequence: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.slate,
  },
  segmentTextCompact: {
    flexShrink: 1,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.onPrimary,
  },
  slotList: {
    gap: 8,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  slotCompact: {
    flexWrap: 'wrap',
    rowGap: 6,
    paddingVertical: 10,
  },
  // The time keeps one line; the tag sits at the row's end, or wraps below when there is no room.
  slotTimeCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  slotTagCompact: {
    maxWidth: '100%',
    marginLeft: 'auto',
  },
  slotBooked: {
    backgroundColor: '#F2F3F6',
    boxShadow: 'none',
  },
  slotSelected: {
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  slotTime: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  slotTimeBooked: {
    color: colors.placeholder,
    textDecorationLine: 'line-through',
  },
  bookedTag: {
    maxWidth: '58%',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  bookedTagText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.slate,
  },
  openTag: {
    maxWidth: '62%',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  openTagSelected: {
    backgroundColor: colors.card,
  },
  stackTag: {
    backgroundColor: colors.successTint,
  },
  openTagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.slate,
  },
  stackTagText: {
    color: colors.successInk,
  },
  primaryText: {
    color: colors.primary,
  },
  onPrimary: {
    color: colors.onPrimary,
  },
  security: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: '#F4F6FB',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    boxShadow: '0px -10px 30px rgba(24, 26, 32, 0.08)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },
  summaryText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink,
  },
  ctaLocked: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
