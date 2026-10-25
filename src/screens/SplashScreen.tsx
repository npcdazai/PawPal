import React, { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { PawsomeGradientScreen } from '../components/PawsomeGradientScreen';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import { NATIVE_DRIVER } from '../theme/motion';
import { useResponsive } from '../theme/responsive';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { withVersion } from '../config/appInfo';

/** The hero-circle slot is 220px at the design size (it shrinks on short phones); the orbs float just outside it. */
const HERO_SIZE = 220;
/** How much wider than the stage circle its halo is. */
const HALO_SPREAD = 22;

export function SplashScreen() {
  const { go } = useAppNavigation();
  const { bark } = useMascotActions();
  const { delight } = useMascotStatus();
  const heroSize = useResponsive().scaleHeight(HERO_SIZE);

  return (
    <PawsomeGradientScreen variant="HERO" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Badge label={`🐾 ${withVersion('PawPal Care Engine')}`} tone="white" style={styles.versionTag} />

        <View style={styles.heroGroup}>
          <View style={[styles.hero, { width: heroSize + 40, height: heroSize + 12 }]}>
            {/* A soft sunlit halo behind Barnaby's stage; absolute, so his slot never moves. */}
            <View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  width: heroSize + HALO_SPREAD,
                  height: heroSize + HALO_SPREAD,
                  left: (40 - HALO_SPREAD) / 2,
                  top: (12 - HALO_SPREAD) / 2,
                },
              ]}
            />
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
    </PawsomeGradientScreen>
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
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  // Translucent over the HERO sky: no panel edges.
  versionTag: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
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
  halo: {
    position: 'absolute',
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    boxShadow: '0px 18px 44px rgba(255, 179, 64, 0.28)',
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
    backgroundColor: 'rgba(255, 233, 227, 0.82)',
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
  // Frosted over the sky rather than a solid white box.
  card: {
    padding: 14,
    gap: 4,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    ...shadows.soft,
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
