import { Animated, Easing, Keyboard, Platform, type View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ComponentRef, RefObject } from 'react';
import {
  type Direction,
  type FieldKind,
  type MascotState,
  type Pose,
  type RestingState,
  PHYSICS,
  POSES,
  WOOF_DURATION_MS,
  isResting,
} from './mascotModel';

export const NATIVE_DRIVER = Platform.OS !== 'web';

const DEFAULT_WOOF = 'Woof! 🐾';

/** Host instance of a <View> (RN 0.88 types View as a function component). */
export type ViewHandle = ComponentRef<typeof View>;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scroll state of the screen an anchor lives in, so the overlay can follow it. */
export interface MascotScrollHandle {
  scrollY: Animated.Value;
  /** Zero-size marker at the top of the scroll content. */
  originRef: RefObject<ViewHandle | null>;
  viewportRef: RefObject<ViewHandle | null>;
}

/** A screen asking Barnaby to come and stand on its placeholder. */
export interface AnchorRequest {
  id: string;
  size: number;
  anchorRef: RefObject<ViewHandle | null>;
  scroll: MascotScrollHandle;
  /** Barnaby is clipped below this view's top edge so he can duck behind it. */
  clipRef?: RefObject<ViewHandle | null>;
  /** Live offset from the anchor, for pins that travel (e.g. along a walk route). */
  offset?: AnchorOffset;
}

type AnimatedNumber = Animated.Value | Animated.AnimatedInterpolation<number>;

export interface AnchorOffset {
  x: AnimatedNumber;
  y: AnimatedNumber;
}

/** Where the persistent stage draws Barnaby for the active anchor. */
export interface MascotPlacement {
  id: string;
  size: number;
  /** Scroll viewport of the anchor's screen, relative to the stage. */
  viewport: Rect;
  /** Docked left edge, relative to the viewport. */
  left: number;
  /** Top edge in the screen's scroll-content coordinates. */
  top: number;
  /** Content-space line below which Barnaby is hidden, if the screen has one. */
  clipLine: number | null;
  /** -scrollY, so the stage moves with the screen's content. */
  contentShift: Animated.AnimatedNode;
  offset: AnchorOffset | null;
}

export interface MascotAnimations {
  /** Left edge within the viewport: docked at placement.left, off-screen while travelling. */
  travelX: Animated.Value;
  /** scaleX: 1 faces right (the artwork's natural facing), -1 faces left. */
  facing: Animated.Value;
  poseY: Animated.Value;
  poseScale: Animated.Value;
  /** Degrees. */
  poseRotate: Animated.Value;
  opacity: Animated.Value;
}

interface MachineEvents {
  onState: (state: MascotState) => void;
  onPlacement: (placement: MascotPlacement) => void;
  onBark: (pillId: number, text: string) => void;
}

const MEASURE_ATTEMPTS = 6;
const MEASURE_RETRY_MS = 60;

const measureNode = (node: ViewHandle | null | undefined) =>
  new Promise<Rect | null>((resolve) => {
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pulse = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

/**
 * Barnaby's controller. One instance lives for the whole app and drives the
 * single persistent mascot through STATE_ENTER → resting states → STATE_EXIT
 * as screens claim and release their anchors.
 */
export class MascotMachine {
  readonly anim: MascotAnimations = {
    travelX: new Animated.Value(0),
    facing: new Animated.Value(1),
    poseY: new Animated.Value(0),
    poseScale: new Animated.Value(1),
    poseRotate: new Animated.Value(0),
    opacity: new Animated.Value(0),
  };

  private state: MascotState = 'STATE_HIDDEN';
  private placement: MascotPlacement | null = null;
  /** Anchor of the focused screen. */
  private active: AnchorRequest | null = null;
  /** Anchor that claimed while Barnaby was still leaving the previous screen. */
  private pending: AnchorRequest | null = null;
  private direction: Direction = 'forward';
  private field: FieldKind | null = null;
  /** True from the moment Barnaby starts leaving until he is off-screen. */
  private leaving = false;
  private woofTimer: ReturnType<typeof setTimeout> | null = null;
  /** Searching for walkers: rest in STATE_SCANNING instead of idling. */
  private scanning = false;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  /** Out on a walk: rest in STATE_WALKING, facing the direction of travel. */
  private walking = false;
  private heading: 1 | -1 = 1;
  /** Brief curious tilt after an option is flipped. */
  private glancing = false;
  private glanceTimer: ReturnType<typeof setTimeout> | null = null;
  private pillSeq = 0;
  private stage: ViewHandle | null = null;
  private haptics = true;

  constructor(private readonly events: MachineEvents) {}

  attachStage = (node: ViewHandle | null) => {
    this.stage = node;
  };

  /** "Haptic paw taps" preference: arrival and bark pulses. */
  setHapticsEnabled = (enabled: boolean) => {
    this.haptics = enabled;
  };

  /** A focused screen's anchor is ready (its transition has finished). */
  claim = (request: AnchorRequest) => {
    this.active = request;
    if (this.leaving) {
      this.pending = request;
    } else if (this.state === 'STATE_HIDDEN') {
      void this.arrive(request);
    } else if (this.placement?.id === request.id) {
      void this.refreshPlacement(request);
    } else {
      // Still standing on a screen that went away without a release.
      this.pending = request;
      this.leave('back');
    }
  };

  /** The anchor's screen lost focus. */
  release = (id: string) => {
    if (this.active?.id === id) this.active = null;
    if (this.pending?.id === id) this.pending = null;
    if (this.placement?.id === id && !this.leaving && this.state !== 'STATE_HIDDEN') {
      // Left without one of our CTAs (system back / swipe): walk off with the screen.
      this.leave('back');
    }
  };

  /** The anchor or its viewport moved (layout change, keyboard resize). */
  remeasure = (id?: string) => {
    const request = this.active;
    if (!request || (id !== undefined && request.id !== id)) return;
    if (this.placement?.id !== request.id || this.leaving) return;
    void this.refreshPlacement(request);
  };

  /** STATE_EXIT: hop, turn, sprint off — and start the navigation as he sprints. */
  navigate = (go: () => void, direction: Direction = 'forward') => {
    if (this.leaving) return;
    // This screen is going away: an arrival still being measured must not land on it.
    this.active = null;
    this.field = null;
    Keyboard.dismiss();
    this.leave(direction, go);
  };

  /** STATE_WOOF_BARK: pets, treats and quick care actions. */
  bark = () => this.woof(DEFAULT_WOOF);

  /** STATE_WOOF_BARK with a custom speech pill, e.g. "Woof! Let's go! 🐾". */
  barkWith = (text: string) => this.woof(text);

  private woof(text: string) {
    this.pillSeq += 1;
    this.events.onBark(this.pillSeq, text);
    this.pulse();
    if (!isResting(this.state)) return; // travelling or hidden: the pill and counter are enough

    this.clearWoof();
    this.setState('STATE_WOOF_BARK');
    const rest = POSES[this.restingState()];
    const { poseY, poseScale, poseRotate } = this.anim;
    this.stopPose();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(poseY, {
          toValue: rest.y + PHYSICS.woof.hopY,
          duration: PHYSICS.woof.upMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(poseScale, {
          toValue: PHYSICS.woof.scale,
          duration: PHYSICS.woof.upMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(poseRotate, {
          toValue: rest.rotate,
          duration: PHYSICS.woof.upMs,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
      Animated.parallel([
        Animated.spring(poseY, { toValue: rest.y, ...PHYSICS.hopSpring, useNativeDriver: NATIVE_DRIVER }),
        Animated.spring(poseScale, {
          toValue: rest.scale,
          ...PHYSICS.hopSpring,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    this.woofTimer = setTimeout(() => {
      this.woofTimer = null;
      if (this.state === 'STATE_WOOF_BARK') this.settle();
    }, WOOF_DURATION_MS);
  }

  /** STATE_CURIOUS_TILT for text fields, STATE_PEEKING_DUCK for passwords. */
  focusField = (kind: FieldKind) => {
    this.field = kind;
    if (this.canReact()) this.settle();
  };

  blurField = () => {
    this.field = null;
    if (this.canReact()) this.settle();
  };

  /** A short STATE_CURIOUS_TILT, e.g. when a walk option is flipped. */
  glance = () => {
    if (this.glanceTimer) clearTimeout(this.glanceTimer);
    this.glancing = true;
    if (this.canReact()) this.settle();
    this.glanceTimer = setTimeout(() => {
      this.glanceTimer = null;
      this.glancing = false;
      if (this.canReact()) this.settle();
    }, PHYSICS.glanceMs);
  };

  /** STATE_SCANNING: walk in place, looking left and right, until switched off. */
  setScanning = (on: boolean) => {
    this.scanning = on;
    if (this.canReact()) this.settle();
  };

  /** STATE_WALKING: walking frames while his pin travels a route. */
  setWalking = (on: boolean) => {
    this.walking = on;
    if (this.canReact()) this.settle();
  };

  /** Face the direction of travel while walking (1 = right, -1 = left). */
  face = (direction: 1 | -1) => {
    if (direction === this.heading) return;
    this.heading = direction;
    if (this.state === 'STATE_WALKING') this.turnTo(direction);
  };

  dispose() {
    this.clearWoof();
    if (this.glanceTimer) clearTimeout(this.glanceTimer);
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.stopAll();
  }

  // ─── Transitions ────────────────────────────────────────────────────────────

  private async arrive(request: AnchorRequest) {
    const placement = await this.measure(request);
    if (!placement || this.active !== request || this.leaving || this.state !== 'STATE_HIDDEN') {
      return;
    }
    this.setPlacement(placement);
    this.enter(placement);
  }

  /** STATE_ENTER_FROM_RIGHT / _LEFT: spring in with walking frames, then rest. */
  private enter(placement: MascotPlacement) {
    const { travelX, facing, poseY, poseScale, poseRotate, opacity } = this.anim;
    const fromRight = this.direction === 'forward';
    this.stopAll();
    travelX.setValue(this.offscreenX(placement, fromRight ? 'right' : 'left'));
    facing.setValue(fromRight ? -1 : 1);
    poseY.setValue(0);
    poseScale.setValue(1);
    poseRotate.setValue(0);
    opacity.setValue(1);
    this.setState(fromRight ? 'STATE_ENTER_FROM_RIGHT' : 'STATE_ENTER_FROM_LEFT');

    Animated.spring(travelX, {
      toValue: placement.left,
      ...PHYSICS.enterSpring,
      useNativeDriver: NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (!finished) return;
      this.pulse();
      Animated.timing(facing, {
        toValue: 1,
        duration: PHYSICS.turnMs,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
      this.direction = 'forward';
      this.settle();
    });
  }

  /** STATE_EXIT_TO_LEFT / _RIGHT: anticipation hop, turn, sprint off-screen. */
  private leave(direction: Direction, onDepart?: () => void) {
    this.leaving = true;
    this.direction = direction;
    this.clearWoof();
    this.stopAll();

    const placement = this.placement;
    if (!placement || this.state === 'STATE_HIDDEN') {
      onDepart?.();
      this.finishLeave();
      return;
    }

    const toLeft = direction === 'forward';
    this.setState(toLeft ? 'STATE_EXIT_TO_LEFT' : 'STATE_EXIT_TO_RIGHT');
    const { travelX, facing, poseY, poseScale, poseRotate } = this.anim;
    const { anticipation } = PHYSICS;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(poseY, {
          toValue: anticipation.hopY,
          duration: anticipation.upMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(poseScale, {
          toValue: anticipation.scale,
          duration: anticipation.upMs,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(poseRotate, {
          toValue: 0,
          duration: anticipation.upMs,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
      Animated.parallel([
        Animated.timing(poseY, {
          toValue: 0,
          duration: anticipation.downMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(poseScale, {
          toValue: 1,
          duration: anticipation.downMs,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    ]).start(() => {
      facing.setValue(toLeft ? -1 : 1);
      // The next screen slides in while Barnaby sprints out.
      onDepart?.();
      Animated.timing(travelX, {
        toValue: this.offscreenX(placement, toLeft ? 'left' : 'right'),
        duration: PHYSICS.exitMs,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: NATIVE_DRIVER,
      }).start(() => this.finishLeave());
    });
  }

  private finishLeave() {
    this.anim.opacity.setValue(0);
    this.setState('STATE_HIDDEN');
    this.leaving = false;
    const next = this.pending;
    this.pending = null;
    if (next && this.active === next) void this.arrive(next);
  }

  /** Moves into whichever resting pose the current input focus calls for. */
  private settle() {
    const next = this.restingState();
    this.setState(next);
    this.animatePose(POSES[next]);
  }

  private restingState(): RestingState {
    if (this.field === 'password') return 'STATE_PEEKING_DUCK';
    if (this.field === 'text' || this.glancing) return 'STATE_CURIOUS_TILT';
    if (this.scanning) return 'STATE_SCANNING';
    if (this.walking) return 'STATE_WALKING';
    return 'STATE_IDLE_CENTER';
  }

  /** Resting on an anchor and free to react (not mid-woof). */
  private canReact() {
    return isResting(this.state) && this.state !== 'STATE_WOOF_BARK';
  }

  private animatePose(target: Pose) {
    const { poseY, poseScale, poseRotate } = this.anim;
    this.stopPose();
    Animated.parallel([
      Animated.spring(poseY, { toValue: target.y, ...PHYSICS.poseSpring, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(poseScale, {
        toValue: target.scale,
        ...PHYSICS.poseSpring,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.spring(poseRotate, {
        toValue: target.rotate,
        ...PHYSICS.poseSpring,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();
  }

  // ─── Measurement ────────────────────────────────────────────────────────────

  private async refreshPlacement(request: AnchorRequest) {
    const placement = await this.measure(request);
    if (!placement || this.active !== request || this.leaving) return;
    const previous = this.placement;
    this.setPlacement(placement);
    if (isResting(this.state) && previous?.left !== placement.left) {
      this.anim.travelX.setValue(placement.left);
    }
  }

  private async measure(request: AnchorRequest): Promise<MascotPlacement | null> {
    for (let attempt = 0; attempt < MEASURE_ATTEMPTS; attempt += 1) {
      const [stage, viewport, origin, anchor, clip] = await Promise.all([
        measureNode(this.stage),
        measureNode(request.scroll.viewportRef.current),
        measureNode(request.scroll.originRef.current),
        measureNode(request.anchorRef.current),
        measureNode(request.clipRef?.current),
      ]);

      if (stage && viewport && origin && anchor && anchor.width > 0 && viewport.width > 0) {
        // The content origin sits at viewport.y - scrollOffset, so this is scroll-independent.
        const toContentY = (windowY: number) => windowY - origin.y;
        return {
          id: request.id,
          size: request.size,
          viewport: {
            x: viewport.x - stage.x,
            y: viewport.y - stage.y,
            width: viewport.width,
            height: viewport.height,
          },
          left: anchor.x - viewport.x + (anchor.width - request.size) / 2,
          top: toContentY(anchor.y) + (anchor.height - request.size) / 2,
          clipLine: clip ? toContentY(clip.y) : null,
          contentShift: Animated.multiply(request.scroll.scrollY, -1),
          offset: request.offset ?? null,
        };
      }
      await wait(MEASURE_RETRY_MS);
    }
    return null;
  }

  private offscreenX(placement: MascotPlacement, side: 'left' | 'right') {
    return side === 'left'
      ? -(placement.size + PHYSICS.edgePadding)
      : placement.viewport.width + PHYSICS.edgePadding;
  }

  // ─── Plumbing ───────────────────────────────────────────────────────────────

  private pulse() {
    if (this.haptics) pulse();
  }

  private setState(state: MascotState) {
    const previous = this.state;
    this.state = state;
    if (state === 'STATE_SCANNING' && previous !== 'STATE_SCANNING') this.startScanTurns();
    else if (previous === 'STATE_SCANNING' && state !== 'STATE_SCANNING') this.stopScanTurns();
    if (state === 'STATE_WALKING' && previous !== 'STATE_WALKING') this.turnTo(this.heading);
    else if (previous === 'STATE_WALKING' && state !== 'STATE_WALKING') this.turnTo(1);
    this.events.onState(state);
  }

  private turnTo(direction: 1 | -1) {
    this.anim.facing.stopAnimation();
    Animated.timing(this.anim.facing, {
      toValue: direction,
      duration: PHYSICS.turnMs,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }

  private startScanTurns() {
    let lookingLeft = false;
    this.scanTimer = setInterval(() => {
      lookingLeft = !lookingLeft;
      Animated.timing(this.anim.facing, {
        toValue: lookingLeft ? -1 : 1,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    }, PHYSICS.scanTurnMs);
  }

  private stopScanTurns() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.anim.facing.stopAnimation();
    Animated.timing(this.anim.facing, {
      toValue: 1,
      duration: PHYSICS.turnMs,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }

  private setPlacement(placement: MascotPlacement) {
    this.placement = placement;
    this.events.onPlacement(placement);
  }

  private clearWoof() {
    if (this.woofTimer) {
      clearTimeout(this.woofTimer);
      this.woofTimer = null;
    }
  }

  private stopPose() {
    this.anim.poseY.stopAnimation();
    this.anim.poseScale.stopAnimation();
    this.anim.poseRotate.stopAnimation();
  }

  private stopAll() {
    this.stopPose();
    this.anim.travelX.stopAnimation();
    this.anim.facing.stopAnimation();
  }
}
