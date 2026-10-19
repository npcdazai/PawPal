import React, { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { ProgressBar } from '../components/ProgressBar';
import { Toggle } from '../components/Toggle';
import { Toast, useToast } from '../components/Toast';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNavigation';
import { MascotAnchor, MascotScrollView } from '../mascot/MascotAnchor';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import type { ViewHandle } from '../mascot/MascotMachine';
import { useAppNavigation } from '../navigation/useAppNavigation';

const MASCOT_SIZE = 140;

const ACHIEVEMENTS = [
  { emoji: '🔥', title: '14-Day Streak', detail: 'Daily care logged', progress: 1 },
  { emoji: '🦮', title: '100 km Club', detail: '86 / 100 km walked', progress: 0.86 },
  { emoji: '🩺', title: 'Vet Visit Ace', detail: 'Annual check-up done', progress: 1 },
  { emoji: '🦴', title: 'Treat Taster', detail: '15 / 20 treats', progress: 0.75 },
];

const FAVOURITES = [
  '🎾 Tennis balls',
  '🐿️ Squirrel patrol',
  '🥕 Carrot crunch',
  '💤 Sofa naps',
  '🛁 Definitely not baths',
];

export function ProfileScreen() {
  const { go } = useAppNavigation();
  const { bark, setHapticsEnabled } = useMascotActions();
  const { delight, hapticsEnabled } = useMascotStatus();
  const { message, show } = useToast();
  const identityRef = useRef<ViewHandle>(null);

  const [walkReminders, setWalkReminders] = useState(true);
  const [mealReminders, setMealReminders] = useState(true);

  const goBack = () => go('closeProfile');
  const logOut = () => go('signOut');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MascotScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Icon name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>Profile</Text>
          <View style={styles.iconButtonSpacer} />
        </View>

        {/* Barnaby hero: he stands on the identity card */}
        <View style={styles.hero}>
          <View style={styles.heroBadges}>
            <Badge label="Playful Pup 🍊" tone="amber" />
            <Badge label="PawID #BRN-2041" tone="primary" />
          </View>
          <MascotAnchor id="profile" size={MASCOT_SIZE} clipRef={identityRef} />
          <View ref={identityRef} style={styles.identity}>
            <View style={styles.identityCopy}>
              <Text style={styles.petName}>Barnaby</Text>
              <Text style={styles.petBreed}>Pembroke Welsh Corgi · Tap him for a woof</Text>
            </View>
            <View style={styles.stats}>
              <Stat value="3 yrs" label="Age" />
              <View style={styles.statDivider} />
              <Stat value="12.4 kg" label="Weight" />
              <View style={styles.statDivider} />
              <Stat value={String(delight)} label="Pets today" accent />
            </View>
          </View>
        </View>

        {/* Pet parent */}
        <View style={[styles.card, styles.ownerCard]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
          <View style={styles.ownerCopy}>
            <Text style={styles.ownerName}>Sarah</Text>
            <Text style={styles.meta}>sarah@companions.pet</Text>
          </View>
          <Badge label="Pet parent" tone="coral" style={styles.centerSelf} />
        </View>

        <Section title="Health Passport" meta="Updated today">
          <View style={styles.card}>
            <Row icon="vaccines" tint={colors.successTint} ink={colors.successInk} label="Vaccinations">
              <Badge label="Up to date" tone="success" dot />
            </Row>
            <Row icon="medical-services" tint={colors.primaryTint} ink={colors.primary} label="Primary vet">
              <Text style={styles.rowValue}>Dr. Ava Wells</Text>
            </Row>
            <Row icon="memory" tint={colors.amberTint} ink={colors.amberInk} label="Microchip">
              <Text style={styles.rowValue}>985 112 004 517</Text>
            </Row>
            <Row icon="no-food" tint={colors.coralTint} ink={colors.coral} label="Allergies" last>
              <Badge label="Chicken" tone="coral" />
            </Row>
          </View>
        </Section>

        <Section title="Achievements" meta="3 of 4 earned">
          <View style={styles.achievementGrid}>
            {ACHIEVEMENTS.map((achievement) => {
              const earned = achievement.progress >= 1;
              return (
                <View key={achievement.title} style={[styles.card, styles.achievement]}>
                  <View style={styles.achievementTop}>
                    <View style={[styles.achievementIcon, earned && styles.achievementIconEarned]}>
                      <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                    </View>
                    {earned ? <Icon name="verified" size={18} color={colors.primary} /> : null}
                  </View>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.meta}>{achievement.detail}</Text>
                  <ProgressBar
                    progress={achievement.progress}
                    color={earned ? colors.success : colors.amber}
                    height={6}
                  />
                </View>
              );
            })}
          </View>
        </Section>

        <Section title="Favourite Things" meta="Tap one">
          <View style={styles.chips}>
            {FAVOURITES.map((favourite) => (
              <Pressable
                key={favourite}
                onPress={bark}
                accessibilityRole="button"
                accessibilityHint="Barnaby woofs happily"
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipText}>{favourite}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Preferences">
          <View style={styles.card}>
            <Row
              icon="notifications-active"
              tint={colors.primaryTint}
              ink={colors.primary}
              label="Walk reminders"
              detail="7:30 AM & 6:00 PM"
            >
              <Toggle
                accessibilityLabel="Walk reminders"
                value={walkReminders}
                onValueChange={(next) => {
                  setWalkReminders(next);
                  show(next ? 'Walk reminders on 🦮' : 'Walk reminders paused');
                }}
              />
            </Row>
            <Row
              icon="restaurant"
              tint={colors.stage}
              ink={colors.coral}
              label="Meal reminders"
              detail="8:00 AM & 7:00 PM"
            >
              <Toggle
                accessibilityLabel="Meal reminders"
                value={mealReminders}
                onValueChange={(next) => {
                  setMealReminders(next);
                  show(next ? 'Meal reminders on 🍲' : 'Meal reminders paused');
                }}
              />
            </Row>
            <Row
              icon="vibration"
              tint={colors.amberTint}
              ink={colors.amberInk}
              label="Haptic paw taps"
              detail="Feel Barnaby arrive and woof"
              last
            >
              <Toggle
                accessibilityLabel="Haptic paw taps"
                value={hapticsEnabled}
                onValueChange={(next) => {
                  setHapticsEnabled(next);
                  show(next ? 'Paw taps on 🐾' : 'Paw taps off');
                }}
              />
            </Row>
          </View>
        </Section>

        <Pressable
          onPress={logOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        >
          <Icon name="logout" size={20} color={colors.coralInk} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.version}>🐾 Pawsome Care Engine v2.4</Text>
      </MascotScrollView>

      <Toast message={message} bottomOffset={BOTTOM_NAV_HEIGHT + 28} />
    </SafeAreaView>
  );
}

function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

interface RowProps {
  icon: string;
  tint: string;
  ink: string;
  label: string;
  detail?: string;
  last?: boolean;
  children: ReactNode;
}

function Row({ icon, tint, ink, label, detail, last = false, children }: RowProps) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={20} color={ink} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.meta}>{detail}</Text> : null}
      </View>
      <View style={styles.rowTrailing}>{children}</View>
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
    paddingBottom: BOTTOM_NAV_HEIGHT + 48,
    gap: 22,
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
  hero: {
    alignItems: 'center',
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
  },
  heroBadges: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identity: {
    alignSelf: 'stretch',
    marginTop: -16,
    padding: 16,
    gap: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  identityCopy: {
    alignItems: 'center',
    gap: 2,
  },
  petName: {
    ...typography.title,
  },
  petBreed: {
    ...typography.body,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    color: colors.ink,
  },
  statValueAccent: {
    color: colors.coral,
  },
  statLabel: {
    ...typography.bodySm,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
  },
  card: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.card,
  },
  centerSelf: {
    alignSelf: 'center',
  },
  ownerCopy: {
    flex: 1,
    gap: 2,
  },
  ownerName: {
    ...typography.subhead,
  },
  meta: {
    ...typography.bodySm,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.label,
    fontSize: 14,
  },
  rowTrailing: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.slate,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  achievement: {
    width: '48%',
    gap: 6,
    padding: 14,
  },
  achievementTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amberTint,
  },
  achievementIconEarned: {
    backgroundColor: colors.stage,
  },
  achievementEmoji: {
    fontSize: 20,
  },
  achievementTitle: {
    ...typography.subhead,
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  logout: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.coralTint,
  },
  logoutText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.coralInk,
  },
  version: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: -8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
