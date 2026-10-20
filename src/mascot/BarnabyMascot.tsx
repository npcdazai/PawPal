import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, radii, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';
import { NATIVE_DRIVER, type MascotAnimations } from './MascotMachine';
import {
  CLIPS,
  MASCOT_BASE_SIZE,
  PHYSICS,
  SPRITE_FRAME_COUNT,
  type SpriteClip,
  type SpriteClipName,
} from './mascotModel';

const CORGI = require('../../assets/corgi_mascot.png');

interface BarnabyMascotProps {
  size: number;
  clip: SpriteClipName;
  fps: number;
  anim: Pick<MascotAnimations, 'poseY' | 'poseScale' | 'poseRotate' | 'facing'>;
  onPress?: () => void;
}

/**
 * The corgi himself. Two transform layers:
 *  - pose layer (native driver): state poses — hop, tilt, duck, facing flip
 *  - frame layer (React state at `fps`): the discrete 6-frame sprite clip
 */
export function BarnabyMascot({ size, clip, fps, anim, onPress }: BarnabyMascotProps) {
  const rotate = useMemo(
    () =>
      anim.poseRotate.interpolate({
        inputRange: [-360, 360],
        outputRange: ['-360deg', '360deg'],
      }),
    [anim.poseRotate]
  );

  return (
    <View style={{ width: size, height: size }}>
      <View
        pointerEvents="none"
        style={[
          styles.groundShadow,
          {
            width: size * 0.36,
            height: size * 0.05,
            left: size * 0.37,
            top: size * 0.845,
          },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: 'bottom',
            transform: [
              { translateY: anim.poseY },
              { rotate },
              { scale: anim.poseScale },
              { scaleX: anim.facing },
            ],
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Barnaby the corgi"
          accessibilityHint="Pets Barnaby"
          style={StyleSheet.absoluteFill}
        >
          <SpriteFrames key={clip} clip={CLIPS[clip]} fps={fps} size={size} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SpriteFrames({ clip, fps, size }: { clip: SpriteClip; fps: number; size: number }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (fps <= 0) return undefined;
    const timer = setInterval(() => {
      setFrame((current) =>
        clip.loop
          ? (current + 1) % SPRITE_FRAME_COUNT
          : Math.min(current + 1, SPRITE_FRAME_COUNT - 1)
      );
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [clip, fps]);

  const pose = clip.frames[frame];
  const unit = size / MASCOT_BASE_SIZE;

  return (
    <View
      style={{
        width: size,
        height: size,
        transformOrigin: 'bottom',
        transform: [
          { translateY: pose.translateY * unit },
          { rotate: `${pose.rotate}deg` },
          { scaleX: pose.scaleX },
          { scaleY: pose.scaleY },
        ],
      }}
    >
      <Image source={CORGI} style={{ width: size, height: size }} resizeMode="contain" />
      <SpriteAccents clip={clip.name} frame={frame} />
    </View>
  );
}

const WAG_OPACITY = [0.85, 0.55, 0.25, 0.85, 0.55, 0.25];
const DUST_RADIUS = [15, 10, 5, 15, 10, 5];
const BARK_SCALE = [0, 0, 0.8, 1.15, 1, 0];

/** Frame-synced cartoon accents, drawn in the artwork's 512×512 space. */
function SpriteAccents({ clip, frame }: { clip: SpriteClipName; frame: number }) {
  if (clip === 'idle') {
    const swingUp = frame < SPRITE_FRAME_COUNT / 2;
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 512 512">
        <Path
          d={swingUp ? 'M100 112 Q80 116 74 136' : 'M100 150 Q80 146 74 126'}
          stroke={colors.ink}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          opacity={WAG_OPACITY[frame]}
        />
        <Path
          d={swingUp ? 'M84 92 Q62 98 54 120' : 'M84 170 Q62 164 54 142'}
          stroke={colors.ink}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          opacity={WAG_OPACITY[frame] * 0.7}
        />
      </Svg>
    );
  }

  if (clip === 'walk') {
    const r = DUST_RADIUS[frame];
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 512 512">
        <Circle cx={168} cy={448} r={r} fill="#E9DCCB" opacity={0.9} />
        <Circle cx={136} cy={436} r={r * 0.7} fill="#E9DCCB" opacity={0.7} />
        <Circle cx={112} cy={426} r={r * 0.45} fill="#E9DCCB" opacity={0.5} />
      </Svg>
    );
  }

  const s = BARK_SCALE[frame];
  if (s === 0) return null;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 512 512">
      <Path
        d={`M408 214 L${408 + 34 * s} ${214 - 20 * s}`}
        stroke={colors.coral}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Path
        d={`M414 252 L${414 + 40 * s} 252`}
        stroke={colors.coral}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Path
        d={`M408 290 L${408 + 34 * s} ${290 + 20 * s}`}
        stroke={colors.coral}
        strokeWidth={10}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Coral "Woof! 🐾" speech pill: pops in, floats up and fades out over 800ms. */
export function WoofPill({
  id,
  text,
  onDone,
}: {
  id: number;
  text: string;
  onDone: (id: number) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  // Deterministic jitter so rapid pets fan out instead of stacking exactly.
  const jitter = ((id * 37) % 41) - 20;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: PHYSICS.pillMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (finished) onDone(id);
    });
    return () => animation.stop();
  }, [id, onDone, progress]);

  const { translateY, opacity, scale } = useMemo(
    () => ({
      translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -38] }),
      opacity: progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] }),
      scale: progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.6, 1.06, 1] }),
    }),
    [progress]
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pill, { opacity, transform: [{ translateX: jitter }, { translateY }, { scale }] }]}
    >
      <Text style={styles.pillText} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  groundShadow: {
    position: 'absolute',
    borderRadius: radii.full,
    backgroundColor: 'rgba(24, 26, 32, 0.07)',
    boxShadow: '0px 0px 6px 2px rgba(24, 26, 32, 0.05)',
  },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    top: -6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.coral,
    ...shadows.coral,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.onPrimary,
  },
});
