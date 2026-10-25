import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { errorMessage } from '../api/errors';
import { queryKeys, useBookingList, useCancelPack, usePricing, useSubscriptionList } from '../api/queries';
import { useRefetchOnFocus } from '../api/useRefetchOnFocus';
import type { Booking, Subscription } from '../api/types';
import { ActionSheet } from '../components/ActionSheet';
import { BOTTOM_NAV_HEIGHT, bottomNavClearance } from '../components/BottomNavigation';
import { Icon } from '../components/Icon';
import { PawsomeGradientScreen } from '../components/PawsomeGradientScreen';
import { Toast, useToast } from '../components/Toast';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings } from '../booking/BookingsProvider';
import { currentPack, nextWalkLine, packAccentLine, placeLine, upcomingPackWalks, upcomingRow } from '../booking/homeModel';
import {
  BackupStrip,
  CALL_SOON,
  ProgressRing,
  RescheduleSheet,
  RetryRow,
  SheetModal,
  Skeleton,
  StartPlanCard,
  WalkerRow,
} from '../booking/PackWidgets';
import { clearPlanIntent, planIntentParams, setPlanIntent } from '../booking/planIntent';
import { useNow } from '../booking/useNow';
import { colors, radii } from '../theme/colors';
import { gradients } from '../theme/gradients';
import { fonts } from '../theme/typography';

const INK = '#181A20';
const SLATE = '#757B8A';
const BLUE_WASH = '#E8F0FE';

/**
 * The Subscription tab: the active monthly pack (GET /subscriptions) with its
 * walker and backup, the pack's upcoming walks (GET /bookings), and skip /
 * change time / cancel. Without a pack, the "Start a monthly society plan" card.
 */
export function SubscriptionScreen() {
  const focused = useIsFocused();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const { go } = useAppNavigation();
  const { societyProfile } = useBookings();
  const { message, show } = useToast();
  const packsQuery = useSubscriptionList({ poll: focused });
  const bookingsQuery = useBookingList({ poll: focused });
  const pricingQuery = usePricing();
  const cancel = useCancelPack();
  const [sheet, setSheet] = useState<'reschedule' | 'cancel' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useRefetchOnFocus([queryKeys.subscriptions, queryKeys.bookings]);
  useFocusEffect(useCallback(() => clearPlanIntent(), []));

  const pack = packsQuery.data ? currentPack(packsQuery.data) : null;
  const upcoming = pack && bookingsQuery.data ? upcomingPackWalks(bookingsQuery.data, pack.id) : [];

  const startPlan = () => {
    const intent = { tier: 'subscription' as const };
    setPlanIntent(intent);
    if (societyProfile) go('planWalk', planIntentParams(intent));
    else go('bookWalk');
  };

  const refresh = () => {
    setRefreshing(true);
    Promise.all([packsQuery.refetch(), bookingsQuery.refetch(), pricingQuery.refetch()]).finally(() =>
      setRefreshing(false)
    );
  };

  const confirmCancel = (target: Subscription) => {
    setSheet(null);
    cancel.mutateAsync(target.id).then(
      () => show('Monthly plan cancelled. Walks already booked stay until you cancel them.'),
      (error: unknown) => show(errorMessage(error))
    );
  };

  return (
    <PawsomeGradientScreen variant="CROWN">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance(insets.bottom) + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>Your monthly society walk plan</Text>
        </View>

        {packsQuery.isPending ? (
          <View style={styles.card} aria-label="Loading your plan">
            <Skeleton width="70%" height={22} />
            <Skeleton width="45%" height={14} />
            <Skeleton height={96} radius={18} />
          </View>
        ) : packsQuery.isError && !packsQuery.data ? (
          <RetryRow
            message="Couldn’t load your monthly plan."
            busy={packsQuery.isFetching}
            onRetry={() => void packsQuery.refetch()}
          />
        ) : pack ? (
          <>
            <PackSummary pack={pack} now={now} />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your society walker</Text>
              <WalkerRow walker={pack.walker} societyId={pack.society?.societyId} onCall={() => show(CALL_SOON)} />
              <BackupStrip backup={pack.backup} walkerName={pack.walker?.name ?? null} slotLabel={pack.slotLabel} />
            </View>

            {pack.status === 'active' ? (
              <View style={styles.actionList}>
                <ActionRow
                  icon="event-repeat"
                  label="Reschedule / Skip"
                  detail="Skip a day or change your daily time"
                  onPress={() => setSheet('reschedule')}
                />
                <ActionRow
                  icon="cancel"
                  label="Cancel plan"
                  detail="Stops future walks"
                  tone="coral"
                  busy={cancel.isPending}
                  onPress={() => setSheet('cancel')}
                />
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Upcoming walks</Text>
              {bookingsQuery.isPending ? (
                <Skeleton height={52} />
              ) : bookingsQuery.isError && !bookingsQuery.data ? (
                <RetryRow
                  message="Couldn’t load your walks."
                  busy={bookingsQuery.isFetching}
                  onRetry={() => void bookingsQuery.refetch()}
                />
              ) : upcoming.length ? (
                upcoming.map((walk) => <UpcomingWalk key={walk.id} walk={walk} now={now} />)
              ) : (
                <Text style={styles.muted}>
                  {pack.nextWalk ? `${nextWalkLine(pack.nextWalk, now)}. It shows here once it’s booked, the evening before.` : 'No walks left in this pack.'}
                </Text>
              )}
              {pack.skipDates.length ? (
                <Text style={styles.muted}>Skipped: {pack.skipDates.join(', ')}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <StartPlanCard pricing={pricingQuery.data} onStart={startPlan} />
        )}
      </ScrollView>

      {sheet === 'reschedule' && pack ? (
        <RescheduleSheet pack={pack} now={now} onClose={() => setSheet(null)} onResult={show} />
      ) : null}
      {sheet === 'cancel' && pack ? (
        <SheetModal onClose={() => setSheet(null)}>
          <ActionSheet
            title="Cancel your monthly plan?"
            subtitle={`No new walks after this. ${
              pack.walksLeft !== null ? `${pack.walksLeft} unbooked walks stop. ` : ''
            }Walks already booked stay until you cancel them.`}
            options={[
              {
                icon: 'cancel',
                label: 'Yes, cancel my plan',
                tone: 'coral',
                onPress: () => confirmCancel(pack),
              },
            ]}
            cancelLabel="Keep my plan"
            onClose={() => setSheet(null)}
          />
        </SheetModal>
      ) : null}
      <Toast message={message} bottomOffset={BOTTOM_NAV_HEIGHT + 20} />
    </PawsomeGradientScreen>
  );
}

function PackSummary({ pack, now }: { pack: Subscription; now: number }) {
  const accent = packAccentLine(pack);
  const place = placeLine({
    dogName: pack.dog.name,
    temperament: pack.dog.temperament,
    pickup: null,
    society: pack.society,
    address: pack.pickup.address,
  });
  return (
    <View style={styles.packCard}>
      <View style={styles.packHead}>
        <View style={styles.flexGap}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pack.status === 'active' ? '📅 ACTIVE MONTHLY PLAN' : '📅 LAST WALKS OF YOUR PLAN'}
            </Text>
          </View>
          <Text style={styles.packTitle}>Daily {pack.slotLabel} Slot</Text>
          <Text style={styles.packSub}>{nextWalkLine(pack.nextWalk, now)}</Text>
          {accent ? <Text style={styles.accent}>{accent}</Text> : null}
        </View>
        <ProgressRing done={pack.walksBooked} total={pack.walksTotal} />
      </View>
      <View style={styles.facts}>
        {pack.walksDone !== null ? <Fact label="Walked" value={String(pack.walksDone)} /> : null}
        <Fact label="Booked" value={`${pack.walksBooked} of ${pack.walksTotal}`} />
        {pack.dog.name ? <Fact label="Dog" value={pack.dog.name} /> : null}
      </View>
      {place ? (
        <View style={styles.placeRow}>
          <Icon name="location-on" size={15} color={colors.primary} />
          <Text style={styles.placeText}>{place}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  tone = 'primary',
  busy = false,
  onPress,
}: {
  icon: string;
  label: string;
  detail: string;
  tone?: 'primary' | 'coral';
  busy?: boolean;
  onPress: () => void;
}) {
  const coral = tone === 'coral';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed, busy && styles.busy]}
    >
      <View style={[styles.actionIcon, { backgroundColor: coral ? colors.coralTint : BLUE_WASH }]}>
        <Icon name={icon} size={20} color={coral ? colors.coral : colors.primary} />
      </View>
      <View style={styles.flexGap2}>
        <Text style={[styles.actionLabel, coral && { color: colors.coralInk }]}>{busy ? 'Working…' : label}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.placeholder} />
    </Pressable>
  );
}

function UpcomingWalk({ walk, now }: { walk: Booking; now: number }) {
  const row = upcomingRow(walk, now);
  const showOtp = walk.status !== 'active' && walk.pickupOtp;
  return (
    <View style={styles.walkRow}>
      <View style={styles.walkIcon}>
        <Icon name="directions-walk" size={18} color={colors.primary} />
      </View>
      <View style={styles.flexGap2}>
        <Text style={styles.walkWhen}>{row.when}</Text>
        <Text style={styles.muted}>
          {row.status}
          {walk.walker?.name ? ` • ${walk.walker.name}` : ''}
        </Text>
      </View>
      {showOtp ? (
        <View style={styles.otpChip}>
          <Text style={styles.otpChipText}>OTP {walk.pickupOtp}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  flexGap: {
    flex: 1,
    gap: 6,
  },
  flexGap2: {
    flex: 1,
    gap: 2,
  },
  header: {
    gap: 2,
    paddingVertical: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: INK,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: SLATE,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.card,
    boxShadow: '0px 12px 32px rgba(24, 26, 32, 0.06)',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: INK,
  },
  muted: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: SLATE,
  },
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
  packHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: BLUE_WASH,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
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
    color: SLATE,
  },
  accent: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  facts: {
    flexDirection: 'row',
    gap: 8,
  },
  fact: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: BLUE_WASH,
  },
  factValue: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    color: INK,
  },
  factLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: SLATE,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placeText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: INK,
  },
  actionList: {
    borderRadius: 24,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 4,
    boxShadow: '0px 12px 32px rgba(24, 26, 32, 0.06)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: INK,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_WASH,
  },
  walkWhen: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: INK,
  },
  otpChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundImage: gradients.otpFilled,
    backgroundColor: BLUE_WASH,
  },
  otpChipText: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  busy: {
    opacity: 0.6,
  },
});
