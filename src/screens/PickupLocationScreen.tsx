import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/Button';
import { Toast, useToast } from '../components/Toast';
import { useMascotActions } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { useBookings } from '../booking/BookingsProvider';
import { FindingWalkersModal } from '../booking/FindingWalkersModal';
import { formatMoney, walkFare } from '../booking/walkPlans';
import { PICKUP_OTP } from '../booking/liveWalk';
import { offsetMeters, type LngLat } from '../booking/geo';
import { currentPosition, reverseGeocode } from '../booking/geocoding';
import {
  PICKUP_PLACES,
  SAVED_PLACES,
  searchPlaces,
  type PlaceKey,
} from '../booking/pickupPlaces';
import { MapMarker, PawMap } from '../maps/PawMap';
import type { PawMapHandle } from '../maps/types';
import {
  BARNABY_PIN_OFFSET,
  BarnabyPin,
  NEARBY_WALKER_OFFSET,
  NearbyWalkerPin,
} from '../maps/MapPins';
import type { WalkerId } from '../data/careTeam';

const SEARCH_BLUR_GRACE_MS = 180;
const PLACE_ZOOM = 16;
const FLY_MS = 900;

/** Walkers pinging the dispatch radar around the pickup while Screen 7 searches. */
const NEARBY_WALKERS = [
  { initials: 'MT', label: '⭐ 4.9 Marcus', tint: colors.primary, east: -230, north: 170 },
  { initials: 'ER', label: '⭐ 5.0 Elena', tint: colors.coral, east: 240, north: 200 },
  { initials: 'DK', label: '⭐ 4.8 David', tint: colors.amber, east: 70, north: -240 },
] as const;

/** Where the walker meets Barnaby: a saved place, GPS fix or dropped pin. */
interface PickupSelection {
  key: PlaceKey;
  lngLat: LngLat;
  line1: string;
  line2: string;
}

const selectionFor = (key: PlaceKey): PickupSelection => {
  const { lngLat, line1, line2 } = PICKUP_PLACES[key];
  return { key, lngLat, line1, line2 };
};

/** The live map centre, observed by Barnaby's pin without re-rendering the screen. */
function createCenterStore(initial: LngLat) {
  let center = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => center,
    set: (next: LngLat) => {
      center = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Screen 6 — pick where the walker collects Barnaby; Screen 7 opens on top. */
export function PickupLocationScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { go } = useAppNavigation();
  const { navigate, focusField, blurField, glance } = useMascotActions();
  const { draft, addBooking } = useBookings();
  const { message, show } = useToast();

  const [selection, setSelection] = useState<PickupSelection>(() => selectionFor('home'));
  const [spotEdits, setSpotEdits] = useState<Partial<Record<PlaceKey, string>>>({});
  const [editingSpot, setEditingSpot] = useState(false);
  const [pickupNotes, setPickupNotes] = useState('');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [center] = useState(() => createCenterStore(PICKUP_PLACES.home.lngLat));
  const mapRef = useRef<PawMapHandle>(null);
  const geocodeSeq = useRef(0);
  const timers = useRef<{ blur?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const pending = timers.current;
    return () => clearTimeout(pending.blur);
  }, []);

  const placeKey = selection.key;
  const place = PICKUP_PLACES[placeKey];
  const spot = spotEdits[placeKey] ?? place.spot;
  const fare = walkFare(draft.minutes, draft.timing);
  const timingLabel = draft.timing === 'instant' ? 'Instant Walk' : (draft.slotLabel ?? 'Scheduled');
  const mapHeight = Math.round(windowHeight * 0.48);
  const results = searchPlaces(query);

  const flyTo = (lngLat: LngLat) => mapRef.current?.flyTo(lngLat, PLACE_ZOOM, FLY_MS);

  const selectPlace = (key: PlaceKey) => {
    geocodeSeq.current += 1;
    setSelection(selectionFor(key));
    setEditingSpot(false);
    flyTo(PICKUP_PLACES[key].lngLat);
    glance();
  };

  /** A position without a saved address: show it at once, then fill in the street. */
  const pinAt = (key: 'gps' | 'pin', lngLat: LngLat) => {
    geocodeSeq.current += 1;
    const seq = geocodeSeq.current;
    setSelection({ key, lngLat, line1: 'Finding the address…', line2: PICKUP_PLACES[key].line2 });
    setEditingSpot(false);
    glance();
    reverseGeocode(lngLat).then((lines) => {
      if (seq !== geocodeSeq.current) return;
      setSelection((current) => ({
        ...current,
        line1: lines?.line1 || PICKUP_PLACES[key].line1,
        line2: lines?.line2 || 'San Francisco',
      }));
    });
  };

  const locateWithGps = async () => {
    if (locating) return;
    setLocating(true);
    const here = await currentPosition();
    setLocating(false);
    if (here) {
      pinAt('gps', here);
      flyTo(here);
    } else {
      show('Location unavailable — using your last known spot');
      selectPlace('gps');
    }
  };

  const chooseResult = (key: PlaceKey) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setQuery('');
    selectPlace(key);
  };

  const findWalkers = () => navigate(() => setSearching(true));

  const finishBooking = (walkerId: WalkerId, etaMinutes: number) => {
    const instant = draft.timing === 'instant';
    addBooking({
      status: instant ? 'enRoute' : 'scheduled',
      timing: draft.timing,
      whenLabel: instant ? `Arriving in ${etaMinutes} mins` : (draft.slotLabel ?? 'Scheduled'),
      minutes: draft.minutes,
      total: fare.total,
      placeKey,
      placeLabel: place.label,
      address: selection.line1,
      pickup: selection.lngLat,
      walkerId,
      otp: PICKUP_OTP,
      etaMinutes,
    });
    // Instant walks go straight to live tracking; scheduled ones wait on the dashboard.
    go(instant ? 'trackWalker' : 'walkBooked');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => go('backToWalkSetup')}
          accessibilityRole="button"
          aria-label="Back"
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Pickup Location</Text>
        <View style={styles.headerAvatar}>
          <Image source={require('../../assets/corgi_mascot.png')} style={styles.headerAvatarImage} />
        </View>
      </View>

      {/* Live map: drag to drop the pin anywhere, or fly to a saved place */}
      <View style={[styles.mapArea, { height: mapHeight }]}>
        <PawMap
          ref={mapRef}
          initialCenter={selection.lngLat}
          initialZoom={PLACE_ZOOM}
          interactive={!searching}
          onCameraChange={center.set}
          onCameraIdle={(lngLat, byUser) => {
            if (byUser) pinAt('pin', lngLat);
          }}
          style={StyleSheet.absoluteFill}
        >
          {/* Barnaby walks out of the pin and into the search dialog. */}
          <PickupPin center={center} active={!searching} />
          {searching
            ? NEARBY_WALKERS.map((walker) => (
                <MapMarker
                  key={walker.initials}
                  lngLat={offsetMeters(selection.lngLat, walker.east, walker.north)}
                  anchor="bottom"
                  offset={NEARBY_WALKER_OFFSET}
                >
                  <NearbyWalkerPin initials={walker.initials} label={walker.label} tint={walker.tint} />
                </MapMarker>
              ))
            : null}
        </PawMap>

        {/* Floating search */}
        <View style={styles.searchRow} pointerEvents="box-none">
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <Icon name="search" size={20} color={colors.primary} />
            <TextInput
              value={searchFocused ? query : selection.line1}
              onChangeText={setQuery}
              placeholder="Search park, street, or landmark..."
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.primary}
              aria-label="Search pickup location"
              returnKeyType="search"
              style={styles.searchInput}
              onFocus={() => {
                clearTimeout(timers.current.blur);
                setQuery('');
                setSearchFocused(true);
                focusField('text');
              }}
              onBlur={() => {
                blurField();
                timers.current.blur = setTimeout(() => setSearchFocused(false), SEARCH_BLUR_GRACE_MS);
              }}
              onSubmitEditing={() => {
                if (results[0]) chooseResult(results[0].key);
              }}
            />
            {searchFocused && query ? (
              <Pressable onPress={() => setQuery('')} aria-label="Clear search" hitSlop={8}>
                <Icon name="cancel" size={18} color={colors.placeholder} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={locateWithGps}
            accessibilityRole="button"
            aria-label="Use current GPS"
            style={({ pressed }) => [styles.gpsButton, pressed && styles.pressed]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="my-location" size={22} color={colors.primary} />
            )}
          </Pressable>
        </View>

        {searchFocused ? (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={styles.results}
            contentContainerStyle={styles.resultsContent}
          >
            {results.length ? (
              results.map((result) => (
                <Pressable
                  key={result.key}
                  onPress={() => chooseResult(result.key)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.resultChip, pressed && styles.pressed]}
                >
                  <Text style={styles.resultText}>
                    {result.emoji} {result.label}
                  </Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.resultChip}>
                <Text style={styles.meta}>No places match “{query}”</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.spaceBetween}>
            <View style={styles.inlineRow}>
              <Icon name="location-on" size={22} color={colors.coral} />
              <Text style={styles.sheetTitle}>Confirm Pickup</Text>
            </View>
            <Text style={styles.overline}>STEP 2 OF 4</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
            {SAVED_PLACES.map((key) => {
              const saved = PICKUP_PLACES[key];
              const selected = key === placeKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => selectPlace(key)}
                  role="radio"
                  aria-checked={selected}
                  style={({ pressed }) => [styles.savedPill, selected && styles.savedPillSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.savedText, selected && styles.savedTextSelected]}>
                    {saved.emoji} {saved.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.addressCard}>
            <View style={styles.addressIcon}>
              <Icon name={place.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.addressLine}>{selection.line1}</Text>
              <Text style={styles.meta}>{selection.line2}</Text>
              {editingSpot ? (
                <TextInput
                  value={spot}
                  onChangeText={(text) => setSpotEdits((current) => ({ ...current, [placeKey]: text }))}
                  autoFocus
                  aria-label="Pickup spot"
                  selectionColor={colors.primary}
                  style={styles.spotInput}
                  onFocus={() => focusField('text')}
                  onBlur={blurField}
                  onSubmitEditing={() => setEditingSpot(false)}
                />
              ) : (
                <Text style={styles.spot}>● Spot: {spot || 'Not set'}</Text>
              )}
            </View>
            <Pressable
              onPress={() => setEditingSpot((value) => !value)}
              accessibilityRole="button"
              style={styles.editPill}
            >
              <Text style={styles.editText}>{editingSpot ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>

          <View style={styles.notesHeader}>
            <Text style={styles.notesLabel}>Pickup Notes & Access</Text>
            <Text style={styles.meta}>Optional</Text>
          </View>
          <View style={styles.notesBox}>
            <Icon name="key" size={20} color={colors.slate} />
            <TextInput
              value={pickupNotes}
              onChangeText={setPickupNotes}
              multiline
              aria-label="Pickup notes"
              placeholder="Gate code or leash note (e.g., Red leash is hanging by the door)"
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.primary}
              style={styles.notesInput}
              onFocus={() => focusField('text')}
              onBlur={blurField}
            />
          </View>

          <View style={styles.summary}>
            <Icon name={draft.timing === 'instant' ? 'bolt' : 'event'} size={20} color={colors.coral} />
            <Text style={[styles.summaryText, styles.flex]}>
              {timingLabel} <Text style={styles.meta}>• {draft.minutes} Mins</Text>
            </Text>
            <Text style={styles.summaryPrice}>{formatMoney(fare.total)}</Text>
          </View>
        </ScrollView>

        <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton label="Find Nearby Walkers" onPress={findWalkers} />
        </View>
      </View>

      {searching ? (
        <FindingWalkersModal
          summary={{
            timing: draft.timing,
            slotLabel: draft.slotLabel,
            minutes: draft.minutes,
            total: fare.total,
            placeEmoji: place.emoji,
            placeLabel: place.label,
          }}
          preferredWalkerId={draft.preferredWalkerId}
          onCancel={() => setSearching(false)}
          onDone={finishBooking}
        />
      ) : null}

      <Toast message={message} bottomOffset={120} />
    </SafeAreaView>
  );
}

/** Barnaby's map pin, held at the map centre while the map moves underneath. */
function PickupPin({ center, active }: { center: ReturnType<typeof createCenterStore>; active: boolean }) {
  const lngLat = useSyncExternalStore(center.subscribe, center.get);
  return (
    <MapMarker lngLat={lngLat} anchor="bottom" offset={BARNABY_PIN_OFFSET}>
      <BarnabyPin active={active} label="Pickup Location" />
    </MapMarker>
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
  mapArea: {
    overflow: 'hidden',
    backgroundColor: '#FFFDF9',
  },
  searchRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadows.float,
  },
  searchBoxFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  gpsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.float,
  },
  results: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
  },
  resultsContent: {
    gap: 8,
    paddingHorizontal: 16,
  },
  resultChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  resultText: {
    ...typography.label,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    boxShadow: '0px -10px 30px rgba(24, 26, 32, 0.10)',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: 10,
    borderRadius: 3,
    backgroundColor: colors.inputBorder,
  },
  sheetContent: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sheetTitle: {
    ...typography.headline,
    fontSize: 20,
  },
  overline: {
    ...typography.overline,
  },
  meta: {
    ...typography.bodySm,
  },
  savedRow: {
    gap: 8,
  },
  savedPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  savedPillSelected: {
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  savedText: {
    ...typography.label,
  },
  savedTextSelected: {
    color: colors.onPrimary,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryTint,
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  addressLine: {
    ...typography.subhead,
    fontSize: 16,
  },
  spot: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.coralInk,
  },
  spotInput: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  editText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesLabel: {
    ...typography.label,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  notesInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    textAlignVertical: 'top',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.stage,
  },
  summaryText: {
    ...typography.label,
    fontSize: 14,
  },
  summaryPrice: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.amberInk,
  },
  sheetFooter: {
    paddingTop: 10,
    paddingHorizontal: 18,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});
