import React, { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../theme/motion';
import { useResponsive } from '../theme/responsive';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { withVersion } from '../config/appInfo';

/** The hero-circle slot is 220px at the design size (it shrinks on short phones); the orbs float just outside it. */
const HERO_SIZE = 220;

export function SplashScreen() {
  const { go } = useAppNavigation();
  const { bark } = useMascotActions();
  const { delight } = useMascotStatus();
  const heroSize = useResponsive().scaleHeight(HERO_SIZE);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Badge label={`🐾 ${withVersion('PawPal Care Engine')}`} tone="white" style={styles.versionTag} />

        <View style={styles.heroGroup}>
          <View style={[styles.hero, { width: heroSize + 40, height: heroSize + 12 }]}>
            <View style={[styles.orb, styles.orbAmber]} />
            <View style={[styles.orb, styles.orbCoral]} />
            <View style={[styles.orb, styles.orbBlue]} />
            <MascotDockSlot variant="hero-circle" />
          </View>

          <Pressable
            onPress={bark}
            accessibilityRole="button"
            style={({ pressed }) => [styles.petPill, pressed && styles.pressed]}
          >
            <Text style={styles.petPillText}>❤️ Tap Barnaby to pet</Text>
          </Pressable>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>PawPal</Text>
          <Text style={styles.subtitle}>Your loyal daily pet health, wellness & routine buddy</Text>
        </View>

        <DelightCard count={delight} onPress={bark} />

        <PrimaryButton
          label="Tap to Begin"
          onPress={() => go('begin')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Live petting counter; tapping it pets Barnaby too. */
function DelightCard({ count, onPress }: { count: number; onPress: () => void }) {
  const [pop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (count === 0) return;
    pop.setValue(1.18);
    Animated.spring(pop, {
      toValue: 1,
      damping: 8,
      stiffness: 260,
      mass: 1,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [count, pop]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Petting delight count ${count}. Tap to pet Barnaby.`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: colors.primaryTint }]}>
          <Icon name="favorite" size={20} color={colors.coral} />
        </View>
        <Badge label="Live" tone="coral" dot />
      </View>
      <Text style={styles.cardLabel}>Petting Delight</Text>
      <View style={styles.delightRow}>
        <Animated.Text style={[styles.delightCount, { transform: [{ scale: pop }] }]}>
          {count}
        </Animated.Text>
        <Text style={styles.delightUnit}>{count === 1 ? 'happy pet' : 'happy pets'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  versionTag: {
    alignSelf: 'center',
    ...shadows.soft,
  },
  heroGroup: {
    alignItems: 'center',
    gap: 6,
  },
  hero: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: radii.full,
  },
  orbAmber: {
    top: 10,
    right: 18,
    width: 22,
    height: 22,
    backgroundColor: colors.amber,
    opacity: 0.55,
  },
  orbCoral: {
    bottom: 26,
    left: 10,
    width: 16,
    height: 16,
    backgroundColor: colors.coral,
    opacity: 0.45,
  },
  orbBlue: {
    top: 54,
    left: 22,
    width: 10,
    height: 10,
    backgroundColor: colors.primary,
    opacity: 0.25,
  },
  petPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.coralTint,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 74, 0.25)',
  },
  petPillText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.coralInk,
  },
  copy: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.display,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    padding: 14,
    gap: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    ...typography.overline,
  },
  delightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  delightCount: {
    ...typography.metric,
    fontSize: 24,
    lineHeight: 28,
    color: colors.coral,
  },
  delightUnit: {
    ...typography.bodySm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
