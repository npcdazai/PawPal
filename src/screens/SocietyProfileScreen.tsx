import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { FormField } from '../components/FormField';
import { ActionSheet } from '../components/ActionSheet';
import { Toast, useToast } from '../components/Toast';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings } from '../booking/BookingsProvider';
import { DEFAULT_GEAR, GEAR, TEMPERAMENTS, type GearKey, type Temperament } from '../booking/dogProfile';
import {
  DEFAULT_SOCIETY,
  SOCIETIES,
  SOCIETY_KEYS,
  nearestSociety,
  supplyLine,
  towerCode,
  towerName,
  type SocietyKey,
} from '../booking/societies';
import { BATCHES, INSURANCE_COVER, formatMoney } from '../booking/walkPlans';
import { currentPosition, warmUpLocation } from '../booking/geocoding';
import { loadPetCareStyle } from '../maps/petCareStyle';

const FOOTER_HEIGHT = 128;
/** A partner township within this distance of the GPS fix counts as "you live here". */
const DETECT_RADIUS_KM = 3;

/** Screen 5 — SOCIETY_TRUST_SETUP: lock the gated township and Barnaby's handling profile. */
export function SocietyProfileScreen() {
  const insets = useSafeAreaInsets();
  const { go } = useAppNavigation();
  const { glance, barkWith, focusField, blurField } = useMascotActions();
  const { societyProfile, setSocietyProfile } = useBookings();
  const params = useLocalSearchParams<{ walker?: string }>();
  const { message, show } = useToast();

  const [society, setSociety] = useState<SocietyKey>(societyProfile?.society ?? DEFAULT_SOCIETY);
  const [tower, setTower] = useState(societyProfile?.tower ?? '');
  const [flat, setFlat] = useState(societyProfile?.flat ?? '');
  const [temperament, setTemperament] = useState<Temperament | null>(societyProfile?.temperament ?? null);
  const [gear, setGear] = useState<readonly GearKey[]>(societyProfile?.gear ?? DEFAULT_GEAR);
  const [notes, setNotes] = useState(societyProfile?.notes ?? '');
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);

  const place = SOCIETIES[society];
  const checks = [
    { done: towerCode(tower) !== null, missing: 'Add your Wing / Tower' },
    { done: flat.trim().length > 0, missing: 'Add your flat number' },
    { done: temperament !== null, missing: 'Pick Barnaby’s leash behaviour' },
    { done: gear.length > 0, missing: 'Pick at least one gear / handover rule' },
  ];
  const doneCount = checks.filter((check) => check.done).length;
  const complete = doneCount === checks.length;

  // Warm up the map style and GPS so the walker screens open straight onto the township.
  useEffect(() => {
    void loadPetCareStyle();
    void warmUpLocation();
  }, []);

  // Barnaby barks once the safety profile is complete (not when it opens already filled in).
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) barkWith('Woof! Safety profile done 🛡️');
    wasComplete.current = complete;
  }, [complete, barkWith]);

  const chooseTemperament = (key: Temperament) => {
    setTemperament(key);
    glance();
  };

  const toggleGear = (key: GearKey) => {
    setGear((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
    glance();
  };

  const chooseSociety = (key: SocietyKey) => {
    setPicking(false);
    if (key === society) return;
    setSociety(key);
    setTower('');
    glance();
  };

  const detectSociety = async () => {
    if (locating) return;
    setLocating(true);
    const here = await currentPosition();
    setLocating(false);
    if (!here) {
      show('Couldn’t get your location — pick your society from the list');
      return;
    }
    const nearest = nearestSociety(here);
    if (nearest.km <= DETECT_RADIUS_KM) {
      chooseSociety(nearest.society.key);
      show(`📍 You’re in ${nearest.society.shortName} (${nearest.km.toFixed(1)} km)`);
    } else {
      show(`Nearest partner township is ${nearest.society.shortName}, ${Math.round(nearest.km)} km away`);
    }
  };

  const continueToPlan = () => {
    const missing = checks.find((check) => !check.done);
    if (missing || !temperament) {
      glance();
      show(missing?.missing ?? 'Complete the safety profile');
      return;
    }
    setSocietyProfile({
      society,
      tower: towerName(tower),
      flat: flat.trim(),
      temperament,
      gear,
      notes: notes.trim(),
    });
    go('chooseWalkPlan', typeof params.walker === 'string' ? { walker: params.walker } : undefined);
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
        <Text style={styles.topTitle} numberOfLines={1}>
          Society & Behavioral Profile
        </Text>
        <View style={styles.headerAvatar}>
          <Image source={require('../../assets/corgi_mascot.png')} style={styles.headerAvatarImage} contentFit="cover" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: FOOTER_HEIGHT + insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: Barnaby verifying the profile */}
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>🏘️ HYPER-LOCAL SOCIETY MATCHING</Text>
          </View>
          <View style={styles.portrait}>
            <MascotDockSlot variant="popup" diameter={128} />
          </View>
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>🐾 Barnaby {complete ? 'Verified' : 'Profile'}</Text>
          </View>
          <Text style={styles.heroTitle}>Trust & Safety Setup</Text>
          <Text style={styles.heroSubtitle}>
            Assigning dedicated township walkers who never get delayed by traffic.
          </Text>
        </View>

        {/* Gated community */}
        <View style={styles.card}>
          <View style={styles.spaceBetween}>
            <Text style={styles.cardTitle}>Your Gated Community</Text>
            <Badge label="Township Hub" />
          </View>

          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            aria-label={`Gated society: ${place.label}. Change`}
            style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
          >
            <Text style={styles.selectorText} numberOfLines={1}>
              📍 {place.label}
            </Text>
            <Icon name="expand-more" size={22} color={colors.slate} />
          </Pressable>
          <Pressable onPress={detectSociety} accessibilityRole="button" hitSlop={6} style={styles.detectRow}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="my-location" size={16} color={colors.primary} />
            )}
            <Text style={styles.detectText}>{locating ? 'Finding your township…' : 'Detect my society with GPS'}</Text>
          </Pressable>

          <View style={styles.addressRow}>
            <View style={styles.flex}>
              <FormField
                label="Wing / Tower"
                icon="apartment"
                value={tower}
                onChangeText={setTower}
                placeholder={`e.g. Tower ${place.towers[1]}`}
                autoCapitalize="characters"
                complete={tower ? towerCode(tower) !== null : undefined}
                onFocus={() => focusField('text')}
                onBlur={blurField}
              />
            </View>
            <View style={styles.flex}>
              <FormField
                label="Flat Number"
                icon="door-front"
                value={flat}
                onChangeText={setFlat}
                placeholder="e.g. 1204"
                keyboardType="number-pad"
                complete={flat ? flat.trim().length > 0 : undefined}
                onFocus={() => focusField('text')}
                onBlur={blurField}
              />
            </View>
          </View>

          <View style={styles.supply}>
            <Icon name="verified" size={20} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.supplyTitle}>{supplyLine(place)}</Text>
              <Text style={styles.meta}>
                Evening batch: {BATCHES.evening.range} • Passes on {place.gateApp}
              </Text>
            </View>
          </View>
          <View style={styles.inlineRow}>
            <Icon name="info-outline" size={15} color={colors.slate} />
            <Text style={[styles.meta, styles.flex]}>
              High-density batching: walkers operate exclusively inside your complex.
            </Text>
          </View>
        </View>

        {/* Behavioural & handling profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dog Behavioral & Handling Profile</Text>
          <Text style={styles.meta}>Mandatory — it decides your walker and which plans are safe to book.</Text>

          <Text style={styles.label}>Temperament & Leash Behavior (select 1)</Text>
          <View style={styles.options} role="radiogroup">
            {TEMPERAMENTS.map((option) => {
              const selected = temperament === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => chooseTemperament(option.key)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.label}</Text>
                    <Text style={styles.meta}>{option.detail}</Text>
                  </View>
                  <Icon
                    name={selected ? 'check-circle' : 'radio-button-unchecked'}
                    size={22}
                    color={selected ? colors.primary : colors.placeholder}
                  />
                </Pressable>
              );
            })}
          </View>

          {temperament === 'pulls' ? (
            <View style={[styles.notice, styles.noticeAmber]}>
              <Text style={styles.noticeText}>
                🏋️ {place.shortName}’s heavy-duty certified walker will be assigned to Barnaby.
              </Text>
            </View>
          ) : null}
          {temperament === 'reactive' ? (
            <View style={[styles.notice, styles.noticeCoral]}>
              <Text style={styles.noticeText}>
                🛡️ First-time SOS Express walks stay locked. Start with a ₹99 Meet & Greet or a walker Barnaby already
                knows.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Mandatory Gear & Handover Protocol</Text>
          <View style={styles.options}>
            {GEAR.map((item) => {
              const selected = gear.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => toggleGear(item.key)}
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={item.label}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.optionEmoji}>{item.emoji}</Text>
                  <Text style={[styles.optionTitle, styles.flex, selected && styles.optionTitleSelected]}>
                    {item.label}
                  </Text>
                  <Icon
                    name={selected ? 'check-circle' : 'add-circle-outline'}
                    size={22}
                    color={selected ? colors.primary : colors.placeholder}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Specific Instructions for Walker</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="e.g. Prefers the inner garden track; avoid clubhouse stairs during the morning rush…"
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            aria-label="Instructions for the walker"
            style={styles.notesInput}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />
        </View>

        {/* The moat */}
        <View style={styles.moat}>
          <View style={styles.moatIcon}>
            <Icon name="shield" size={22} color={colors.coralInk} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.moatTitle}>Zero-Ghosting Backup + {formatMoney(INSURANCE_COVER)} Vet Cover</Text>
            <Text style={styles.meta}>
              If your regular walker is ever absent, a pre-briefed backup walker from your society steps in
              automatically. Zero disruption, full insurance.
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value="100%" label="Background Verified" />
          <Stat value="GPS" label="Real-time Tracking" />
          <Stat value="₹0" label="Cancellation Fee" />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.spaceBetween}>
          <Text style={styles.meta}>Safety profile</Text>
          <Text style={[styles.progressText, complete && styles.progressDone]}>
            {complete ? '✓ Complete' : `${doneCount} of ${checks.length} done`}
          </Text>
        </View>
        <PrimaryButton
          label="Choose Walk Plan & Slot"
          onPress={continueToPlan}
          style={complete ? undefined : styles.ctaPending}
        />
      </View>

      <Toast message={message} bottomOffset={FOOTER_HEIGHT + 8} />

      {picking ? (
        <ActionSheet
          title="Your gated township"
          subtitle="PawPal walkers work inside these complexes only"
          options={SOCIETY_KEYS.map((key) => ({
            icon: key === society ? 'check-circle' : 'apartment',
            label: SOCIETIES[key].label,
            detail: `${SOCIETIES[key].walkers} dedicated walkers • ${SOCIETIES[key].gateApp} passes`,
            onPress: () => chooseSociety(key),
          }))}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  topTitle: {
    ...typography.headline,
    flexShrink: 1,
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
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 22,
    paddingHorizontal: 18,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  heroPillText: {
    fontFamily: fonts.extrabold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.ink,
  },
  portrait: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    marginTop: 4,
    ...shadows.card,
  },
  verifiedPill: {
    marginTop: -18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.amberTint,
    borderWidth: 2,
    borderColor: colors.card,
  },
  verifiedText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.amberInk,
  },
  heroTitle: {
    ...typography.title,
    fontSize: 22,
    marginTop: 4,
  },
  heroSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardTitle: {
    ...typography.headline,
    fontSize: 17,
  },
  selector: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  selectorText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  detectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  detectText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  supply: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
  },
  supplyTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink,
  },
  meta: {
    ...typography.bodySm,
  },
  label: {
    ...typography.label,
    marginTop: 4,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: colors.ink,
  },
  optionTitleSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  notice: {
    padding: 12,
    borderRadius: radii.md,
  },
  noticeAmber: {
    backgroundColor: colors.amberTint,
  },
  noticeCoral: {
    backgroundColor: colors.coralTint,
  },
  noticeText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink,
  },
  notesInput: {
    minHeight: 80,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    textAlignVertical: 'top',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  moat: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.stage,
  },
  moatIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  moatTitle: {
    ...typography.subhead,
    marginBottom: 2,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.ink,
  },
  statLabel: {
    ...typography.bodySm,
    fontSize: 11,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    boxShadow: '0px -10px 30px rgba(24, 26, 32, 0.08)',
  },
  progressText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coralInk,
  },
  progressDone: {
    color: colors.successInk,
  },
  ctaPending: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
