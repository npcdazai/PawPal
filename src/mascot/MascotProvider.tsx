import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  PHYSICS,
  TRACK,
  WOOF_DURATION_MS,
  type Direction,
  type FieldKind,
  type MascotState,
} from './mascotModel';

const DEFAULT_WOOF = 'Woof! 🐾';

export interface NavigateOptions {
  /** Tab switches: no exit, and the next screen's Barnaby is simply already there. */
  inPlace?: boolean;
}

export interface MascotActions {
  bark: () => void;
  /** Bark with a custom speech pill, e.g. "Woof! Let's go! 🐾". */
  barkWith: (text: string) => void;
  focusField: (kind: FieldKind) => void;
  blurField: () => void;
  /**
   * Forward CTAs: plays EXITING (380ms) in the current slot, then calls `go`.
   * Navigation is locked while he exits. Back moves and tab switches go at once.
   */
  navigate: (go: () => void, direction?: Direction, options?: NavigateOptions) => void;
  /** Register-screen readiness drives the tail wag from 8 fps up to 18 fps. */
  setWagFps: (fps: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  /** Brief STATE_CURIOUS_TILT when the user flips an option. */
  glance: () => void;
  /** STATE_SCANNING while searching (walks in place, looking around). */
  setScanning: (on: boolean) => void;
  /** STATE_WALKING while his pin travels a walk route. */
  setWalking: (on: boolean) => void;
  /** Direction of travel while walking (1 = right, -1 = left). */
  face: (direction: 1 | -1) => void;
}

/** Slow-changing status for screens; Barnaby's FSM state lives in its own context. */
export interface MascotStatus {
  /** Pets, treats and celebrations this session. */
  delight: number;
  hapticsEnabled: boolean;
}

export interface WoofPillData {
  id: number;
  text: string;
}

/** Where a slot's Barnaby is on its track. */
export type SlotMotion = 'away' | 'entering' | 'resting' | 'exiting';

interface SlotHandle {
  /** Play EXITING (0 → -130%). */
  exit: () => void;
}

/** Shared mood and the slot registry. Only <MascotDockSlot /> reads this. */
export interface MascotSlotHub {
  /** The slot Barnaby is acting in: the focused screen's active slot. */
  currentId: string | null;
  currentMotion: SlotMotion;
  field: FieldKind | null;
  glancing: boolean;
  scanning: boolean;
  walking: boolean;
  heading: 1 | -1;
  woofing: boolean;
  wagFps: number;
  pills: readonly WoofPillData[];
  dismissPill: (id: number) => void;
  bark: () => void;
  pulse: () => void;
  /** A focused, active slot takes over; `inPlace` means skip the entrance. */
  claim: (id: string, handle: SlotHandle) => { inPlace: boolean };
  release: (id: string) => void;
  reportMotion: (id: string, motion: SlotMotion) => void;
}

const ActionsContext = createContext<MascotActions | null>(null);
const StatusContext = createContext<MascotStatus | null>(null);
// Changes several times per navigation, so only the few readers that show it subscribe.
const StateContext = createContext<MascotState | null>(null);
const HubContext = createContext<MascotSlotHub | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const [field, setField] = useState<FieldKind | null>(null);
  const [glancing, setGlancing] = useState(false);
  const [scanning, setScanningState] = useState(false);
  const [walking, setWalkingState] = useState(false);
  const [heading, setHeading] = useState<1 | -1>(1);
  const [woofing, setWoofing] = useState(false);
  const [wagFps, setWagFpsState] = useState<number>(PHYSICS.idleFps);
  const [pills, setPills] = useState<readonly WoofPillData[]>([]);
  const [delight, setDelight] = useState(0);
  const [hapticsEnabled, setHapticsState] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentMotion, setCurrentMotion] = useState<SlotMotion>('away');

  const slots = useRef<{ id: string; handle: SlotHandle }[]>([]);
  const motions = useRef(new Map<string, SlotMotion>());
  const haptics = useRef(true);
  const inPlaceNext = useRef(false);
  const exitLock = useRef(false);
  const pillSeq = useRef(0);
  const timers = useRef<{
    woof?: ReturnType<typeof setTimeout>;
    glance?: ReturnType<typeof setTimeout>;
    exit?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    const pending = timers.current;
    return () => {
      clearTimeout(pending.woof);
      clearTimeout(pending.glance);
      clearTimeout(pending.exit);
    };
  }, []);

  const pulse = useCallback(() => {
    if (haptics.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  const woof = useCallback(
    (text: string) => {
      pillSeq.current += 1;
      const id = pillSeq.current;
      setDelight((count) => count + 1);
      setPills((current) => [...current, { id, text }]);
      pulse();
      setWoofing(true);
      clearTimeout(timers.current.woof);
      timers.current.woof = setTimeout(() => setWoofing(false), WOOF_DURATION_MS);
    },
    [pulse]
  );

  const bark = useCallback(() => woof(DEFAULT_WOOF), [woof]);

  const dismissPill = useCallback((id: number) => {
    setPills((current) => current.filter((pill) => pill.id !== id));
  }, []);

  const syncCurrent = useCallback(() => {
    const top = slots.current[slots.current.length - 1]?.id ?? null;
    setCurrentId(top);
    setCurrentMotion(top ? (motions.current.get(top) ?? 'away') : 'away');
  }, []);

  const claim = useCallback(
    (id: string, handle: SlotHandle) => {
      slots.current = [...slots.current.filter((slot) => slot.id !== id), { id, handle }];
      syncCurrent();
      const inPlace = inPlaceNext.current;
      inPlaceNext.current = false;
      return { inPlace };
    },
    [syncCurrent]
  );

  const release = useCallback(
    (id: string) => {
      slots.current = slots.current.filter((slot) => slot.id !== id);
      syncCurrent();
    },
    [syncCurrent]
  );

  const reportMotion = useCallback((id: string, motion: SlotMotion) => {
    motions.current.set(id, motion);
    if (slots.current[slots.current.length - 1]?.id === id) setCurrentMotion(motion);
  }, []);

  const navigate = useCallback(
    (go: () => void, direction: Direction = 'forward', options: NavigateOptions = {}) => {
      // Locked while the current Barnaby plays his exit.
      if (exitLock.current) return;
      // Guardrail: reset input focus first, so no tilt or duck is carried into the next screen.
      setField(null);
      setGlancing(false);
      Keyboard.dismiss();

      inPlaceNext.current = Boolean(options.inPlace);
      const current = slots.current[slots.current.length - 1];
      if (options.inPlace || direction === 'back' || !current) {
        go();
        return;
      }

      // Forward CTA: EXITING first; only after it completes does the next screen mount.
      exitLock.current = true;
      current.handle.exit();
      timers.current.exit = setTimeout(() => {
        exitLock.current = false;
        go();
      }, TRACK.exitMs);
    },
    []
  );

  const setWagFps = useCallback((fps: number) => {
    setWagFpsState(Math.min(PHYSICS.idleFpsMax, Math.max(PHYSICS.idleFps, fps)));
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    haptics.current = enabled;
    setHapticsState(enabled);
  }, []);

  const glance = useCallback(() => {
    clearTimeout(timers.current.glance);
    setGlancing(true);
    timers.current.glance = setTimeout(() => setGlancing(false), PHYSICS.glanceMs);
  }, []);

  const actions = useMemo<MascotActions>(
    () => ({
      bark,
      barkWith: woof,
      focusField: setField,
      blurField: () => setField(null),
      navigate,
      setWagFps,
      setHapticsEnabled,
      glance,
      setScanning: setScanningState,
      setWalking: setWalkingState,
      face: setHeading,
    }),
    [bark, woof, navigate, setWagFps, setHapticsEnabled, glance]
  );

  const status = useMemo<MascotStatus>(() => ({ delight, hapticsEnabled }), [delight, hapticsEnabled]);

  const state: MascotState = (() => {
    if (!currentId || currentMotion === 'away') return 'STATE_HIDDEN';
    if (currentMotion === 'entering') return 'STATE_ENTER_FROM_RIGHT';
    if (currentMotion === 'exiting') return 'STATE_EXIT_TO_LEFT';
    if (woofing) return 'STATE_WOOF_BARK';
    if (field === 'password') return 'STATE_PEEKING_DUCK';
    if (field === 'text' || glancing) return 'STATE_CURIOUS_TILT';
    if (scanning) return 'STATE_SCANNING';
    if (walking) return 'STATE_WALKING';
    return 'STATE_IDLE_CENTER';
  })();

  const hub = useMemo<MascotSlotHub>(
    () => ({
      currentId,
      currentMotion,
      field,
      glancing,
      scanning,
      walking,
      heading,
      woofing,
      wagFps,
      pills,
      dismissPill,
      bark,
      pulse,
      claim,
      release,
      reportMotion,
    }),
    [
      currentId,
      currentMotion,
      field,
      glancing,
      scanning,
      walking,
      heading,
      woofing,
      wagFps,
      pills,
      dismissPill,
      bark,
      pulse,
      claim,
      release,
      reportMotion,
    ]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StatusContext.Provider value={status}>
        <StateContext.Provider value={state}>
          <HubContext.Provider value={hub}>{children}</HubContext.Provider>
        </StateContext.Provider>
      </StatusContext.Provider>
    </ActionsContext.Provider>
  );
}

function useRequired<T>(context: React.Context<T | null>, hook: string): T {
  const value = useContext(context);
  if (!value) throw new Error(`${hook} must be used inside <MascotProvider>`);
  return value;
}

export const useMascotActions = () => useRequired(ActionsContext, 'useMascotActions');
export const useMascotStatus = () => useRequired(StatusContext, 'useMascotStatus');
export const useMascotState = () => useRequired(StateContext, 'useMascotState');
export const useMascotSlotHub = () => useRequired(HubContext, 'useMascotSlotHub');
