import React, { useState } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { CircularProgress } from '../components/CircularProgress';
import { Toast } from '../components/Toast';
import { BottomNavigation, TabKey } from '../components/BottomNavigation';

export const DashboardScreen: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [treatsLeft, setTreatsLeft] = useState(3);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [soundIndex, setSoundIndex] = useState(0);

  // Corgi mascot wiggle animation
  const [mascotBounce] = useState(() => new Animated.Value(0));
  const [mascotRotate] = useState(() => new Animated.Value(0));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handlePetMascot = () => {
    const sounds = [
      'Woof! Barnaby did a happy spin! 🐾',
      '*Tail wags furiously at supersonic speed* 🐶',
      "Barnaby brought his leash to your feet! Let's go!",
      'Arf! Ready for squirrel patrol!',
    ];
    const phrase = sounds[soundIndex % sounds.length];
    setSoundIndex((prev) => prev + 1);
    showToast(phrase);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(mascotBounce, {
          toValue: -12,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(mascotRotate, {
          toValue: -1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(mascotBounce, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleDispenseTreat = () => {
    if (treatsLeft > 0) {
      const next = treatsLeft - 1;
      setTreatsLeft(next);
      showToast('🦴 *Crunch crunch!* Barnaby caught the biscuit!');
    }
  };

  const corgiRotateInterpolation = mascotRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Toast visible={toastVisible} message={toastMessage} />

      {/* Top App Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Icon name="pets" size={20} color={colors.onPrimaryFixed} />
          </View>
          <View>
            <Text style={styles.brandTitle}>PAWPULSE</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => showToast('All pet alerts up to date 🔔')}
            style={styles.iconButton}
          >
            <Icon name="notifications" size={22} color={colors.onSurfaceVariant} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => showToast('Viewing Sarah & Barnaby profile 🐾')}
          >
            <Image
              source={require('../../assets/profile_avatar.png')}
              style={styles.avatarImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Greeting Card with Mascot */}
        <View style={styles.heroCard}>
          {/* Ambient Warm Blur accents */}
          <View style={styles.blurTopLeft} />
          <View style={styles.blurBottomRight} />

          {/* Left Column Content */}
          <View style={styles.heroLeftCol}>
            <View style={styles.feelingPill}>
              <Text style={{ fontSize: 11 }}>🐾</Text>
              <Text style={styles.feelingText}>Barnaby is feeling playful!</Text>
            </View>

            <Text style={styles.welcomeTitle}>
              Welcome back,{'\n'}
              <Text style={{ color: colors.primary }}>Sarah & Barnaby!</Text>
            </Text>

            <Text style={styles.welcomeSubtitle} numberOfLines={2}>
              Ready for the afternoon walk & agility park run?
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDispenseTreat}
              disabled={treatsLeft === 0}
              style={[
                styles.treatButton,
                treatsLeft === 0 && styles.treatButtonDisabled,
              ]}
            >
              <Icon name="redeem" size={18} color={colors.onSecondaryContainer} />
              <Text style={styles.treatButtonText}>
                {treatsLeft > 0 ? `Dispense Treat (${treatsLeft})` : 'No treats left'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Column Mascot */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePetMascot}
            style={styles.heroRightCol}
          >
            <Animated.View
              style={[
                styles.mascotContainer,
                {
                  transform: [
                    { translateY: mascotBounce },
                    { rotate: corgiRotateInterpolation },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../assets/corgi_dashboard.png')}
                style={styles.dashboardCorgiImg}
                resizeMode="contain"
              />
              <View style={styles.sparkleIcon}>
                <Icon name="auto-awesome" size={18} color={colors.tertiaryFixedDim} />
              </View>
            </Animated.View>
            <View style={styles.tapPill}>
              <Text style={styles.tapPillText}>TAP TO PET</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Care Actions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Care Actions</Text>
            <TouchableOpacity onPress={() => showToast('Customizing quick action tiles')}>
              <Text style={styles.sectionLink}>Customize</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsGrid}>
            {/* Walk */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast('Walk logged! Timer started 🦮')}
              style={styles.actionCard}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryFixed }]}>
                <Icon name="directions-walk" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Log Walk</Text>
            </TouchableOpacity>

            {/* Feed */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast('Dinner bowl recorded! 🍲')}
              style={styles.actionCard}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.secondaryFixed }]}>
                <Icon name="restaurant" size={24} color={colors.secondary} />
              </View>
              <Text style={styles.actionLabel}>Feed Now</Text>
            </TouchableOpacity>

            {/* Meds */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast('Supplements marked complete! 💊')}
              style={styles.actionCard}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryFixed }]}>
                <Icon name="medication" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Log Meds</Text>
            </TouchableOpacity>

            {/* Water Bowl */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast('Fresh water bowl recorded! 💧')}
              style={styles.actionCard}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryFixed }]}>
                <Icon name="water-drop" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Refill Bowl</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Health & Activity (Bento Section) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Today's Health & Activity"}</Text>
            <Text style={styles.sectionMeta}>Goal: 4.0 km</Text>
          </View>

          {/* Daily Active Walking Card */}
          <View style={styles.walkCard}>
            <View style={styles.walkLeft}>
              <View style={styles.walkTitleRow}>
                <Icon name="directions-run" size={18} color={colors.primary} />
                <Text style={styles.walkTitle}>Daily Active Walking</Text>
              </View>
              <View style={styles.walkMetricRow}>
                <Text style={styles.walkMetricMain}>3.2</Text>
                <Text style={styles.walkMetricSub}>/ 4.0 km</Text>
              </View>
              <View style={styles.walkStatusRow}>
                <View style={styles.activePulseDot} />
                <Text style={styles.walkStatusText}>80% completed • 42 mins active</Text>
              </View>
            </View>

            <CircularProgress percentage={80} size={64} strokeWidth={6} />
          </View>

          {/* Two-Column Bento Tiles */}
          <View style={styles.bentoRow}>
            {/* Nutrition Card */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoTopRow}>
                <View style={[styles.bentoIcon, { backgroundColor: colors.secondaryFixed }]}>
                  <Icon name="set-meal" size={20} color={colors.secondary} />
                </View>
                <View style={styles.bentoBadgeNeutral}>
                  <Text style={styles.bentoBadgeText}>On track</Text>
                </View>
              </View>
              <View style={styles.bentoContent}>
                <Text style={styles.bentoValue}>2 of 2</Text>
                <Text style={styles.bentoSub}>Meals Served</Text>
                <View style={styles.bentoFootnote}>
                  <Icon name="check-circle" size={13} color={colors.tertiary} />
                  <Text style={styles.bentoFootnoteText}>Bone broth added</Text>
                </View>
              </View>
            </View>

            {/* Vet Card */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoTopRow}>
                <View style={[styles.bentoIcon, { backgroundColor: colors.primaryFixed }]}>
                  <Icon name="medical-services" size={20} color={colors.primary} />
                </View>
                <View style={styles.bentoBadgePrimary}>
                  <Text style={[styles.bentoBadgeText, { color: colors.onPrimaryFixed }]}>
                    Annual
                  </Text>
                </View>
              </View>
              <View style={styles.bentoContent}>
                <Text style={styles.bentoValue}>12 Days</Text>
                <Text style={styles.bentoSub}>Vet Checkup</Text>
                <View style={styles.bentoFootnote}>
                  <Icon name="location-on" size={13} color={colors.onSurfaceVariant} />
                  <Text style={styles.bentoFootnoteText} numberOfLines={1}>
                    Dr. Aris Wells
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Barnaby's Day So Far Timeline */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Barnaby's Day So Far"}</Text>
            <TouchableOpacity onPress={() => showToast('Full history log loaded')}>
              <Text style={styles.sectionLink}>View History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timelineList}>
            {/* Item 1: Riverside Walk */}
            <View style={styles.timelineCard}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineIconCircle, { backgroundColor: colors.primaryFixed }]}>
                  <Icon name="park" size={22} color={colors.primary} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineHeadline}>Sunny Riverside Walk</Text>
                  <Text style={styles.timelineSubtitle}>32 mins • Made a beagle friend!</Text>
                </View>
              </View>
              <Text style={styles.timelineTime}>08:15 AM</Text>
            </View>

            {/* Item 2: Breakfast Kibble */}
            <View style={styles.timelineCard}>
              <View style={styles.timelineLeft}>
                <View
                  style={[styles.timelineIconCircle, { backgroundColor: colors.secondaryFixed }]}
                >
                  <Icon name="soup-kitchen" size={22} color={colors.secondary} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineHeadline}>Breakfast Kibble + Broth</Text>
                  <Text style={styles.timelineSubtitle}>1.5 cups slow-feeder cleared</Text>
                </View>
              </View>
              <Text style={styles.timelineTime}>07:30 AM</Text>
            </View>

            {/* Item 3: Glucosamine Chew */}
            <View style={styles.timelineCard}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineIconCircle,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Icon name="health-and-safety" size={22} color={colors.tertiary} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineHeadline}>Daily Glucosamine Chew</Text>
                  <Text style={styles.timelineSubtitle}>Joint support treat accepted</Text>
                </View>
              </View>
              <Text style={styles.timelineTime}>07:35 AM</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'home') {
            showToast(`${tab.toUpperCase()} section loaded`);
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  headerTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.onSurface,
    lineHeight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryContainer,
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 20,
  },
  heroCard: {
    width: '100%',
    backgroundColor: colors.onTertiaryContainer,
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.card,
  },
  blurTopLeft: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 221, 180, 0.4)',
  },
  blurBottomRight: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 218, 210, 0.5)',
  },
  heroLeftCol: {
    flex: 1,
    maxWidth: '58%',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  feelingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.secondaryFixed,
  },
  feelingText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onSecondaryFixedVariant,
  },
  welcomeTitle: {
    ...typography.headlineMd,
    fontWeight: '800',
    color: colors.onSurface,
    marginTop: 6,
    lineHeight: 24,
  },
  welcomeSubtitle: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  treatButton: {
    marginTop: 12,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...shadows.card,
  },
  treatButtonDisabled: {
    opacity: 0.6,
  },
  treatButtonText: {
    ...typography.labelMd,
    color: colors.onSecondaryContainer,
    fontWeight: '700',
  },
  heroRightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  mascotContainer: {
    width: 105,
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dashboardCorgiImg: {
    width: 100,
    height: 100,
  },
  sparkleIcon: {
    position: 'absolute',
    top: 0,
    right: 2,
  },
  tapPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.card,
  },
  tapPillText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.secondary,
    letterSpacing: 0.6,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.headlineSm,
    fontSize: 17,
    color: colors.onSurface,
  },
  sectionLink: {
    ...typography.labelSm,
    color: colors.primary,
    fontWeight: '600',
  },
  sectionMeta: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.card,
  },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.onSurface,
    fontWeight: '600',
  },
  walkCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  walkLeft: {
    flex: 1,
  },
  walkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walkTitle: {
    ...typography.labelMd,
    color: colors.onSurface,
    fontWeight: '600',
  },
  walkMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  walkMetricMain: {
    ...typography.headlineLg,
    fontSize: 26,
    color: colors.onSurface,
    fontWeight: '800',
  },
  walkMetricSub: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  walkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  activePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  walkStatusText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 125,
    ...shadows.card,
  },
  bentoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoBadgeNeutral: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
  },
  bentoBadgePrimary: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
  },
  bentoBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onSurface,
    fontWeight: '600',
  },
  bentoContent: {
    marginTop: 8,
  },
  bentoValue: {
    ...typography.headlineSm,
    fontSize: 17,
    color: colors.onSurface,
    fontWeight: '700',
  },
  bentoSub: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  bentoFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  bentoFootnoteText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.tertiary,
    fontWeight: '600',
  },
  timelineList: {
    gap: 10,
  },
  timelineCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  timelineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  timelineIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTextCol: {
    flex: 1,
  },
  timelineHeadline: {
    ...typography.headlineSm,
    fontSize: 15,
    color: colors.onSurface,
    fontWeight: '600',
  },
  timelineSubtitle: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  timelineTime: {
    ...typography.labelSm,
    color: colors.outline,
    fontWeight: '500',
  },
});
