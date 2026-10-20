import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  MascotMachine,
  type AnchorRequest,
  type MascotAnimations,
  type MascotPlacement,
  type ViewHandle,
} from './MascotMachine';
import { type Direction, type FieldKind, type MascotState, PHYSICS } from './mascotModel';

export interface MascotActions {
  bark: () => void;
  /** Bark with a custom speech pill, e.g. "Woof! Let's go! 🐾". */
  barkWith: (text: string) => void;
  focusField: (kind: FieldKind) => void;
  blurField: () => void;
  /** Plays STATE_EXIT and calls `go` as Barnaby sprints off, so the next screen slides in with him. */
  navigate: (go: () => void, direction?: Direction) => void;
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

export interface MascotStatus {
  state: MascotState;
  /** Pets, treats and celebrations this session. */
  delight: number;
  hapticsEnabled: boolean;
}

interface MascotAnchorApi {
  claim: (request: AnchorRequest) => void;
  release: (id: string) => void;
  remeasure: (id?: string) => void;
}

interface MascotStageData {
  attachStage: (node: ViewHandle | null) => void;
  anim: MascotAnimations;
  bark: () => void;
  state: MascotState;
  placement: MascotPlacement | null;
  wagFps: number;
  pills: readonly WoofPillData[];
  dismissPill: (id: number) => void;
}

export interface WoofPillData {
  id: number;
  text: string;
}

const ActionsContext = createContext<MascotActions | null>(null);
const StatusContext = createContext<MascotStatus | null>(null);
const AnchorContext = createContext<MascotAnchorApi | null>(null);
const StageContext = createContext<MascotStageData | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MascotState>('STATE_HIDDEN');
  const [placement, setPlacement] = useState<MascotPlacement | null>(null);
  const [delight, setDelight] = useState(0);
  const [wagFps, setWagFpsState] = useState<number>(PHYSICS.idleFps);
  const [pills, setPills] = useState<readonly WoofPillData[]>([]);
  const [hapticsEnabled, setHapticsState] = useState(true);

  const [machine] = useState(
    () =>
      new MascotMachine({
        onState: setState,
        onPlacement: setPlacement,
        onBark: (pillId, text) => {
          setDelight((count) => count + 1);
          setPills((current) => [...current, { id: pillId, text }]);
        },
      })
  );

  useEffect(() => () => machine.dispose(), [machine]);

  const dismissPill = useCallback((id: number) => {
    setPills((current) => current.filter((pill) => pill.id !== id));
  }, []);

  const setWagFps = useCallback((fps: number) => {
    setWagFpsState(Math.min(PHYSICS.idleFpsMax, Math.max(PHYSICS.idleFps, fps)));
  }, []);

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      machine.setHapticsEnabled(enabled);
      setHapticsState(enabled);
    },
    [machine]
  );

  const actions = useMemo<MascotActions>(
    () => ({
      bark: machine.bark,
      barkWith: machine.barkWith,
      focusField: machine.focusField,
      blurField: machine.blurField,
      navigate: machine.navigate,
      setWagFps,
      setHapticsEnabled,
      glance: machine.glance,
      setScanning: machine.setScanning,
      setWalking: machine.setWalking,
      face: machine.face,
    }),
    [machine, setWagFps, setHapticsEnabled]
  );

  const anchorApi = useMemo<MascotAnchorApi>(
    () => ({ claim: machine.claim, release: machine.release, remeasure: machine.remeasure }),
    [machine]
  );

  const status = useMemo<MascotStatus>(
    () => ({ state, delight, hapticsEnabled }),
    [state, delight, hapticsEnabled]
  );

  const stage = useMemo<MascotStageData>(
    () => ({
      attachStage: machine.attachStage,
      anim: machine.anim,
      bark: machine.bark,
      state,
      placement,
      wagFps,
      pills,
      dismissPill,
    }),
    [machine, state, placement, wagFps, pills, dismissPill]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <AnchorContext.Provider value={anchorApi}>
        <StatusContext.Provider value={status}>
          <StageContext.Provider value={stage}>{children}</StageContext.Provider>
        </StatusContext.Provider>
      </AnchorContext.Provider>
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
export const useMascotAnchorApi = () => useRequired(AnchorContext, 'useMascotAnchorApi');
export const useMascotStage = () => useRequired(StageContext, 'useMascotStage');
