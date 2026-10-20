import { Easing } from 'react-native';
import type { BottomTabNavigationOptions } from 'expo-router/tabs';

type TabTransition = Required<Pick<BottomTabNavigationOptions, 'transitionSpec' | 'sceneStyleInterpolator'>>;

/** How far a tab scene travels while switching (px). */
const SHIFT = 56;

/**
 * Switching tabs: the new screen glides in from the side of the tab you
 * tapped while the old one drifts the other way and fades, with a hint of
 * depth. Progress is -1 / 0 / 1 for tabs left of / at / right of the active
 * tab, so the direction always follows the tab bar.
 */
const SHIFT_TRANSITION: TabTransition = {
  transitionSpec: {
    animation: 'timing',
    config: { duration: 260, easing: Easing.out(Easing.cubic) },
  },
  sceneStyleInterpolator: ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-SHIFT, 0, SHIFT],
          }),
        },
        {
          scale: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0.98, 1, 0.98],
          }),
        },
      ],
    },
  }),
};

/** "Reduce motion": a short crossfade, no travel. */
const FADE_TRANSITION: TabTransition = {
  transitionSpec: {
    animation: 'timing',
    config: { duration: 150, easing: Easing.linear },
  },
  sceneStyleInterpolator: ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
    },
  }),
};

export const tabTransition = (reduceMotion: boolean): TabTransition =>
  reduceMotion ? FADE_TRANSITION : SHIFT_TRANSITION;
