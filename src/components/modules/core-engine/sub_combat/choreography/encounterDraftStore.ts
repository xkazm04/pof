import { create } from 'zustand';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import type { PlacedEnemy, WaveDef } from '@/lib/combat/choreography-sim';
import type { TuningOverrides } from '@/types/combat-simulator';

/**
 * The Encounter Choreographer's ONE draft. Module-level (not component state)
 * because the Combat tab mounts each sub-tab under AnimatePresence keyed by the
 * tab, so a tab-local draft died on every tab switch. Memory-only by design: an
 * encounter edit is a what-if, never persisted (same as useLootTuningStore).
 *
 * Every change goes through the pure `encounterReducer`. Draft edits push an
 * undo snapshot (capped); selection changes and pinning a baseline do not.
 */

export interface EncounterDraft {
  enemies: PlacedEnemy[];
  waves: WaveDef[];
  tuning: TuningOverrides;
  playerLevel: number;
}

type Snapshot = EncounterDraft & { selectedWave: number };

export interface EncounterState extends EncounterDraft {
  selectedWave: number;
  selectedArchetype: string;
  placeLevel: number;
  /** The pinned run every later pass is diffed against (null = nothing pinned) */
  baseline: EncounterDraft | null;
  history: Snapshot[];
  /** Next placed-enemy id suffix (ids stay unique without a module counter) */
  nextSeq: number;
}

export type EncounterAction =
  | { type: 'placeEnemy'; x: number; y: number }
  | { type: 'moveEnemy'; id: string; x: number; y: number; wave?: number }
  | { type: 'removeEnemy'; id: string }
  | { type: 'addWave' }
  | { type: 'removeWave'; index: number }
  | { type: 'setWaveTime'; index: number; time: number }
  | { type: 'setTuning'; key: keyof TuningOverrides; value: number }
  | { type: 'resetTuning' }
  | { type: 'setPlayerLevel'; level: number }
  | { type: 'selectWave'; index: number }
  | { type: 'selectArchetype'; id: string }
  | { type: 'setPlaceLevel'; level: number }
  | { type: 'pinBaseline' }
  | { type: 'clearBaseline' }
  | { type: 'revertToBaseline' }
  | { type: 'undo' };

export const ENCOUNTER_HISTORY_CAP = 50;

const SEED_ENEMIES: PlacedEnemy[] = [
  { id: 'e1', archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
  { id: 'e2', archetypeId: 'melee-grunt', gridX: 4, gridY: 1, waveIndex: 0, level: 5 },
  { id: 'e3', archetypeId: 'ranged-caster', gridX: 3, gridY: 3, waveIndex: 0, level: 5 },
  { id: 'e4', archetypeId: 'brute', gridX: 2, gridY: 0, waveIndex: 1, level: 6 },
  { id: 'e5', archetypeId: 'elite-knight', gridX: 3, gridY: 1, waveIndex: 2, level: 7 },
];
const SEED_WAVES: WaveDef[] = [
  { spawnTimeSec: 0, label: 'Initial' },
  { spawnTimeSec: 8, label: 'Reinforcement' },
  { spawnTimeSec: 18, label: 'Boss Wave' },
];

export function initialEncounterState(): EncounterState {
  return {
    enemies: SEED_ENEMIES.map((e) => ({ ...e })),
    waves: SEED_WAVES.map((w) => ({ ...w })),
    tuning: { ...DEFAULT_TUNING },
    playerLevel: 5,
    selectedWave: 0,
    selectedArchetype: 'melee-grunt',
    placeLevel: 5,
    baseline: null,
    history: [],
    nextSeq: SEED_ENEMIES.length + 1,
  };
}

const draftOf = (s: EncounterDraft): EncounterDraft => ({
  enemies: s.enemies, waves: s.waves, tuning: s.tuning, playerLevel: s.playerLevel,
});

/** Apply a draft edit and push the pre-edit snapshot onto the capped history. */
function edit(s: EncounterState, patch: Partial<Snapshot>): EncounterState {
  const snap: Snapshot = { ...draftOf(s), selectedWave: s.selectedWave };
  return { ...s, ...patch, history: [...s.history, snap].slice(-ENCOUNTER_HISTORY_CAP) };
}

export function encounterReducer(s: EncounterState, a: EncounterAction): EncounterState {
  switch (a.type) {
    case 'placeEnemy':
      return {
        ...edit(s, { enemies: [...s.enemies, {
          id: `e${s.nextSeq}`, archetypeId: s.selectedArchetype, gridX: a.x, gridY: a.y,
          waveIndex: s.selectedWave, level: s.placeLevel,
        }] }),
        nextSeq: s.nextSeq + 1,
      };
    case 'moveEnemy':
      return edit(s, { enemies: s.enemies.map((e) => e.id === a.id
        ? { ...e, gridX: a.x, gridY: a.y, ...(a.wave !== undefined ? { waveIndex: a.wave } : {}) } : e) });
    case 'removeEnemy':
      return s.enemies.some((e) => e.id === a.id) ? edit(s, { enemies: s.enemies.filter((e) => e.id !== a.id) }) : s;
    case 'addWave': {
      const lastTime = s.waves[s.waves.length - 1]?.spawnTimeSec ?? 0;
      return edit(s, { waves: [...s.waves, { spawnTimeSec: lastTime + 10, label: `Wave ${s.waves.length}` }] });
    }
    case 'removeWave': {
      if (s.waves.length <= 1 || a.index < 0 || a.index >= s.waves.length) return s;
      const waves = s.waves.filter((_, i) => i !== a.index);
      const enemies = s.enemies.filter((e) => e.waveIndex !== a.index)
        .map((e) => (e.waveIndex > a.index ? { ...e, waveIndex: e.waveIndex - 1 } : e));
      const shifted = s.selectedWave >= a.index && s.selectedWave > 0 ? s.selectedWave - 1 : s.selectedWave;
      return edit(s, { waves, enemies, selectedWave: Math.min(shifted, waves.length - 1) });
    }
    case 'setWaveTime':
      return edit(s, { waves: s.waves.map((w, i) => (i === a.index ? { ...w, spawnTimeSec: Math.max(0, a.time) } : w)) });
    case 'setTuning':
      return s.tuning[a.key] === a.value ? s : edit(s, { tuning: { ...s.tuning, [a.key]: a.value } });
    case 'resetTuning':
      return edit(s, { tuning: { ...DEFAULT_TUNING } });
    case 'setPlayerLevel':
      return edit(s, { playerLevel: a.level });
    case 'selectWave':
      return { ...s, selectedWave: Math.max(0, Math.min(a.index, s.waves.length - 1)) };
    case 'selectArchetype':
      return { ...s, selectedArchetype: a.id };
    case 'setPlaceLevel':
      return { ...s, placeLevel: a.level };
    case 'pinBaseline':
      return { ...s, baseline: draftOf(s) };
    case 'clearBaseline':
      return s.baseline ? { ...s, baseline: null } : s;
    case 'revertToBaseline': {
      if (!s.baseline) return s;
      const b = s.baseline;
      return edit(s, { ...b, selectedWave: Math.min(s.selectedWave, b.waves.length - 1) });
    }
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      return prev ? { ...s, ...prev, history: s.history.slice(0, -1) } : s;
    }
  }
}

export interface EncounterDraftStore extends EncounterState {
  dispatch: (action: EncounterAction) => void;
}

export const useEncounterDraftStore = create<EncounterDraftStore>()((set) => ({
  ...initialEncounterState(),
  dispatch: (action) => set((s) => {
    const next = encounterReducer(s, action);
    return next === s ? s : next;
  }),
}));

/** Back to the seed encounter, no baseline, empty history (tests + a hard reset). */
export function resetEncounterDraft(): void {
  useEncounterDraftStore.setState(initialEncounterState());
}
