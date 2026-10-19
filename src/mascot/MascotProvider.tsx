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
  focusField: (kind: FieldKind) => void;
  blurField: () => void;
  /** Plays STATE_EXIT and calls `go` as Barnaby sprints off, so the next screen slides in with him. */
  navigate: (go: () => void, direction?: Direction) => void;
  /** Register-screen readiness drives the tail wag from 8 fps up to 18 fps. */
  setWagFps: (fps: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
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
  pills: number[];
  dismissPill: (id: number) => void;
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
  const [pills, setPills] = useState<number[]>([]);
  const [hapticsEnabled, setHapticsState] = useState(true);

  const [machine] = useState(
    () =>
      new MascotMachine({
        onState: setState,
        onPlacement: setPlacement,
        onBark: (pillId) => {
          setDelight((count) => count + 1);
          setPills((current) => [...current, pillId]);
        },
      })
  );

  useEffect(() => () => machine.dispose(), [machine]);

  const dismissPill = useCallback((id: number) => {
    setPills((current) => current.filter((pill) => pill !== id));
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
      focusField: machine.focusField,
      blurField: machine.blurField,
      navigate: machine.navigate,
      setWagFps,
      setHapticsEnabled,
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
