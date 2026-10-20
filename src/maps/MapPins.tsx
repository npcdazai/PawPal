import React, { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { PulseRings } from '../booking/PulseRings';
import { MascotDockSlot } from '../mascot/MascotDockSlot';

/** Re-renders every animation frame while `running`; returns the frame's time. */
export function useFrameClock(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return now;
}

// ─── Barnaby's map pin ───────────────────────────────────────────────────────

const PIN = 68;
/** Room for the pulse rings (1.8×) so native marker views don't clip them. */
const RING_BOX = 124;
const TIP = 14;
/** Where the pointer's tip sits, measured from the top of the ring box. */
const TIP_POINT_Y = RING_BOX / 2 + PIN / 2 + (TIP * Math.SQRT2) / 2 - 2;

/**
 * Use with `<MapMarker anchor="bottom" offset={BARNABY_PIN_OFFSET}>` so the
 * pointer's tip sits exactly on the coordinate.
 */
export const BARNABY_PIN_OFFSET: [number, number] = [0, Math.round(RING_BOX - TIP_POINT_Y)];

interface BarnabyPinProps {
  /** Lets the screen hand Barnaby to a dialog (the slot goes empty). */
  active?: boolean;
  ringColor?: string;
  label?: ReactNode;
  /** e.g. the walker's avatar, tucked at the pin's lower right. */
  badge?: ReactNode;
}

/**
 * The map-pin dock: a 68px peach circle with a coral border (Barnaby's
 * <MascotDockSlot variant="map-pin" />), radar pulse rings and a pointer tip.
 * The slot's track stays at translateX(0) here; only his rig animates.
 */
export function BarnabyPin({ active = true, ringColor = colors.coral, label, badge }: BarnabyPinProps) {
  return (
    <View pointerEvents="box-none" style={styles.pinColumn}>
      {label ? (
        <View pointerEvents="none" style={styles.pinLabel}>
          {typeof label === 'string' ? <Text style={styles.pinLabelText}>{label}</Text> : label}
        </View>
      ) : null}
      <View pointerEvents="box-none" style={styles.ringBox}>
        <PulseRings size={PIN} colors={[ringColor, ringColor]} scaleTo={1.8} />
        <View pointerEvents="none" style={styles.tip} />
        <MascotDockSlot variant="map-pin" active={active} style={styles.pinShadow} />
        {badge ? (
          <View pointerEvents="none" style={styles.pinBadge}>
            {badge}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Walkers ─────────────────────────────────────────────────────────────────

const WALKER = 54;
const WALKER_BOX = WALKER + 40;

/** Use with anchor "bottom" so the avatar's centre sits on the coordinate. */
export const WALKER_PIN_OFFSET: [number, number] = [0, WALKER_BOX / 2];

/** The matched walker heading to the pickup; the cone points along the route. */
export function WalkerPin({ initials, name, bearing }: { initials: string; name: string; bearing: number }) {
  return (
    <View pointerEvents="none" style={styles.walkerColumn}>
      <View style={styles.walkerLabel}>
        <View style={styles.liveDot} />
        <Text style={styles.walkerLabelText}>{name} (Walker)</Text>
      </View>
      <View style={styles.walkerBox}>
        <View style={styles.walkerGlow} />
        <View style={[styles.cone, { transform: [{ rotate: `${bearing}deg` }] }]}>
          <Icon name="navigation" size={22} color={colors.primary} />
        </View>
        <Avatar initials={initials} tint={colors.card} ink={colors.primary} size={WALKER} style={styles.walkerAvatar} />
        <View style={styles.walkingBadge}>
          <Icon name="directions-walk" size={13} color={colors.onPrimary} />
        </View>
      </View>
    </View>
  );
}

const NEARBY = 34;
const NEARBY_BOX = NEARBY * 2;

/** Use with anchor "bottom" so the avatar's centre sits on the coordinate. */
export const NEARBY_WALKER_OFFSET: [number, number] = [0, NEARBY_BOX / 2];

/** A walker pinging the dispatch radar while Barnaby's walk is being matched. */
export function NearbyWalkerPin({ initials, label, tint }: { initials: string; label: string; tint: string }) {
  return (
    <View pointerEvents="none" style={styles.walkerColumn}>
      <View style={styles.nearbyChip}>
        <View style={[styles.liveDot, { backgroundColor: tint }]} />
        <Text style={styles.nearbyText}>{label}</Text>
      </View>
      <View style={styles.nearbyBox}>
        <PulseRings size={NEARBY} colors={[tint, tint]} scaleTo={2} periodMs={1800} />
        <Avatar initials={initials} tint={colors.card} ink={tint} size={NEARBY} style={[styles.nearbyAvatar, { borderColor: tint }]} />
      </View>
    </View>
  );
}

// ─── Walk milestones ─────────────────────────────────────────────────────────

const MILESTONE = 34;

/** Use with anchor "bottom" so the emoji badge is centred on the coordinate. */
export const MILESTONE_OFFSET: [number, number] = [0, MILESTONE / 2];

/** 💧 / 💩 / 📸 dropped on the trail; tap for its label. */
export function MilestonePin({
  emoji,
  label,
  open,
  onPress,
}: {
  emoji: string;
  label: string;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.milestoneColumn}>
      {open ? (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text style={styles.tooltipText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        aria-label={label}
        style={({ pressed }) => [styles.milestone, pressed && styles.pressed]}
      >
        <Text style={styles.milestoneEmoji}>{emoji}</Text>
      </Pressable>
    </View>
  );
}

const HOME_DOT = 32;

/** Use with anchor "bottom" so the dot's centre sits on the coordinate. */
export const START_DOT_OFFSET: [number, number] = [0, HOME_DOT / 2];

/** Where the walk started, with a "Start" tag above the dot. */
export function StartDot() {
  return (
    <View pointerEvents="none" style={styles.startColumn}>
      <View style={styles.startTag}>
        <Icon name="home" size={12} color={colors.onPrimary} />
        <Text style={styles.startText}>Start</Text>
      </View>
      <View style={styles.homeDot}>
        <View style={styles.homeDotInner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinColumn: {
    alignItems: 'center',
  },
  pinLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: -(RING_BOX - PIN) / 2 + 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
    zIndex: 1,
  },
  pinLabelText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  ringBox: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    position: 'absolute',
    top: RING_BOX / 2 + PIN / 2 - TIP / 2 - 2,
    width: TIP,
    height: TIP,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    backgroundColor: colors.coral,
  },
  pinShadow: {
    borderRadius: PIN / 2,
    ...shadows.float,
  },
  pinBadge: {
    position: 'absolute',
    left: RING_BOX / 2 + PIN / 2 - 22,
    top: RING_BOX / 2 + PIN / 2 - 30,
  },
  walkerColumn: {
    alignItems: 'center',
  },
  walkerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: -12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    zIndex: 1,
    ...shadows.soft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  walkerLabelText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  walkerBox: {
    width: WALKER_BOX,
    height: WALKER_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerGlow: {
    position: 'absolute',
    width: WALKER + 34,
    height: WALKER + 34,
    borderRadius: (WALKER + 34) / 2,
    backgroundColor: 'rgba(41, 98, 255, 0.14)',
  },
  cone: {
    position: 'absolute',
    width: WALKER_BOX,
    height: WALKER_BOX,
    alignItems: 'center',
  },
  walkerAvatar: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  walkingBadge: {
    position: 'absolute',
    left: WALKER_BOX / 2 + WALKER / 2 - 18,
    top: WALKER_BOX / 2 + WALKER / 2 - 20,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: colors.card,
  },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: -8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    zIndex: 1,
    ...shadows.soft,
  },
  nearbyText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  nearbyBox: {
    width: NEARBY_BOX,
    height: NEARBY_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyAvatar: {
    borderWidth: 2.5,
  },
  milestoneColumn: {
    alignItems: 'center',
    gap: 6,
  },
  milestone: {
    width: MILESTONE,
    height: MILESTONE,
    borderRadius: MILESTONE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.float,
  },
  milestoneEmoji: {
    fontSize: 16,
  },
  tooltip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
  },
  tooltipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  startColumn: {
    alignItems: 'center',
    gap: 4,
  },
  startTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  startText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.onPrimary,
  },
  homeDot: {
    width: HOME_DOT,
    height: HOME_DOT,
    borderRadius: HOME_DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  homeDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.card,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
});
