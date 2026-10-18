import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';

export interface MascotRef {
  hopAndBark: (message?: string) => void;
  onFocusInput: (type: 'text' | 'password') => void;
  onBlurInput: () => void;
  sprintOff: (onComplete?: () => void) => void;
}

interface MascotSpriteProps {
  size?: number;
  initialMessage?: string;
  onTap?: () => void;
  showSpeechBubble?: boolean;
  imageSource?: any;
}

export const MascotSprite = forwardRef<MascotRef, MascotSpriteProps>(
  (
    {
      size = 180,
      initialMessage = 'Woof! 🐾',
      onTap,
      showSpeechBubble = true,
      imageSource = require('../../assets/corgi_mascot.png'),
    },
    ref
  ) => {
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [speechText, setSpeechText] = useState(initialMessage);

    const [translateX] = useState(() => new Animated.Value(150));
    const [translateY] = useState(() => new Animated.Value(0));
    const [scale] = useState(() => new Animated.Value(1));
    const [rotate] = useState(() => new Animated.Value(0));
    const [opacity] = useState(() => new Animated.Value(0));

    const [bubbleOpacity] = useState(() => new Animated.Value(0));
    const [bubbleScale] = useState(() => new Animated.Value(0.75));

    const idleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    const startIdleBreathing = React.useCallback(() => {
      idleAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      idleAnimationRef.current.start();
    }, [translateY]);

    // Initial entrance animation
    useEffect(() => {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => {
        startIdleBreathing();
      });

      return () => {
        if (idleAnimationRef.current) {
          idleAnimationRef.current.stop();
        }
      };
    }, [opacity, startIdleBreathing, translateX]);

    const stopIdleBreathing = () => {
      if (idleAnimationRef.current) {
        idleAnimationRef.current.stop();
        idleAnimationRef.current = null;
      }
    };

    const showSpeech = (msg: string) => {
      if (!showSpeechBubble) return;
      setSpeechText(msg);
      setBubbleVisible(true);

      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bubbleScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(bubbleOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(bubbleScale, {
            toValue: 0.75,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setBubbleVisible(false);
        });
      }, 1800);
    };

    const hopAndBark = (customMsg?: string) => {
      stopIdleBreathing();
      showSpeech(customMsg || initialMessage);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -18,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 5,
            tension: 70,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        startIdleBreathing();
      });
    };

    const onFocusInput = (type: 'text' | 'password') => {
      stopIdleBreathing();
      if (type === 'password') {
        // Shy duck down
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 22,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.92,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: -0.5,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Curious head tilt
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -3,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.04,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1.5,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    const onBlurInput = () => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        startIdleBreathing();
      });
    };

    const sprintOff = (onComplete?: () => void) => {
      stopIdleBreathing();
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -300,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onComplete) onComplete();
      });
    };

    useImperativeHandle(ref, () => ({
      hopAndBark,
      onFocusInput,
      onBlurInput,
      sprintOff,
    }));

    const spinInterpolation = rotate.interpolate({
      inputRange: [-2, 0, 2],
      outputRange: ['-8deg', '0deg', '8deg'],
    });

    return (
      <View style={[styles.wrapper, { width: size, height: size }]}>
        {/* Floating Speech Bubble */}
        {bubbleVisible && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.speechBubble,
              {
                opacity: bubbleOpacity,
                transform: [{ scale: bubbleScale }],
              },
            ]}
          >
            <Text style={styles.speechText}>{speechText}</Text>
          </Animated.View>
        )}

        {/* Mascot Touchable Container */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            hopAndBark();
            if (onTap) onTap();
          }}
          style={styles.touchable}
        >
          <Animated.View
            style={[
              styles.characterContainer,
              {
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate: spinInterpolation },
                ],
              },
            ]}
          >
            <Image
              source={imageSource}
              style={{ width: size, height: size }}
              resizeMode="contain"
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechBubble: {
    position: 'absolute',
    top: -24,
    backgroundColor: colors.secondaryContainer,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    zIndex: 30,
    ...shadows.card,
  },
  speechText: {
    ...typography.labelMd,
    color: colors.onSecondaryContainer,
    fontWeight: '700',
  },
});

MascotSprite.displayName = 'MascotSprite';

