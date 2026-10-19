import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BarnabyMascot, WoofPill } from './BarnabyMascot';
import { spriteFor } from './mascotModel';
import { useMascotStage } from './MascotProvider';

/** Extra room below an unclipped mascot so hops and pills stay touchable. */
const UNCLIPPED_SLACK = 64;

/**
 * Layer 1 — the persistent mascot stage. Rendered once above the navigation
 * stack, it hosts the only <BarnabyMascot /> in the app and parks him on the
 * focused screen's <MascotAnchor />, following that screen's scroll.
 */
export function MascotStage() {
  const { attachStage, anim, bark, state, placement, wagFps, pills, dismissPill } =
    useMascotStage();
  const { clip, fps } = spriteFor(state, wagFps);

  return (
    <View
      ref={attachStage}
      pointerEvents="box-none"
      style={styles.stage}
    >
      {placement ? (
        // Clip to the screen's scroll viewport so Barnaby never floats over the status bar.
        <View
          pointerEvents="box-none"
          style={[
            styles.viewport,
            {
              left: placement.viewport.x,
              top: placement.viewport.y,
              width: placement.viewport.width,
              height: placement.viewport.height,
            },
          ]}
        >
          {/* Scroll-content space; clipping at clipLine lets him duck behind the form card. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.content,
              {
                width: placement.viewport.width,
                height: placement.clipLine ?? placement.top + placement.size + UNCLIPPED_SLACK,
                overflow: placement.clipLine === null ? 'visible' : 'hidden',
                transform: [{ translateY: placement.contentShift }],
              },
            ]}
          >
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.actor,
                {
                  top: placement.top,
                  width: placement.size,
                  height: placement.size,
                  opacity: anim.opacity,
                  transform: [{ translateX: anim.travelX }],
                },
              ]}
            >
              <BarnabyMascot
                size={placement.size}
                clip={clip}
                fps={fps}
                anim={anim}
                onPress={bark}
              />
              <View pointerEvents="none" style={styles.pills}>
                {pills.map((id) => (
                  <WoofPill key={id} id={id} onDone={dismissPill} />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  viewport: {
    position: 'absolute',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  actor: {
    position: 'absolute',
    left: 0,
  },
  pills: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
});
