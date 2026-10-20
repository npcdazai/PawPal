/**
 * Barnaby's finite state machine vocabulary, sprite clips and motion physics.
 * Pure data (no React) so the whole timing model can be read and tuned here.
 */

export type MascotState =
  | 'STATE_HIDDEN'
  | 'STATE_ENTER_FROM_RIGHT'
  | 'STATE_ENTER_FROM_LEFT'
  | 'STATE_IDLE_CENTER'
  | 'STATE_CURIOUS_TILT'
  | 'STATE_PEEKING_DUCK'
  | 'STATE_WOOF_BARK'
  | 'STATE_SCANNING'
  | 'STATE_WALKING'
  | 'STATE_EXIT_TO_LEFT'
  | 'STATE_EXIT_TO_RIGHT';

export type RestingState = Extract<
  MascotState,
  | 'STATE_IDLE_CENTER'
  | 'STATE_CURIOUS_TILT'
  | 'STATE_PEEKING_DUCK'
  | 'STATE_SCANNING'
  | 'STATE_WALKING'
>;

/** Which kind of input currently has focus; drives the curious / peeking poses. */
export type FieldKind = 'text' | 'password';

/** Forward navigation exits left and enters from the right; back mirrors it. */
export type Direction = 'forward' | 'back';

/** Mascot size every sprite offset is authored against. */
export const MASCOT_BASE_SIZE = 180;
/** Dashboard docking scale for the "TAP TO PET" badge. */
export const DOCK_SCALE = 0.55;

export const PHYSICS = {
  // ≈700ms underdamped arrival (≈7% overshoot), matching cubic-bezier(0.34, 1.56, 0.64, 1).
  enterSpring: {
    damping: 14,
    stiffness: 120,
    mass: 1,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 4,
  },
  poseSpring: { damping: 14, stiffness: 180, mass: 1 },
  hopSpring: { damping: 10, stiffness: 260, mass: 1 },
  turnMs: 160,
  anticipation: { hopY: -12, scale: 1.05, upMs: 110, downMs: 90 },
  exitMs: 450,
  /** Tab switches: straight into the sprint, no anticipation hop. */
  quickExitMs: 280,
  edgePadding: 24,
  woof: { hopY: -14, scale: 1.08, upMs: 140, fps: 12 },
  pillMs: 800,
  /** Curious head tilt when the user flips an option (e.g. walk timing). */
  glanceMs: 900,
  /** Look left / right while scanning for walkers. */
  scanTurnMs: 1100,
  walkFps: 12,
  sprintFps: 16,
  idleFps: 8,
  idleFpsMax: 18,
} as const;

export interface Pose {
  y: number;
  scale: number;
  rotate: number;
}

export const POSES: Record<RestingState, Pose> = {
  STATE_IDLE_CENTER: { y: 0, scale: 1, rotate: 0 },
  STATE_CURIOUS_TILT: { y: -2, scale: 1.04, rotate: 8 },
  STATE_PEEKING_DUCK: { y: 22, scale: 0.9, rotate: 0 },
  STATE_SCANNING: { y: 0, scale: 1, rotate: 0 },
  STATE_WALKING: { y: 0, scale: 1, rotate: 0 },
};

export const SPRITE_FRAME_COUNT = 6;

export type SpriteClipName = 'idle' | 'walk' | 'woof';

/** One frame of a sprite clip: a discrete body pose applied to the artwork. */
export interface SpriteFrame {
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}

export interface SpriteClip {
  name: SpriteClipName;
  loop: boolean;
  frames: readonly SpriteFrame[];
}

const frame = (translateY: number, rotate: number, scaleX = 1, scaleY = 1): SpriteFrame => ({
  translateY,
  rotate,
  scaleX,
  scaleY,
});

export const CLIPS: Record<SpriteClipName, SpriteClip> = {
  // IDLE (TAIL WAGGING): rump sway between -2° and 2° with a 0.98–1.02 breath.
  idle: {
    name: 'idle',
    loop: true,
    frames: [
      frame(0, -2, 1, 0.98),
      frame(0, -1, 1, 0.99),
      frame(0, 1, 1, 1.01),
      frame(0, 2, 1, 1.02),
      frame(0, 1, 1, 1.01),
      frame(0, -1, 1, 0.99),
    ],
  },
  // WALKING: two-step gait bobbing between 0px and -6px with a little waddle.
  walk: {
    name: 'walk',
    loop: true,
    frames: [
      frame(0, -3),
      frame(-4, -1),
      frame(-6, 2),
      frame(0, 3),
      frame(-4, 1),
      frame(-6, -2),
    ],
  },
  // WOOF: squash, stretch, bark, recoil, settle. Played once.
  woof: {
    name: 'woof',
    loop: false,
    frames: [
      frame(2, 0, 1.04, 0.94),
      frame(-2, 0, 0.97, 1.06),
      frame(0, -4, 1.04, 1.04),
      frame(0, -3, 1.06, 1.06),
      frame(0, 2, 1.01, 1.01),
      frame(0, 0),
    ],
  },
};

export const WOOF_DURATION_MS = (SPRITE_FRAME_COUNT / PHYSICS.woof.fps) * 1000;

export const isLeaving = (state: MascotState) =>
  state === 'STATE_EXIT_TO_LEFT' || state === 'STATE_EXIT_TO_RIGHT';

export const isEntering = (state: MascotState) =>
  state === 'STATE_ENTER_FROM_RIGHT' || state === 'STATE_ENTER_FROM_LEFT';

/** Resting on an anchor: reacting to the user rather than travelling. */
export const isResting = (state: MascotState) =>
  state === 'STATE_IDLE_CENTER' ||
  state === 'STATE_CURIOUS_TILT' ||
  state === 'STATE_PEEKING_DUCK' ||
  state === 'STATE_SCANNING' ||
  state === 'STATE_WALKING' ||
  state === 'STATE_WOOF_BARK';

/** Maps a machine state to the sprite clip and frame rate that should play. */
export function spriteFor(
  state: MascotState,
  wagFps: number
): { clip: SpriteClipName; fps: number } {
  if (isEntering(state) || state === 'STATE_SCANNING' || state === 'STATE_WALKING') {
    return { clip: 'walk', fps: PHYSICS.walkFps };
  }
  if (isLeaving(state)) return { clip: 'walk', fps: PHYSICS.sprintFps };
  if (state === 'STATE_WOOF_BARK') return { clip: 'woof', fps: PHYSICS.woof.fps };
  if (state === 'STATE_HIDDEN') return { clip: 'idle', fps: 0 };
  return { clip: 'idle', fps: wagFps };
}
