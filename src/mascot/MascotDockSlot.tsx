import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import { colors } from '../theme/colors';
import { gradients } from '../theme/gradients';
import { NATIVE_DRIVER } from '../theme/motion';
import { useResponsive, type Responsive } from '../theme/responsive';
import { CorgiSprite, GroundShadow, WoofPill } from './BarnabyMascot';
import { PHYSICS, RIG_POSES, TRACK, type RigPoseName, type SpriteClipName } from './mascotModel';
import { useMascotSlotHub, type SlotMotion } from './MascotProvider';

export type MascotSlotVariant =
  | 'hero-circle' //    Splash
  | 'auth-header' //    Login, Register, Book a Walk
  | 'dashboard-dock' // Plan screen banner
  | 'compact-dock' //   Home greeting header: a glowing round stage
  | 'map-pin' //        Pickup, Walker En Route, Live Walk
  | 'pet-portrait' //   Profile pet card
  | 'popup'; //         dialogs (finding walkers, walk complete): not clipped

interface VariantSpec {
  /** Fixed box width; null = 100% of the parent. */
  width: number | null;
  height: number;
  frame: ViewStyle;
  /** Corgi size as a share of the box's inner (inside-border) short side. */
  fill: number;
  clip: boolean;
}

const VARIANTS: Record<Exclude<MascotSlotVariant, 'popup'>, VariantSpec> = {
  'hero-circle': {
    width: 220,
    height: 220,
    frame: { borderRadius: 9999, backgroundColor: colors.stage },
    fill: 0.86,
    clip: true,
  },
  'auth-header': {
    width: null,
    height: 170,
    frame: { borderRadius: 24, backgroundColor: colors.stage },
    fill: 0.88,
    clip: true,
  },
  'dashboard-dock': {
    width: 76,
    height: 76,
    frame: { borderRadius: 9999, backgroundColor: colors.card },
    fill: 0.92,
    clip: true,
  },
  // 80 × 80 radial glow (white → peach) in a white ring, lifted off the glass header.
  'compact-dock': {
    width: 80,
    height: 80,
    frame: {
      borderRadius: 9999,
      backgroundImage: gradients.mascotGlow,
      backgroundColor: colors.stage,
      borderWidth: 3,
      borderColor: colors.card,
      boxShadow: '0px 6px 16px rgba(24, 26, 32, 0.10)',
    },
    fill: 0.98,
    clip: true,
  },
  'map-pin': {
    width: 68,
    height: 68,
    frame: { borderRadius: 9999, backgroundColor: colors.stage, borderWidth: 3, borderColor: colors.coral },
    fill: 0.9,
    clip: true,
  },
  'pet-portrait': {
    width: 108,
    height: 108,
    frame: { borderRadius: 24, backgroundColor: colors.stage },
    fill: 0.9,
    clip: true,
  },
};

const popupSpec = (diameter: number): VariantSpec => ({
  width: diameter,
  height: diameter,
  frame: {},
  fill: 0.78,
  clip: false,
});

/**
 * The slot on this window. The big stages (splash circle, auth header, dialog
 * popups) shrink with the window's height on short phones, never below 85%;
 * the small docks and pins keep their designed size.
 */
const specFor = (variant: MascotSlotVariant, diameter: number, r: Responsive): VariantSpec => {
  switch (variant) {
    case 'popup':
      return popupSpec(r.scaleHeight(diameter));
    case 'hero-circle': {
      const size = r.scaleHeight(VARIANTS[variant].height);
      return { ...VARIANTS[variant], width: size, height: size };
    }
    case 'auth-header':
      return { ...VARIANTS[variant], height: r.scaleHeight(VARIANTS[variant].height) };
    default:
      return VARIANTS[variant];
  }
};

const rigPoseFor = (
  hub: ReturnType<typeof useMascotSlotHub>,
  isCurrent: boolean
): RigPoseName => {
  if (!isCurrent) return 'IDLE_WAG';
  if (hub.currentMotion === 'entering' || hub.currentMotion === 'exiting') return 'WALKING_BOB';
  if (hub.woofing) return 'WOOF_BARK';
  if (hub.field === 'password') return 'PEEKING_DUCK';
  if (hub.field === 'text' || hub.glancing) return 'CURIOUS_TILT';
  if (hub.scanning || hub.walking) return 'WALKING_BOB';
  return 'IDLE_WAG';
};

const clipFor = (
  hub: ReturnType<typeof useMascotSlotHub>,
  isCurrent: boolean
): { clip: SpriteClipName; fps: number } => {
  if (!isCurrent) return { clip: 'idle', fps: 0 };
  if (hub.currentMotion === 'entering') return { clip: 'walk', fps: PHYSICS.walkFps };
  if (hub.currentMotion === 'exiting') return { clip: 'walk', fps: PHYSICS.sprintFps };
  if (hub.woofing) return { clip: 'woof', fps: PHYSICS.woofFps };
  if (hub.scanning || hub.walking) return { clip: 'walk', fps: PHYSICS.walkFps };
  return { clip: 'idle', fps: hub.wagFps };
};

interface MascotDockSlotProps {
  variant: MascotSlotVariant;
  /** 'popup' only: the circle he stands in, at the design size (it shrinks on short windows). */
  diameter?: number;
  /**
   * Lets one screen hand Barnaby between slots (map pin → dialog): an inactive
   * slot gives him up, and he enters again when it is re-activated.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Barnaby, drawn in a fixed slot of the screen's own layout:
 *  Layer 1 — the slot: sized per variant, centres and clips him
 *  Layer 2 — the spatial track: ONLY translateX + scaleX (Right → Center → Left)
 *  Layer 3 — the character rig: ONLY micro-interactions around center bottom
 * Because the slot is part of the screen, his place can't drift during or
 * after a transition: he moves with the screen like any other view.
 */
export function MascotDockSlot({ variant, diameter = 120, active = true, style }: MascotDockSlotProps) {
  const responsive = useResponsive();
  const spec = specFor(variant, diameter, responsive);
  const border = spec.frame.borderWidth ?? 0;
  const corgiSize = Math.round((Math.min(spec.width ?? spec.height, spec.height) - 2 * border) * spec.fill);

  const id = useId();
  const hub = useMascotSlotHub();
  const { claim, release, reportMotion, pulse, bark, dismissPill } = hub;
  const focused = useIsFocused();
  const claimed = active && focused;
  const isCurrent = hub.currentId === id;
  const resting = isCurrent && hub.currentMotion === 'resting';

  const [anim] = useState(() => ({
    // Layer 2
    trackX: new Animated.Value(0),
    facing: new Animated.Value(-1),
    presence: new Animated.Value(0),
    // Layer 3
    poseY: new Animated.Value(0),
    poseRotate: new Animated.Value(0),
    poseScale: new Animated.Value(1),
  }));
  const motionRef = useRef<SlotMotion>('away');
  const spanRef = useRef(spec.width ?? 0);
  const pendingEnter = useRef(false);

  const setMotion = useCallback(
    (next: SlotMotion) => {
      motionRef.current = next;
      anim.presence.setValue(next === 'away' ? 0 : 1);
      reportMotion(id, next);
    },
    [anim, id, reportMotion]
  );

  /** ENTERING: translateX(130%) scaleX(-1) → translateX(0) scaleX(1) over 550ms. */
  const enter = useCallback(() => {
    const span = spanRef.current;
    if (!span) {
      pendingEnter.current = true;
      return;
    }
    pendingEnter.current = false;
    const { trackX, facing } = anim;
    trackX.stopAnimation();
    facing.stopAnimation();
    trackX.setValue(TRACK.offscreen * span);
    facing.setValue(-1);
    setMotion('entering');
    Animated.parallel([
      Animated.timing(trackX, {
        toValue: 0,
        duration: TRACK.enterMs,
        easing: Easing.bezier(...TRACK.enterEasing),
        useNativeDriver: NATIVE_DRIVER,
      }),
      // He turns to face the user as he lands, finishing with the slide.
      Animated.timing(facing, {
        toValue: 1,
        duration: TRACK.turnMs,
        delay: TRACK.enterMs - TRACK.turnMs,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setMotion('resting');
      pulse();
    });
  }, [anim, pulse, setMotion]);

  /** Tab switches: already standing in the slot. */
  const snap = useCallback(() => {
    anim.trackX.stopAnimation();
    anim.facing.stopAnimation();
    anim.trackX.setValue(0);
    anim.facing.setValue(1);
    setMotion('resting');
  }, [anim, setMotion]);

  /** EXITING: translateX(0) scaleX(-1) → translateX(-130%) scaleX(-1), 380ms ease-in. */
  const exit = useCallback(() => {
    const { trackX, facing } = anim;
    trackX.stopAnimation();
    facing.stopAnimation();
    facing.setValue(-1);
    setMotion('exiting');
    Animated.timing(trackX, {
      toValue: -TRACK.offscreen * spanRef.current,
      duration: TRACK.exitMs,
      easing: Easing.bezier(...TRACK.exitEasing),
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => setMotion('away'));
  }, [anim, setMotion]);

  // Focused + active: Barnaby acts here. Enter unless he is already standing in the slot.
  useEffect(() => {
    if (!claimed) return undefined;
    const { inPlace } = claim(id, { exit });
    if (motionRef.current !== 'resting') {
      if (inPlace) snap();
      else enter();
    }
    return () => {
      pendingEnter.current = false;
      release(id);
    };
  }, [claimed, claim, release, id, enter, exit, snap]);

  // Layer 3: ease into the micro-interaction pose; it never moves the slot or track.
  const poseName = rigPoseFor(hub, isCurrent);
  useEffect(() => {
    const target = RIG_POSES[poseName];
    const { poseY, poseRotate, poseScale } = anim;
    poseY.stopAnimation();
    poseRotate.stopAnimation();
    poseScale.stopAnimation();
    const to = (value: Animated.Value, toValue: number) =>
      poseName === 'WOOF_BARK'
        ? Animated.timing(value, {
            toValue,
            duration: PHYSICS.woofUpMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
          })
        : Animated.spring(value, { toValue, ...PHYSICS.poseSpring, useNativeDriver: NATIVE_DRIVER });
    Animated.parallel([to(poseY, target.y), to(poseRotate, target.rotate), to(poseScale, target.scale)]).start();
  }, [anim, poseName]);

  // Layer 2 facing while resting: look left and right while scanning…
  const scanningHere = resting && hub.scanning;
  useEffect(() => {
    if (!scanningHere) return undefined;
    let lookingLeft = false;
    const timer = setInterval(() => {
      lookingLeft = !lookingLeft;
      Animated.timing(anim.facing, {
        toValue: lookingLeft ? -1 : 1,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    }, PHYSICS.scanTurnMs);
    return () => clearInterval(timer);
  }, [anim, scanningHere]);

  // …otherwise face the walk's direction of travel, or the user.
  const facingTarget = resting && hub.walking ? hub.heading : 1;
  useEffect(() => {
    if (!resting || scanningHere) return;
    anim.facing.stopAnimation();
    Animated.timing(anim.facing, {
      toValue: facingTarget,
      duration: TRACK.turnMs,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [anim, facingTarget, resting, scanningHere]);

  const onLayout = (event: LayoutChangeEvent) => {
    spanRef.current = event.nativeEvent.layout.width;
    if (pendingEnter.current) enter();
  };

  const rotate = useMemo(
    () => anim.poseRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }),
    [anim]
  );
  const { clip, fps } = clipFor(hub, isCurrent);

  return (
    <View
      style={[
        styles.slot,
        spec.width === null ? styles.fullWidth : { width: spec.width },
        { height: spec.height },
        style,
      ]}
    >
      {/* Layer 1: the slot box */}
      <View
        testID={`mascot-dock-slot-${variant}`}
        onLayout={onLayout}
        style={[styles.frame, spec.frame, { overflow: spec.clip ? 'hidden' : 'visible' }]}
      >
        {/* Layer 2: the spatial track (translateX + scaleX only) */}
        <Animated.View
          pointerEvents={isCurrent ? 'box-none' : 'none'}
          style={[
            styles.track,
            { opacity: anim.presence, transform: [{ translateX: anim.trackX }, { scaleX: anim.facing }] },
          ]}
        >
          <View style={{ width: corgiSize, height: corgiSize }}>
            <GroundShadow size={corgiSize} />
            {/* Layer 3: the character rig (micro-interactions only) */}
            <Animated.View
              testID="corgi-character-rig"
              style={[
                StyleSheet.absoluteFill,
                {
                  transformOrigin: 'center bottom',
                  transform: [{ translateY: anim.poseY }, { rotate }, { scale: anim.poseScale }],
                },
              ]}
            >
              <Pressable
                onPress={bark}
                accessibilityRole="button"
                accessibilityLabel="Barnaby the corgi"
                accessibilityHint="Pets Barnaby"
                style={StyleSheet.absoluteFill}
              >
                <CorgiSprite clip={clip} fps={fps} size={corgiSize} />
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      {/* Speech pills float above the slot, outside its clip. */}
      {isCurrent ? (
        <View pointerEvents="none" style={styles.pills}>
          {hub.pills.map((pill) => (
            <WoofPill key={pill.id} id={pill.id} text={pill.text} onDone={dismissPill} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'relative',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  frame: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
});
