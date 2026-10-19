import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Toggle } from '../components/Toggle';
import { PrimaryButton } from '../components/Button';
import { Toast, useToast } from '../components/Toast';
import { MascotAnchor, MascotScrollView } from '../mascot/MascotAnchor';
import { useMascotActions } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../mascot/MascotMachine';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings, type WalkBooking } from '../booking/BookingsProvider';
import {
  ADD_ONS,
  DEFAULT_ADD_ONS,
  DURATIONS,
  WINDOWS,
  computeFare,
  formatMoney,
  monthHeading,
  upcomingDays,
  type AddOnKey,
  type DurationKey,
  type WalkStyle,
  type WindowKey,
} from '../booking/walkPricing';
import {
  PET_CHOICES,
  WALKERS,
  WALKER_IDS,
  isWalkerId,
  type PetChoice,
  type WalkerId,
} from '../data/careTeam';

const MASCOT_SIZE = 104;
const FOOTER_HEIGHT = 112;
const DEFAULT_NOTES =
  'Harness is hung on the entryway rack. Barnaby gets 2 liver treats from the pantry right after the walk. Towel is next to the water bowl.';

export function BookWalkerScreen() {
  const insets = useSafeAreaInsets();
  const { go } = useAppNavigation();
  const { bark, focusField, blurField } = useMascotActions();
  const { addBooking } = useBookings();
  const { message, show } = useToast();
  const params = useLocalSearchParams<{ walker?: string }>();

  const [pets, setPets] = useState<PetChoice>('barnaby');
  const [walkerId, setWalkerId] = useState<WalkerId>(() =>
    isWalkerId(params.walker) ? params.walker : 'marcus'
  );
  const [style, setStyle] = useState<WalkStyle>('solo');
  const [duration, setDuration] = useState<DurationKey>('trek');
  const [days] = useState(() => upcomingDays(5));
  const [dayKey, setDayKey] = useState(days[0].key);
  const [windowKey, setWindowKey] = useState<WindowKey>('midday');
  const [recurring, setRecurring] = useState(true);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [editingNotes, setEditingNotes] = useState(false);
  const [addOns, setAddOns] = useState<readonly AddOnKey[]>(DEFAULT_ADD_ONS);
  const [confirmed, setConfirmed] = useState<WalkBooking | null>(null);

  const walker = WALKERS[walkerId];
  const firstName = walker.name.split(' ')[0];
  const day = days.find((option) => option.key === dayKey) ?? days[0];
  const slot = WINDOWS.find((option) => option.key === windowKey) ?? WINDOWS[1];
  const durationOption = DURATIONS.find((option) => option.key === duration) ?? DURATIONS[1];
  const petNames = PET_CHOICES.find((choice) => choice.key === pets)?.names ?? 'Barnaby';
  const dateLabel =
    day.top === 'Today'
      ? 'Today'
      : day.top === 'Tmrw'
        ? 'Tomorrow'
        : `${day.weekday}, ${day.month} ${day.day}`;
  const fare = computeFare({ pets, style, duration, recurring, addOns });

  const chooseWalker = (id: WalkerId) => {
    if (id === walkerId) return;
    setWalkerId(id);
    bark();
  };

  const nextWalker = () => {
    const index = WALKER_IDS.indexOf(walkerId);
    chooseWalker(WALKER_IDS[(index + 1) % WALKER_IDS.length]);
  };

  const toggleAddOn = (key: AddOnKey) =>
    setAddOns((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );

  const confirm = () => {
    const booking = addBooking({
      walkerId,
      pets,
      style,
      duration,
      date: day.key,
      dateLabel,
      window: windowKey,
      startLabel: slot.start,
      recurring,
      addOns,
      notes,
      total: fare.total,
    });
    bark();
    setConfirmed(booking);
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
        <Text style={styles.topTitle}>Dog Walker Booking</Text>
        <Pressable
          onPress={() => show('Concierge is here 24/7 · free cancellation up to 2h before')}
          accessibilityRole="button"
          aria-label="Help"
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="help-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <MascotScrollView
        contentContainerStyle={[styles.content, { paddingBottom: FOOTER_HEIGHT + insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Who's walking */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.petRow}
        >
          {PET_CHOICES.map((choice) => {
            const selected = choice.key === pets;
            return (
              <Pressable
                key={choice.key}
                onPress={() => setPets(choice.key)}
                role="radio"
                aria-checked={selected}
                style={[styles.petChip, selected && styles.petChipSelected]}
              >
                <PetAvatar choice={choice.key} />
                <Text style={[styles.petChipText, selected && styles.petChipTextSelected]}>
                  {choice.label}
                </Text>
                {selected ? <Icon name="check-circle" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Live walk preview: Barnaby stands here */}
        <View style={styles.preview}>
          <MascotAnchor id="bookWalker" size={MASCOT_SIZE} />
          <View style={styles.previewCopy}>
            <Text style={styles.overline}>Walk preview</Text>
            <Text style={styles.previewTitle}>
              {petNames} · {durationOption.title}
            </Text>
            <Text style={styles.previewDetail}>
              with {walker.shortName} · {dateLabel}, {slot.start}
            </Text>
            <Badge
              label={recurring ? `Every ${day.weekdayLong}` : 'One-time walk'}
              tone={recurring ? 'coral' : 'white'}
            />
          </View>
        </View>

        <View style={[styles.card, styles.guarantee]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
            <Icon name="verified-user" size={20} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>PawPal Guarantee</Text>
            <Text style={styles.meta}>100% Insured • Real-time GPS Walk Route • Photo Updates</Text>
          </View>
          <Pressable
            onPress={() => show('Every walk is insured, GPS-tracked and photo-updated 📸')}
            accessibilityRole="button"
            aria-label="About the PawPal Guarantee"
            hitSlop={8}
          >
            <Icon name="info-outline" size={20} color={colors.slate} />
          </Pressable>
        </View>

        {/* Walker */}
        <Section
          title="Your Dog Walker"
          action={{ label: 'Change', onPress: nextWalker }}
        >
          <View style={styles.card}>
            <View style={styles.walkerRow}>
              <View>
                <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={60} />
                <View style={styles.starBadge}>
                  <Icon name="star" size={12} color={colors.card} />
                </View>
              </View>
              <View style={styles.flex}>
                <View style={styles.inlineRow}>
                  <Text style={styles.walkerName}>{walker.name}</Text>
                  {walker.topMatch ? <Badge label="Top Match" tone="coral" /> : null}
                </View>
                <View style={styles.inlineRow}>
                  <Icon name="star" size={15} color={colors.amber} />
                  <Text style={styles.rating}>{walker.rating.toFixed(1)}</Text>
                  <Text style={styles.meta}>•</Text>
                  <Text style={styles.walkCount}>
                    {walker.walksWithBarnaby > 0
                      ? `${walker.walksWithBarnaby} walks with Barnaby`
                      : 'New to Barnaby'}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  {walker.badges.map((badge) => (
                    <Badge key={badge} label={badge} tone="success" />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
              <Text style={styles.overline}>Or pick:</Text>
              {WALKER_IDS.filter((id) => id !== walkerId).map((id) => {
                const option = WALKERS[id];
                return (
                  <Pressable
                    key={id}
                    onPress={() => chooseWalker(id)}
                    accessibilityRole="button"
                    aria-label={`Choose ${option.name}`}
                    style={({ pressed }) => [styles.pickChip, pressed && styles.pressed]}
                  >
                    <Avatar initials={option.initials} tint={option.tint} ink={option.ink} size={26} />
                    <Text style={styles.pickName}>{option.shortName}</Text>
                    <Text style={styles.pickRating}>{option.rating.toFixed(1)}★</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Section>

        {/* Duration */}
        <Section
          title="Walk Duration"
          accessory={
            <View style={styles.segment}>
              {(['solo', 'group'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStyle(option)}
                  role="radio"
                  aria-checked={style === option}
                  style={[styles.segmentItem, style === option && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, style === option && styles.segmentTextActive]}>
                    {option === 'solo' ? 'Solo Walk' : 'Social Group'}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        >
          <View style={styles.stack}>
            {DURATIONS.map((option) => {
              const selected = option.key === duration;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setDuration(option.key)}
                  role="radio"
                  aria-checked={selected}
                  style={[styles.card, styles.option, selected && styles.optionSelected]}
                >
                  {option.popular ? (
                    <View style={styles.ribbon}>
                      <Text style={styles.ribbonText}>MOST POPULAR</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: selected ? colors.primary : colors.primaryTint },
                    ]}
                  >
                    <Icon
                      name={option.icon}
                      size={20}
                      color={selected ? colors.onPrimary : colors.primary}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{option.title}</Text>
                    <Text style={styles.meta}>{option.detail}</Text>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={[styles.price, selected && styles.priceSelected]}>
                      ${option.price[style]}
                    </Text>
                    <Text style={styles.meta}>per walk</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Date */}
        <Section title="Select Date" meta={monthHeading(days)}>
          <View style={styles.dayRow}>
            {days.map((option) => {
              const selected = option.key === dayKey;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setDayKey(option.key)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${option.weekdayLong} ${option.month} ${option.day}`}
                  style={[styles.dayChip, selected && styles.dayChipSelected]}
                >
                  <Text style={[styles.dayTop, selected && styles.onPrimary]}>
                    {option.top.toUpperCase()}
                  </Text>
                  <Text style={[styles.dayNumber, selected && styles.onPrimary]}>{option.day}</Text>
                  <Text style={[styles.dayWeek, selected && styles.onPrimary]}>{option.weekday}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Window */}
        <Section title="Preferred Window">
          <View style={styles.windowGrid}>
            {WINDOWS.map((option) => {
              const selected = option.key === windowKey;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setWindowKey(option.key)}
                  role="radio"
                  aria-checked={selected}
                  style={[styles.windowCard, selected && styles.windowCardSelected]}
                >
                  <Icon
                    name={option.icon}
                    size={22}
                    color={selected ? colors.primary : colors.coral}
                  />
                  <View style={styles.flex}>
                    <Text style={[styles.windowLabel, selected && styles.windowLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.meta}>{option.range}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={styles.recurring}>
          <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
            <Icon name="event-repeat" size={20} color={colors.coral} />
          </View>
          <View style={styles.flex}>
            <View style={styles.inlineRow}>
              <Text style={styles.cardTitle}>Recurring Weekly Walk</Text>
              <Badge label="SAVE 10%" tone="coral" />
            </View>
            <Text style={styles.meta}>
              Lock your favorite walker {firstName} every {day.weekdayLong}
            </Text>
          </View>
          <Toggle
            accessibilityLabel="Recurring weekly walk"
            value={recurring}
            onValueChange={setRecurring}
          />
        </View>

        {/* Access */}
        <Section
          title="Home Access & Instructions"
          action={{
            label: editingNotes ? 'Done' : 'Edit',
            icon: editingNotes ? 'check' : 'edit',
            onPress: () => setEditingNotes((value) => !value),
          }}
        >
          <View style={[styles.card, styles.access]}>
            <View style={styles.inlineRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.amberTint }]}>
                <Icon name="key" size={20} color={colors.amberInk} />
              </View>
              <Text style={styles.cardTitle}>Gate Code: #4092</Text>
              <Badge label="Smart Lockbox" tone="primary" />
            </View>
            {editingNotes ? (
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                autoFocus
                aria-label="Walker instructions"
                placeholder="Anything your walker should know"
                placeholderTextColor={colors.placeholder}
                selectionColor={colors.primary}
                style={styles.notesInput}
                onFocus={() => focusField('text')}
                onBlur={blurField}
              />
            ) : (
              <Text style={styles.notes}>“{notes.trim() || 'No instructions yet'}”</Text>
            )}
          </View>
        </Section>

        {/* Add-ons */}
        <Section title="Complimentary & Add-on Care">
          <View style={[styles.card, styles.listCard]}>
            {ADD_ONS.map((addOn, index) => {
              const checked = addOns.includes(addOn.key);
              return (
                <Pressable
                  key={addOn.key}
                  onPress={() => toggleAddOn(addOn.key)}
                  role="checkbox"
                  aria-checked={checked}
                  style={[styles.addOnRow, index < ADD_ONS.length - 1 && styles.rowDivider]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colors.stage }]}>
                    <Icon name={addOn.icon} size={20} color={colors.coral} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{addOn.title}</Text>
                    <Text style={styles.meta}>{addOn.detail}</Text>
                  </View>
                  <Text style={[styles.addOnPrice, addOn.price === 0 && styles.free]}>
                    {addOn.price === 0 ? 'Free' : `+${formatMoney(addOn.price)}`}
                  </Text>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Fare */}
        <View style={[styles.card, styles.fare]}>
          <Text style={styles.sectionTitle}>Fare Summary</Text>
          {fare.lines.map((line) => (
            <View key={line.label} style={styles.fareRow}>
              <View style={styles.inlineRow}>
                <Text style={styles.fareLabel}>{line.label}</Text>
                {line.info ? (
                  <Pressable
                    onPress={() => show('Covers walker insurance and live GPS tracking')}
                    accessibilityRole="button"
                    aria-label="About the trust and safety fee"
                    hitSlop={8}
                  >
                    <Icon name="help-outline" size={15} color={colors.slate} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={[styles.fareAmount, line.amount < 0 && styles.discount]}>
                {formatMoney(line.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.fareRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <View style={styles.totalCol}>
              <Text style={styles.total}>{formatMoney(fare.total)}</Text>
              <Text style={styles.meta}>All taxes included</Text>
            </View>
          </View>
        </View>
      </MascotScrollView>

      {/* Sticky confirm bar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable
          onPress={confirm}
          accessibilityRole="button"
          style={({ pressed }) => [styles.confirm, pressed && styles.confirmPressed]}
        >
          <View style={styles.inlineRow}>
            <Icon name="pets" size={20} color={colors.onPrimary} />
            <Text style={styles.confirmText}>Confirm & Book Walk</Text>
          </View>
          <Text style={styles.confirmText}>{formatMoney(fare.total)}</Text>
        </Pressable>
        <View style={styles.footerNote}>
          <Icon name="event-available" size={14} color={colors.slate} />
          <Text style={styles.meta}>Free cancellation up to 2 hours before walk starts</Text>
        </View>
      </View>

      <Toast message={message} bottomOffset={FOOTER_HEIGHT + 12} />

      {confirmed ? (
        <ConfirmationSheet
          booking={confirmed}
          walkerName={WALKERS[confirmed.walkerId].name}
          petNames={PET_CHOICES.find((choice) => choice.key === confirmed.pets)?.names ?? 'Barnaby'}
          durationTitle={DURATIONS.find((option) => option.key === confirmed.duration)?.title ?? ''}
          windowRange={WINDOWS.find((option) => option.key === confirmed.window)?.range ?? ''}
          bottomInset={insets.bottom}
          onDone={() => go('closeBooking')}
        />
      ) : null}
    </SafeAreaView>
  );
}

const PET_AVATAR_SIZE = 30;

function PetAvatar({ choice }: { choice: PetChoice }) {
  if (choice === 'barnaby') {
    return (
      <View style={[styles.petAvatar, { backgroundColor: colors.stage }]}>
        <Image
          source={require('../../assets/corgi_mascot.png')}
          style={styles.petAvatarImage}
          resizeMode="contain"
        />
      </View>
    );
  }
  if (choice === 'luna') {
    return (
      <View style={[styles.petAvatar, { backgroundColor: colors.amberTint }]}>
        <Text style={styles.petEmoji}>🐱</Text>
      </View>
    );
  }
  return (
    <View style={[styles.petAvatar, { backgroundColor: colors.primaryTint }]}>
      <Icon name="pets" size={16} color={colors.primary} />
    </View>
  );
}

interface SectionProps {
  title: string;
  meta?: string;
  accessory?: React.ReactNode;
  action?: { label: string; icon?: string; onPress: () => void };
  children: React.ReactNode;
}

function Section({ title, meta, accessory, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {accessory}
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.inlineRow}
          >
            {action.icon ? <Icon name={action.icon} size={16} color={colors.primary} /> : null}
            <Text style={styles.link}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

interface ConfirmationSheetProps {
  booking: WalkBooking;
  walkerName: string;
  petNames: string;
  durationTitle: string;
  windowRange: string;
  bottomInset: number;
  onDone: () => void;
}

/** Success sheet shown after booking; Barnaby woofs from his stage above it. */
function ConfirmationSheet({
  booking,
  walkerName,
  petNames,
  durationTitle,
  windowRange,
  bottomInset,
  onDone,
}: ConfirmationSheetProps) {
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]} />
      <Animated.View
        role="dialog"
        aria-label="Walk booked"
        style={[
          styles.sheet,
          {
            paddingBottom: bottomInset + 20,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.sheetIcon}>
          <Icon name="check" size={30} color={colors.onPrimary} />
        </View>
        <Text style={styles.sheetTitle}>Walk booked! 🐾</Text>
        <Text style={styles.sheetSubtitle}>
          {petNames} · {durationTitle} with {walkerName}
        </Text>
        <View style={styles.sheetDetails}>
          <SheetRow icon="event" label={`${booking.dateLabel} · ${windowRange}`} />
          <SheetRow
            icon="event-repeat"
            label={booking.recurring ? 'Repeats weekly · 10% off' : 'One-time walk'}
          />
          <SheetRow icon="payments" label={`${formatMoney(booking.total)} · free cancellation up to 2h before`} />
        </View>
        <PrimaryButton label="Done" trailingIcon="check" onPress={onDone} style={styles.sheetButton} />
      </Animated.View>
    </View>
  );
}

function SheetRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sheetRow}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={styles.sheetRowText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
    gap: 2,
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 20,
  },
  petRow: {
    gap: 10,
    paddingVertical: 2,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  petChipSelected: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  petChipText: {
    ...typography.label,
  },
  petChipTextSelected: {
    color: colors.primary,
  },
  petAvatar: {
    width: PET_AVATAR_SIZE,
    height: PET_AVATAR_SIZE,
    borderRadius: PET_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petAvatarImage: {
    width: PET_AVATAR_SIZE + 6,
    height: PET_AVATAR_SIZE + 6,
  },
  petEmoji: {
    fontSize: 16,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 16,
    paddingLeft: 4,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    ...typography.subhead,
  },
  previewDetail: {
    ...typography.bodySm,
  },
  overline: {
    ...typography.overline,
  },
  card: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.label,
    fontSize: 14,
  },
  meta: {
    ...typography.bodySm,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    ...typography.headline,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  walkerRow: {
    flexDirection: 'row',
    gap: 14,
  },
  starBadge: {
    position: 'absolute',
    right: -2,
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
  walkerName: {
    ...typography.subhead,
  },
  rating: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  walkCount: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  pickRow: {
    alignItems: 'center',
    gap: 8,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  pickName: {
    ...typography.label,
    fontSize: 12,
  },
  pickRating: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.amberInk,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  segmentItemActive: {
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  segmentText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
  },
  segmentTextActive: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  stack: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
    backgroundColor: colors.coral,
  },
  ribbonText: {
    fontFamily: fonts.extrabold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.onPrimary,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.ink,
  },
  priceSelected: {
    color: colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  dayTop: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.coralInk,
  },
  dayNumber: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
  },
  dayWeek: {
    ...typography.bodySm,
  },
  onPrimary: {
    color: colors.onPrimary,
  },
  windowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  windowCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  windowCardSelected: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  windowLabel: {
    ...typography.label,
  },
  windowLabelSelected: {
    color: colors.primary,
  },
  recurring: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.stage,
  },
  access: {
    gap: 12,
  },
  notes: {
    ...typography.body,
    color: colors.ink,
  },
  notesInput: {
    minHeight: 96,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    textAlignVertical: 'top',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  listCard: {
    paddingVertical: 4,
  },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  addOnPrice: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  free: {
    color: colors.successInk,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  fare: {
    gap: 10,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fareLabel: {
    ...typography.body,
  },
  fareAmount: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  discount: {
    color: colors.successInk,
  },
  totalLabel: {
    ...typography.subhead,
  },
  totalCol: {
    alignItems: 'flex-end',
  },
  total: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.primary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.canvas,
    boxShadow: '0px -8px 24px rgba(24, 26, 32, 0.06)',
  },
  confirm: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  confirmPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.98 }],
  },
  confirmText: {
    ...typography.button,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24, 26, 32, 0.38)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 8,
    paddingTop: 28,
    paddingHorizontal: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  sheetIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    boxShadow: '0px 8px 20px rgba(46, 204, 113, 0.35)',
    marginBottom: 6,
  },
  sheetTitle: {
    ...typography.title,
  },
  sheetSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  sheetDetails: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 8,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.input,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetRowText: {
    ...typography.label,
    flex: 1,
  },
  sheetButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
