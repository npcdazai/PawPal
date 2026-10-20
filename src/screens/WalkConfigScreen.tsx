import React, { useCallback, useState } from 'react';
import { Image, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { MascotAnchor, MascotScrollView } from '../mascot/MascotAnchor';
import { useMascotActions } from '../mascot/MascotProvider';
import { PHYSICS } from '../mascot/mascotModel';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings } from '../booking/BookingsProvider';
import {
  INSTANT_ETA_MINUTES,
  WALK_PLANS,
  formatMoney,
  scheduleSlots,
  wagFpsFor,
  walkFare,
  type WalkMinutes,
  type WalkTiming,
} from '../booking/walkPlans';
import { isWalkerId } from '../data/careTeam';

const MASCOT_SIZE = 150;
const FOOTER_HEIGHT = 196;

const INCLUSIONS = [
  { icon: 'pets', tint: colors.coralTint, ink: colors.coral, label: 'Leash & harness double-clip check' },
  { icon: 'water-drop', tint: colors.primaryTint, ink: colors.primary, label: 'Fresh water & paw wipedown after walk' },
  { icon: 'photo-camera', tint: colors.amberTint, ink: colors.amberInk, label: 'Live GPS route & 4+ photo updates' },
];

/** Screen 5 — walk timing, duration and live pricing. */
export function WalkConfigScreen() {
  const insets = useSafeAreaInsets();
  const { go } = useAppNavigation();
  const { glance, focusField, blurField, setWagFps } = useMascotActions();
  const { setDraft } = useBookings();
  const params = useLocalSearchParams<{ walker?: string }>();

  const [timing, setTiming] = useState<WalkTiming>('instant');
  const [slots] = useState(() => scheduleSlots());
  const [slotKey, setSlotKey] = useState(slots[0]?.key ?? '');
  const [minutes, setMinutes] = useState<WalkMinutes>(45);
  const [notes, setNotes] = useState('Watch for squirrels near Elm Creek Park');
  const [editingNotes, setEditingNotes] = useState(false);

  const slot = slots.find((option) => option.key === slotKey) ?? slots[0];
  const fare = walkFare(minutes, timing);

  // Longer walks make for a happier, faster tail (8 → 18 fps) while this screen is up.
  useFocusEffect(
    useCallback(() => {
      setWagFps(wagFpsFor(minutes));
      return () => setWagFps(PHYSICS.idleFps);
    }, [minutes, setWagFps])
  );

  const chooseTiming = (next: WalkTiming) => {
    if (next === timing) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTiming(next);
    glance();
  };

  const chooseSlot = (key: string) => {
    setSlotKey(key);
    glance();
  };

  const continueToPickup = () => {
    setDraft({
      timing,
      slotLabel: timing === 'scheduled' ? (slot?.label ?? null) : null,
      minutes,
      walkerNotes: notes.trim(),
      preferredWalkerId: isWalkerId(params.walker) ? params.walker : null,
    });
    go('choosePickup');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => go('closeBooking')}
          accessibilityRole="button"
          aria-label="Back"
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Book a Walk</Text>
        <View style={styles.headerAvatar}>
          <Image source={require('../../assets/corgi_mascot.png')} style={styles.headerAvatarImage} />
        </View>
      </View>

      <MascotScrollView
        contentContainerStyle={[styles.content, { paddingBottom: FOOTER_HEIGHT + insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Mascot stage */}
        <View style={styles.stage}>
          <View style={[styles.blob, styles.blobCoral]} />
          <View style={[styles.blob, styles.blobBlue]} />
          <View style={styles.readyPill}>
            <View style={styles.readyDot} />
            <Text style={styles.readyText}>BARNABY IS READY TO GO!</Text>
          </View>
          <MascotAnchor id="walkConfig" size={MASCOT_SIZE} />
          <View style={styles.petRow}>
            <Text style={styles.petName}>Barnaby</Text>
            <Badge label="Pembroke Corgi • 2y" tone="white" />
          </View>
        </View>

        {/* Walk type */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Walk Type</Text>
            <View style={styles.inlineRow}>
              <Icon name="gps-fixed" size={14} color={colors.primary} />
              <Text style={styles.gpsLabel}>Live GPS Tracker</Text>
            </View>
          </View>
          <View style={styles.timingRow}>
            <TimingCard
              selected={timing === 'instant'}
              icon="bolt"
              iconTint={colors.coralTint}
              iconInk={colors.coral}
              title="Instant Walk"
              detail={`Arrives in ~${INSTANT_ETA_MINUTES} mins`}
              badge="Popular"
              onPress={() => chooseTiming('instant')}
            />
            <TimingCard
              selected={timing === 'scheduled'}
              icon="calendar-today"
              iconTint={colors.track}
              iconInk={colors.ink}
              title="Schedule Later"
              detail={slot?.label ?? 'Pick a time'}
              onPress={() => chooseTiming('scheduled')}
            />
          </View>
          {timing === 'scheduled' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slotRow}
            >
              {slots.map((option) => {
                const selected = option.key === slotKey;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => chooseSlot(option.key)}
                    role="radio"
                    aria-checked={selected}
                    style={[styles.slotPill, selected && styles.slotPillSelected]}
                  >
                    <Icon
                      name="schedule"
                      size={15}
                      color={selected ? colors.onPrimary : colors.slate}
                    />
                    <Text style={[styles.slotText, selected && styles.slotTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Duration</Text>
            <Text style={styles.meta}>Daily Exercise</Text>
          </View>
          <Text style={styles.meta}>Tailored pace for Barnaby&apos;s short legs & high spirit</Text>
          <View style={styles.planRow}>
            {WALK_PLANS.map((plan) => {
              const selected = plan.minutes === minutes;
              return (
                <Pressable
                  key={plan.minutes}
                  onPress={() => setMinutes(plan.minutes)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${plan.minutes} minutes, ${formatMoney(plan.price)}`}
                  style={({ pressed }) => [
                    styles.plan,
                    selected && styles.planSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  {plan.badge ? (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.planMinutes, selected && styles.onPrimary]}>
                    {plan.minutes} Mins
                  </Text>
                  <Text style={[styles.planPrice, selected && styles.onPrimary]}>${plan.price}</Text>
                  <Text style={[styles.planTitle, selected && styles.onPrimary]}>{plan.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Inclusions */}
        <View style={[styles.card, styles.inclusions]}>
          <View style={styles.inlineRow}>
            <Icon name="verified-user" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Standard Safety & Care Inclusions</Text>
          </View>
          {INCLUSIONS.map((item) => (
            <View key={item.label} style={styles.inclusionRow}>
              <View style={[styles.smallCircle, { backgroundColor: item.tint }]}>
                <Icon name={item.icon} size={16} color={item.ink} />
              </View>
              <Text style={[styles.inclusionText, styles.flex]}>{item.label}</Text>
              <Icon name="check-circle" size={20} color={colors.primary} />
            </View>
          ))}
        </View>

        {/* Walker notes */}
        <View style={styles.notesCard}>
          <Icon name="sticky-note-2" size={22} color={colors.slate} />
          {editingNotes ? (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              autoFocus
              multiline
              aria-label="Walker notes"
              placeholder="Anything your walker should know"
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.primary}
              style={[styles.notesInput, styles.flex]}
              onFocus={() => focusField('text')}
              onBlur={blurField}
            />
          ) : (
            <Pressable onPress={() => setEditingNotes(true)} style={styles.flex}>
              <Text style={styles.notesQuote}>“{notes.trim() || 'No notes yet'}”</Text>
              <Text style={styles.meta}>Tap to update walker notes</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setEditingNotes((value) => !value)}
            accessibilityRole="button"
            style={styles.editPill}
          >
            <Text style={styles.editText}>{editingNotes ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>
      </MascotScrollView>

      {/* Sticky fare bar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.spaceBetween}>
          <Text style={styles.meta}>Estimated Total</Text>
          {fare.surge > 0 ? (
            <Badge label={`+${formatMoney(fare.surge)} peak surge`} tone="coral" dot />
          ) : (
            <Badge label="No Surge" tone="primary" dot />
          )}
        </View>
        <Text style={styles.total}>
          {formatMoney(fare.total)}
          <Text style={styles.totalUnit}> / {minutes} min walk</Text>
        </Text>
        <PrimaryButton label="Select Pickup Location" onPress={continueToPickup} />
        <Text style={styles.guarantee}>🔒 100% Insured & Vet Guarantee included</Text>
      </View>
    </SafeAreaView>
  );
}

interface TimingCardProps {
  selected: boolean;
  icon: string;
  iconTint: string;
  iconInk: string;
  title: string;
  detail: string;
  badge?: string;
  onPress: () => void;
}

function TimingCard({ selected, icon, iconTint, iconInk, title, detail, badge, onPress }: TimingCardProps) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={selected}
      style={({ pressed }) => [styles.timingCard, selected && styles.timingCardSelected, pressed && styles.pressed]}
    >
      <View style={styles.spaceBetween}>
        <View style={[styles.smallCircle, styles.timingIcon, { backgroundColor: iconTint }]}>
          <Icon name={icon} size={20} color={iconInk} />
        </View>
        {badge ? (
          <View style={styles.popular}>
            <Text style={styles.popularText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.meta}>{detail}</Text>
    </Pressable>
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
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topTitle: {
    ...typography.headline,
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
    paddingTop: 4,
    gap: 22,
  },
  stage: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 16,
    paddingBottom: 18,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: radii.full,
  },
  blobCoral: {
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 107, 74, 0.12)',
  },
  blobBlue: {
    bottom: -40,
    left: -40,
    width: 130,
    height: 130,
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },
  readyText: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.coralInk,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  petName: {
    ...typography.headline,
    fontSize: 20,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.headline,
  },
  gpsLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  meta: {
    ...typography.bodySm,
  },
  timingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timingCard: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  timingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  timingIcon: {
    marginBottom: 6,
  },
  popular: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.coral,
  },
  popularText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.onPrimary,
  },
  slotRow: {
    gap: 8,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  slotPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: {
    ...typography.label,
  },
  slotTextSelected: {
    color: colors.onPrimary,
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  plan: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  planSelected: {
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  planBadge: {
    position: 'absolute',
    top: -11,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.amber,
  },
  planBadgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    color: colors.ink,
  },
  planMinutes: {
    ...typography.label,
  },
  planPrice: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
  },
  planTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
  },
  onPrimary: {
    color: colors.onPrimary,
  },
  card: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardTitle: {
    ...typography.label,
    fontSize: 15,
  },
  inclusions: {
    gap: 12,
  },
  inclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inclusionText: {
    ...typography.body,
    color: colors.ink,
  },
  smallCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  notesQuote: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  notesInput: {
    minHeight: 44,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  editText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 18,
    paddingHorizontal: 20,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    boxShadow: '0px -10px 30px rgba(24, 26, 32, 0.08)',
  },
  total: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
  },
  totalUnit: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.slate,
  },
  guarantee: {
    ...typography.bodySm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});
