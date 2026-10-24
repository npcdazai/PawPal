import React, { useState, type ReactNode } from 'react';
import { LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { useResponsive } from '../theme/responsive';
import { Icon } from '../components/Icon';
import { Badge, type BadgeTone } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Toggle } from '../components/Toggle';
import { Toast, useToast } from '../components/Toast';
import { BOTTOM_NAV_HEIGHT, bottomNavClearance } from '../components/BottomNavigation';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useAuth } from '../auth/AuthProvider';
import { useBookings } from '../booking/BookingsProvider';
import { WALKERS, type WalkerId } from '../data/careTeam';
import { withVersion } from '../config/appInfo';

const BASE_WALKS = 28;

type PetTab = 'passport' | 'diet' | 'guide';
type AccountPanel = 'payment' | 'notifications' | null;

const PET_TABS: { key: PetTab; label: string }[] = [
  { key: 'passport', label: 'Health Passport' },
  { key: 'diet', label: 'Diet Schedule' },
  { key: 'guide', label: 'Care Guide' },
];

const FAVOURITES = ['🎾 Tennis balls', '🐿️ Squirrel patrol', '🥕 Carrot crunch', '💤 Sofa naps'];

const shortDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { compact } = useResponsive();
  const { go, goToTab } = useAppNavigation();
  const { bark, setHapticsEnabled } = useMascotActions();
  const { delight, hapticsEnabled } = useMascotStatus();
  const { bookings } = useBookings();
  const { message, show } = useToast();
  const { signOut: endSession } = useAuth();
  // Unregisters push and ends the session; the route guard then shows sign-in.
  const { mutate: signOut, isPending: signingOut } = useMutation({ mutationFn: endSession });

  const [petTab, setPetTab] = useState<PetTab>('passport');
  const [lunaOpen, setLunaOpen] = useState(false);
  const [panel, setPanel] = useState<AccountPanel>(null);
  const [walkReminders, setWalkReminders] = useState(true);
  const [mealReminders, setMealReminders] = useState(true);
  const [dates] = useState(() => ({ nextSit: shortDate(23), lastSpa: shortDate(-16) }));

  const liveBookings = bookings.filter((booking) => booking.status !== 'cancelled');
  const lastWalker = WALKERS[liveBookings[0]?.walkerId ?? 'marcus'];
  const walkCount = BASE_WALKS + liveBookings.length;

  const open = (url: string, failure: string) => {
    Linking.openURL(url).catch(() => show(failure));
  };

  const animateNext = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const togglePanel = (next: Exclude<AccountPanel, null>) => {
    animateNext();
    setPanel((current) => (current === next ? null : next));
  };

  const book = (walkerId: WalkerId) => go('bookWalk', { walker: walkerId });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance(insets.bottom) + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => go('closeProfile')}
            accessibilityRole="button"
            aria-label="Back to dashboard"
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Icon name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>Profile</Text>
          <View style={styles.iconButtonSpacer} />
        </View>

        {/* Pet parent */}
        <View style={[styles.card, styles.owner]}>
          <View style={styles.ownerRow}>
            <View style={styles.avatarRing}>
              <Avatar initials="SJ" tint={colors.amber} ink={colors.card} size={68} />
            </View>
            <View style={styles.ownerCopy}>
              <View style={styles.inlineRow}>
                <Text style={styles.ownerName}>Sarah Jenkins</Text>
                <Icon name="verified" size={20} color={colors.primary} />
              </View>
              {/* The pin stays beside the line when it wraps on narrow phones. */}
              <View style={styles.iconLine}>
                <Icon name="location-on" size={15} color={colors.slate} />
                <Text style={[styles.meta, styles.shrink]}>San Francisco, CA · Since Mar 2023</Text>
              </View>
              <Badge label="Verified Pet Parent" tone="primary" />
            </View>
          </View>

          <View style={styles.contactRow}>
            <ContactChip
              icon="mail"
              label="sarah.j@companions.pet"
              onPress={() => open('mailto:sarah.j@companions.pet', 'No mail app available')}
            />
            <ContactChip
              icon="call"
              label="+1 (555) 382-9104"
              onPress={() => open('tel:+15553829104', 'Calling isn’t available here')}
            />
          </View>

          <View style={styles.stats}>
            <Stat value="14 🔥" label="Day Streak" accent={colors.coral} />
            <View style={styles.statDivider} />
            <Stat value="4.9 ★" label="Parent Rating" accent={colors.amberInk} />
            <View style={styles.statDivider} />
            <Stat value="2 🐾" label="Registered" accent={colors.primary} />
          </View>
        </View>

        {/* Booked services */}
        <Section
          title="Booked Services"
          icon="calendar-month"
          action={{ label: 'View History', onPress: () => goToTab('activities') }}
        >
          <View style={[styles.serviceRow, compact && styles.serviceRowCompact]}>
            <ServiceCard
              icon="directions-walk"
              tint={colors.primaryTint}
              ink={colors.primary}
              label="Walks"
              count={walkCount}
              detail={`Last: ${lastWalker.shortName}`}
              footer={
                <Pressable
                  onPress={() => book(lastWalker.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.serviceButton, pressed && styles.pressed]}
                >
                  <Text style={styles.serviceButtonText}>Rebook</Text>
                </Pressable>
              }
            />
            <ServiceCard
              icon="holiday-village"
              tint={colors.amberTint}
              ink={colors.amberInk}
              label="Sits"
              count={14}
              detail={`Next: ${dates.nextSit}`}
              footer={<Badge label="Elena R." tone="coral" style={styles.centerSelf} />}
            />
            <ServiceCard
              icon="content-cut"
              tint={colors.coralTint}
              ink={colors.coral}
              label="Groom"
              count={9}
              detail={`Spa: ${dates.lastSpa}`}
              footer={<Badge label="Paws Spa" tone="amber" style={styles.centerSelf} />}
            />
          </View>
          <View style={[styles.card, styles.hoursStrip]}>
            <Icon name="verified-user" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, styles.flex]}>184 Total Care Hours Logged</Text>
            <Badge label="100% Insured" tone="success" />
          </View>
        </Section>

        {/* Pets */}
        <Section title="My Pets (2)" icon="favorite" iconColor={colors.coral}>
          <View style={[styles.card, styles.petCard]}>
            <View style={styles.petAccent} />
            <View style={styles.petRow}>
              <MascotDockSlot variant="pet-portrait" />
              <View style={styles.petCopy}>
                <Text style={styles.petName}>Barnaby</Text>
                <Badge label="Primary Companion" tone="coral" />
                <Text style={styles.meta}>Pembroke Welsh Corgi</Text>
                <Text style={styles.meta}>2 yrs 4 mos · 12.4 kg</Text>
              </View>
            </View>

            <View style={styles.chips}>
              <Trait icon="qr-code-2" label="Microchipped #9820" tone="primary" />
              <Trait icon="check-circle" label="Vaccinated" tone="success" />
              <Trait label="🐶 Friendly with dogs" tone="amber" />
              <Trait label="🌾 Sensitive Stomach" tone="coral" />
            </View>

            <View style={styles.vetBox}>
              <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
                <Icon name="medical-services" size={20} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <View style={styles.spaceBetween}>
                  <Text style={styles.vetOverline}>Upcoming Vet Visit</Text>
                  <Text style={styles.vetWhen}>In 12 days</Text>
                </View>
                <Text style={styles.rowLabel}>Dental & Routine Checkup</Text>
                <Text style={styles.meta}>Dr. Ava Wells · VCA San Francisco</Text>
              </View>
            </View>

            <View style={styles.petTabs} role="tablist">
              {PET_TABS.map((tab) => {
                const selected = tab.key === petTab;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      animateNext();
                      setPetTab(tab.key);
                    }}
                    role="tab"
                    aria-selected={selected}
                    style={[styles.petTab, compact && styles.petTabCompact, selected && styles.petTabActive]}
                  >
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={[styles.petTabText, selected && styles.petTabTextActive]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {petTab === 'passport' ? (
              <View>
                <InfoRow icon="vaccines" label="Vaccinations" value="Rabies · DHPP · Bordetella" />
                <InfoRow icon="memory" label="Microchip" value="ID ending 9820" />
                <InfoRow icon="no-food" label="Allergies" value="Chicken" />
                <InfoRow icon="monitor-weight" label="Weight" value="12.4 kg · healthy range" last />
              </View>
            ) : null}
            {petTab === 'diet' ? (
              <View>
                <InfoRow icon="wb-twilight" label="7:30 AM · Breakfast" value="1.5 cups kibble + bone broth" />
                <InfoRow icon="wb-sunny" label="12:30 PM · Training" value="Up to 10 small treats" />
                <InfoRow icon="nights-stay" label="6:30 PM · Dinner" value="1.5 cups kibble" />
                <InfoRow icon="no-food" label="Avoid" value="Chicken (sensitive stomach)" last />
              </View>
            ) : null}
            {petTab === 'guide' ? (
              <View style={styles.guide}>
                <Text style={styles.meta}>Favourite things — tap one to make Barnaby woof</Text>
                <View style={styles.chips}>
                  {FAVOURITES.map((favourite) => (
                    <Pressable
                      key={favourite}
                      onPress={bark}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <Text style={styles.chipText}>{favourite}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.meta}>
                  Harness on the entryway rack · {delight} {delight === 1 ? 'pet' : 'pets'} today
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              animateNext();
              setLunaOpen((value) => !value);
            }}
            accessibilityRole="button"
            aria-expanded={lunaOpen}
            style={[styles.card, styles.lunaCard]}
          >
            <View style={styles.lunaRow}>
              <View style={styles.lunaAvatar}>
                <Text style={styles.lunaEmoji}>🐱</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.lunaName}>Luna</Text>
                <Text style={styles.meta}>Scottish Fold Cat · 1 yr 2 mos</Text>
                <View style={styles.chips}>
                  <Badge label="🏠 Indoor Only" tone="amber" />
                  <Badge label="Spayed" tone="primary" />
                  <Badge label="✨ Calm" tone="success" />
                </View>
              </View>
              <Icon name={lunaOpen ? 'expand-less' : 'chevron-right'} size={24} color={colors.slate} />
            </View>
            {lunaOpen ? (
              <View style={styles.lunaDetails}>
                <InfoRow icon="restaurant" label="Feeding" value="⅓ cup wet food, twice daily" />
                <InfoRow icon="home" label="Routine" value="Litter refreshed by sitter daily" />
                <InfoRow icon="medical-services" label="Vet" value="Dr. Ava Wells · in 3 months" last />
              </View>
            ) : null}
          </Pressable>
        </Section>

        {/* Care team */}
        <Section title="Favorite Care Team" meta="3 Trusted">
          <View style={[styles.card, styles.listCard]}>
            <TeamRow
              avatar={<Avatar initials="MT" tint={WALKERS.marcus.tint} ink={WALKERS.marcus.ink} size={46} />}
              name="Marcus T."
              role="Walk Star"
              roleTone="primary"
              detail="18 walks completed with Barnaby"
              actionIcon="edit-calendar"
              actionLabel="Book Marcus"
              onAction={() => book('marcus')}
            />
            <TeamRow
              avatar={<Avatar initials="ER" tint={WALKERS.elena.tint} ink={WALKERS.elena.ink} size={46} />}
              name="Elena R."
              role="Overnight Sitter"
              roleTone="amber"
              detail="8 stays · Key holder access"
              actionIcon="edit-calendar"
              actionLabel="Book Elena"
              onAction={() => book('elena')}
            />
            <TeamRow
              avatar={
                <View style={[styles.iconCircle, styles.spaAvatar]}>
                  <Icon name="bathtub" size={22} color={colors.coral} />
                </View>
              }
              name="Paws & Bubbles Spa"
              role="Groomer"
              roleTone="coral"
              detail="Hydro-massage & fur de-shedding"
              actionIcon="call"
              actionLabel="Call Paws & Bubbles Spa"
              onAction={() => open('tel:+15552017788', 'Calling isn’t available here')}
              last
            />
          </View>
        </Section>

        {/* Account */}
        <Section title="Account & Safety">
          <View style={[styles.card, styles.listCard]}>
            <AccountRow
              icon="credit-card"
              tint={colors.primaryTint}
              ink={colors.primary}
              title="Payment Methods"
              detail="Apple Pay · Visa ending 4289"
              expanded={panel === 'payment'}
              onPress={() => togglePanel('payment')}
            >
              <InfoRow icon="phone-iphone" label="Apple Pay" value="Default" />
              <InfoRow icon="credit-card" label="Visa •••• 4289" value="Expires 08/28" last />
            </AccountRow>
            <AccountRow
              icon="notifications-active"
              tint={colors.amberTint}
              ink={colors.amberInk}
              title="Notification Preferences"
              detail="Live walk GPS & medication alerts"
              expanded={panel === 'notifications'}
              onPress={() => togglePanel('notifications')}
            >
              <ToggleRow
                label="Walk reminders"
                detail="7:30 AM & 6:00 PM"
                value={walkReminders}
                onChange={(next) => {
                  setWalkReminders(next);
                  show(next ? 'Walk reminders on 🦮' : 'Walk reminders paused');
                }}
              />
              <ToggleRow
                label="Meal reminders"
                detail="8:00 AM & 7:00 PM"
                value={mealReminders}
                onChange={(next) => {
                  setMealReminders(next);
                  show(next ? 'Meal reminders on 🍲' : 'Meal reminders paused');
                }}
              />
              <ToggleRow
                label="Haptic paw taps"
                detail="Feel Barnaby arrive and woof"
                value={hapticsEnabled}
                onChange={(next) => {
                  setHapticsEnabled(next);
                  show(next ? 'Paw taps on 🐾' : 'Paw taps off');
                }}
              />
            </AccountRow>
            <AccountRow
              icon="local-hospital"
              tint={colors.coralTint}
              ink={colors.coral}
              title="Emergency Vet Hotline"
              detail="Mission Pet 24/7 ER on speed dial"
              detailColor={colors.coralInk}
              trailingIcon="call"
              onPress={() => open('tel:+14155550199', 'Calling isn’t available here')}
            />
            <AccountRow
              icon="help-center"
              tint={colors.successTint}
              ink={colors.successInk}
              title="Help & Live Concierge"
              detail="Available 24/7 for pet emergencies"
              trailingIcon="mail"
              onPress={() => open('mailto:care@pawpal.app', 'No mail app available')}
              last
            />
          </View>
        </Section>

        <Pressable
          onPress={() => signOut()}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityState={{ disabled: signingOut }}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        >
          <Icon name="logout" size={20} color={colors.coralInk} />
          <Text style={styles.logoutText}>{signingOut ? 'Logging out…' : 'Log Out of PawPal'}</Text>
        </Pressable>
        <Text style={styles.version}>{withVersion('PawPal App')} · Made with 🐾 for Barnaby & Luna</Text>
      </ScrollView>

      <Toast message={message} bottomOffset={BOTTOM_NAV_HEIGHT + 28} />
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  iconColor = colors.primary,
  meta,
  action,
  children,
}: {
  title: string;
  icon?: string;
  iconColor?: string;
  meta?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.inlineRow}>
          {icon ? <Icon name={icon} size={20} color={iconColor} /> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ContactChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.contactChip, pressed && styles.pressed]}
    >
      <Icon name={icon} size={16} color={colors.primary} />
      <Text style={styles.contactText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface ServiceCardProps {
  icon: string;
  tint: string;
  ink: string;
  label: string;
  count: number;
  detail: string;
  footer: ReactNode;
}

function ServiceCard({ icon, tint, ink, label, count, detail, footer }: ServiceCardProps) {
  const { compact } = useResponsive();
  return (
    <View style={[styles.card, styles.service, compact && styles.serviceCompact]}>
      <View style={styles.serviceTop}>
        <View style={[styles.serviceIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={18} color={ink} />
        </View>
        <Text style={[styles.serviceLabel, { color: ink }]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.serviceCount}>{count}</Text>
      {/* Three cards to a row: on narrow phones the detail may take a second line. */}
      <Text style={styles.meta} numberOfLines={compact ? 2 : 1}>
        {detail}
      </Text>
      <View style={styles.serviceFooter}>{footer}</View>
    </View>
  );
}

function Trait({ icon, label, tone }: { icon?: string; label: string; tone: BadgeTone }) {
  if (!icon) return <Badge label={label} tone={tone} />;
  return (
    <View style={styles.trait}>
      <Icon name={icon} size={14} color={colors.primary} />
      <Text style={styles.traitText}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.rowDivider]}>
      <Icon name={icon} size={18} color={colors.slate} />
      <Text style={[styles.rowLabel, styles.flex]}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

interface TeamRowProps {
  avatar: ReactNode;
  name: string;
  role: string;
  roleTone: BadgeTone;
  detail: string;
  actionIcon: string;
  actionLabel: string;
  onAction: () => void;
  last?: boolean;
}

function TeamRow({
  avatar,
  name,
  role,
  roleTone,
  detail,
  actionIcon,
  actionLabel,
  onAction,
  last = false,
}: TeamRowProps) {
  return (
    <View style={[styles.teamRow, !last && styles.rowDivider]}>
      {avatar}
      <View style={styles.flex}>
        <View style={styles.inlineRow}>
          <Text style={styles.rowLabel}>{name}</Text>
          <Badge label={role} tone={roleTone} />
        </View>
        <Text style={styles.meta}>{detail}</Text>
      </View>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        aria-label={actionLabel}
        hitSlop={6}
        style={({ pressed }) => [styles.teamAction, pressed && styles.pressed]}
      >
        <Icon name={actionIcon} size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

interface AccountRowProps {
  icon: string;
  tint: string;
  ink: string;
  title: string;
  detail: string;
  detailColor?: string;
  expanded?: boolean;
  trailingIcon?: string;
  onPress: () => void;
  last?: boolean;
  children?: ReactNode;
}

function AccountRow({
  icon,
  tint,
  ink,
  title,
  detail,
  detailColor,
  expanded,
  trailingIcon,
  onPress,
  last = false,
  children,
}: AccountRowProps) {
  const expandable = expanded !== undefined;
  return (
    <View style={!last && styles.rowDivider}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        aria-expanded={expandable ? expanded : undefined}
        style={({ pressed }) => [styles.accountRow, pressed && styles.rowPressed]}
      >
        <View style={[styles.iconCircle, { backgroundColor: tint }]}>
          <Icon name={icon} size={20} color={ink} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.rowLabel}>{title}</Text>
          <Text style={[styles.meta, detailColor ? { color: detailColor } : null]}>{detail}</Text>
        </View>
        <Icon
          name={expandable ? (expanded ? 'expand-less' : 'expand-more') : (trailingIcon ?? 'chevron-right')}
          size={22}
          color={colors.slate}
        />
      </Pressable>
      {expanded ? <View style={styles.accountPanel}>{children}</View> : null}
    </View>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.meta}>{detail}</Text>
      </View>
      <Toggle accessibilityLabel={label} value={value} onValueChange={onChange} />
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
  flex: {
    flex: 1,
    gap: 2,
  },
  shrink: {
    flexShrink: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  iconLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerSelf: {
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
  iconButtonSpacer: {
    width: 42,
  },
  topTitle: {
    ...typography.headline,
  },
  card: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  owner: {
    gap: 14,
    borderRadius: radii.xl,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.amberTint,
  },
  ownerCopy: {
    flex: 1,
    gap: 4,
  },
  ownerName: {
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
  },
  meta: {
    ...typography.bodySm,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primaryTint,
  },
  contactText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.ink,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.stage,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 22,
  },
  statLabel: {
    ...typography.bodySm,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(24, 26, 32, 0.08)',
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
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serviceRowCompact: {
    gap: 8,
  },
  service: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  serviceCompact: {
    paddingHorizontal: 10,
  },
  serviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  serviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  serviceCount: {
    ...typography.metric,
  },
  serviceFooter: {
    marginTop: 8,
    minHeight: 28,
    justifyContent: 'center',
  },
  serviceButton: {
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.primaryTint,
  },
  serviceButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  hoursStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  petCard: {
    gap: 14,
    borderRadius: radii.xl,
    overflow: 'hidden',
    paddingTop: 20,
  },
  petAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: colors.coral,
    experimental_backgroundImage: `linear-gradient(90deg, ${colors.coral}, ${colors.amber})`,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  petCopy: {
    flex: 1,
    gap: 4,
  },
  petName: {
    ...typography.title,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primaryTint,
  },
  traitText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primary,
  },
  vetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
  },
  vetOverline: {
    ...typography.overline,
    color: colors.primary,
  },
  vetWhen: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  petTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  // Narrow phones: each tab grows from its label's width, so the longest label keeps its padding.
  petTabCompact: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    paddingHorizontal: 4,
  },
  petTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  petTabText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
    textAlign: 'center',
  },
  petTabTextActive: {
    fontFamily: fonts.bold,
    color: colors.onPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  infoValue: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
    flexShrink: 1,
    textAlign: 'right',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    ...typography.label,
    fontSize: 14,
  },
  guide: {
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  chipPressed: {
    backgroundColor: colors.stage,
    borderColor: colors.coral,
    transform: [{ scale: 0.96 }],
  },
  chipText: {
    ...typography.label,
  },
  lunaCard: {
    gap: 12,
  },
  lunaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lunaAvatar: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amberTint,
  },
  lunaEmoji: {
    fontSize: 32,
  },
  lunaName: {
    ...typography.subhead,
    fontSize: 17,
  },
  lunaDetails: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  listCard: {
    paddingVertical: 4,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  spaAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.coralTint,
  },
  teamAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  accountPanel: {
    paddingLeft: 52,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  logout: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
  },
  logoutText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.coralInk,
  },
  version: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: -14,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
