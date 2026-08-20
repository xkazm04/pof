/**
 * The ONE procgen spec + result model, shared by every surface that asks for a
 * procedurally generated level.
 *
 * Before this module the two procgen surfaces shared nothing. The wizard held
 * `ProceduralLevelConfig` (algorithm + level type + grid + room band + corridor
 * width + 5 constraint toggles + a free-text seed) and produced a `CellType`
 * grid in the browser; the UE dungeon tab held `{ roomCount, seed }` and drove
 * `ARPGLevelGenerator` through `build_procgen_dungeon.py`, recording a
 * `ProcgenRun`. Two input shapes, two result shapes, no handoff.
 *
 * **What this model deliberately does NOT claim.** A shared type is not a
 * shared layout. The browser preview carves a grid with BSP / WFC / cellular /
 * Perlin; `ARPGLevelGenerator` places room-template ACTORS in world space from
 * a template pool and has no algorithm parameter at all. Feeding one spec to
 * both produces two different levels, and nothing here pretends otherwise:
 * {@link layoutAgreement} is the machine-readable statement of that, and
 * {@link specFieldsIgnoredBy} names, per engine, exactly which declared inputs
 * that engine throws away. A surface adopting a spec is expected to show them.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { ProcgenRun } from '@/types/procgen';
import { hashSeed } from './frandom-stream';
import { normalizeRoomBand, ignoresRoomParams, type PreviewAlgorithm } from './algo-params';
import type { PreviewConfig, PreviewResult } from './procgen-preview';
import { UE_ROOMS_MIN, UE_ROOMS_MAX } from './run-params';

export type ProcgenLevelType = 'dungeon' | 'openworld' | 'arena';

/** Gameplay toggles as DECLARED inputs — not prose assembled into a prompt. */
export interface ProcgenConstraints {
  spawnPoints: boolean;
  lootPlacement: boolean;
  bossRoom: boolean;
  secretRooms: boolean;
  safeZones: boolean;
}

/** Everything a procgen run is asked for. Every field is explicit, seed included. */
export interface ProcgenSpec {
  algorithm: PreviewAlgorithm;
  levelType: ProcgenLevelType;
  gridWidth: number;
  gridHeight: number;
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
  /** The seed exactly as a designer typed it (may be empty). */
  seedLabel: string;
  /** The resolved int32 seed. ALWAYS present — never re-derived at a call site. */
  seedValue: number;
  constraints: ProcgenConstraints;
}

export type ProcgenEngine = 'browser-preview' | 'ue-arpg-generator' | 'llm-codegen';

export type ProcgenSpecField =
  | 'algorithm' | 'levelType' | 'gridSize' | 'roomBand' | 'corridorWidth' | 'seed' | 'constraints';

export const PROCGEN_SPEC_FIELDS: readonly ProcgenSpecField[] = [
  'algorithm', 'levelType', 'gridSize', 'roomBand', 'corridorWidth', 'seed', 'constraints',
] as const;

export const SPEC_FIELD_LABELS: Record<ProcgenSpecField, string> = {
  algorithm: 'Algorithm',
  levelType: 'Level type',
  gridSize: 'Grid size',
  roomBand: 'Room count band',
  corridorWidth: 'Corridor width',
  seed: 'Seed',
  constraints: 'Gameplay constraints',
};

interface EngineFacts {
  label: string;
  /** What actually runs, named so a reader can go and check. */
  implementation: string;
  /** `deterministic` = same spec, same output. `unenforced` = an LLM authors the generator. */
  determinism: 'deterministic' | 'unenforced';
  /** Spec fields this engine's generator reads. Everything else is dropped. */
  reads: readonly ProcgenSpecField[];
}

export const PROCGEN_ENGINES: Record<ProcgenEngine, EngineFacts> = {
  'browser-preview': {
    label: 'Browser preview',
    implementation: 'generatePreview() — BSP / WFC / cellular / Perlin over a CellType grid, FRandomStream-seeded',
    determinism: 'deterministic',
    reads: ['algorithm', 'gridSize', 'roomBand', 'corridorWidth', 'seed'],
  },
  'ue-arpg-generator': {
    label: 'UE ARPGLevelGenerator',
    implementation: 'build_procgen_dungeon.py → AARPGLevelGenerator — places room-template actors from a pool in world space',
    determinism: 'deterministic',
    reads: ['roomBand', 'seed'],
  },
  'llm-codegen': {
    label: 'CLI C++ codegen',
    implementation: 'buildProceduralLevelPrompt() — the CLI authors a generator freehand from the spec',
    determinism: 'unenforced',
    reads: ['algorithm', 'levelType', 'gridSize', 'roomBand', 'corridorWidth', 'seed', 'constraints'],
  },
};

/**
 * The declared inputs `engine` will NOT read for this spec. `browser-preview`
 * narrows further per algorithm: cellular and Perlin have no room list and no
 * corridors, which `algo-params` already single-sources.
 */
export function specFieldsIgnoredBy(engine: ProcgenEngine, spec: ProcgenSpec): ProcgenSpecField[] {
  const reads = new Set<ProcgenSpecField>(PROCGEN_ENGINES[engine].reads);
  if (engine === 'browser-preview' && ignoresRoomParams(spec.algorithm)) {
    reads.delete('roomBand');
    reads.delete('corridorWidth');
  }
  return PROCGEN_SPEC_FIELDS.filter((f) => !reads.has(f));
}

/** The spec's own value for a field, so a disclosure names what is being dropped. */
export function specFieldValue(spec: ProcgenSpec, field: ProcgenSpecField): string {
  switch (field) {
    case 'algorithm': return spec.algorithm.toUpperCase();
    case 'levelType': return spec.levelType;
    case 'gridSize': return `${spec.gridWidth}x${spec.gridHeight}`;
    case 'roomBand': return `${spec.roomCountMin}-${spec.roomCountMax}`;
    case 'corridorWidth': return `${spec.corridorWidth}`;
    case 'seed': return spec.seedLabel.trim() === '' ? `(default) ${spec.seedValue}` : spec.seedLabel;
    case 'constraints': {
      const on = (Object.keys(spec.constraints) as (keyof ProcgenConstraints)[])
        .filter((k) => spec.constraints[k]);
      return on.length > 0 ? `${on.length} on` : 'none on';
    }
  }
}

/** One line per dropped input: what it is set to, and that this engine ignores it. */
export function describeIgnoredFields(engine: ProcgenEngine, spec: ProcgenSpec): string[] {
  return specFieldsIgnoredBy(engine, spec)
    .map((f) => `${SPEC_FIELD_LABELS[f]} (${specFieldValue(spec, f)})`);
}

export interface LayoutAgreement {
  /** True only when one spec provably yields the same layout on both engines. */
  agree: boolean;
  reason: string;
}

/**
 * Whether two engines reproduce each other's LAYOUT from one spec. Every
 * cross-engine pair is `false` with the structural reason — a shared spec type
 * must never be read as a promise that the UE bake matches the preview.
 */
export function layoutAgreement(a: ProcgenEngine, b: ProcgenEngine): LayoutAgreement {
  if (a === b) {
    return PROCGEN_ENGINES[a].determinism === 'deterministic'
      ? { agree: true, reason: `${PROCGEN_ENGINES[a].label} is seeded — the same spec replays the same layout.` }
      : { agree: false, reason: `${PROCGEN_ENGINES[a].label} authors the generator freehand, so two runs of one spec need not match.` };
  }
  const pair = [a, b].sort().join('|');
  if (pair === 'browser-preview|ue-arpg-generator') {
    return {
      agree: false,
      reason: 'The browser preview carves a cell grid; ARPGLevelGenerator places room-template actors in world space and takes no algorithm parameter. They share the seed and the room target, never the layout.',
    };
  }
  return {
    agree: false,
    reason: `${PROCGEN_ENGINES[a].label} and ${PROCGEN_ENGINES[b].label} run different generators; only the declared spec is shared, not the layout.`,
  };
}

// ── Spec construction ──

/** Build a spec from the wizard's own state. `seedValue` is resolved here, once. */
export function buildProcgenSpec(input: {
  algorithm: PreviewAlgorithm;
  levelType: ProcgenLevelType;
  gridWidth: number; gridHeight: number;
  roomCountMin: number; roomCountMax: number;
  corridorWidth: number;
  seed: string;
  constraints: ProcgenConstraints;
}): ProcgenSpec {
  return {
    algorithm: input.algorithm,
    levelType: input.levelType,
    gridWidth: input.gridWidth,
    gridHeight: input.gridHeight,
    roomCountMin: input.roomCountMin,
    roomCountMax: input.roomCountMax,
    corridorWidth: input.corridorWidth,
    seedLabel: input.seed,
    seedValue: hashSeed(input.seed),
    constraints: { ...input.constraints },
  };
}

/** The browser preview's input, derived from the spec rather than beside it. */
export function previewConfigFromSpec(spec: ProcgenSpec, maxPreviewSize?: number): PreviewConfig {
  return {
    algorithm: spec.algorithm,
    gridWidth: spec.gridWidth,
    gridHeight: spec.gridHeight,
    roomCountMin: spec.roomCountMin,
    roomCountMax: spec.roomCountMax,
    corridorWidth: spec.corridorWidth,
    seed: spec.seedLabel,
    ...(maxPreviewSize === undefined ? {} : { maxPreviewSize }),
  };
}

export interface UeDungeonParams {
  roomCount: number;
  seed: number;
  /** Every lossy step taken to fit the spec into the UE panel's two fields. */
  notes: string[];
}

/**
 * Project the spec onto what the UE dungeon panel can actually hold. The band
 * collapse, the clamp and the unsigned seed cast are each REPORTED — a handoff
 * that silently reshapes the request is the overclaim this model exists to stop.
 */
export function ueDungeonParamsFromSpec(spec: ProcgenSpec): UeDungeonParams {
  const band = normalizeRoomBand(spec.roomCountMin, spec.roomCountMax);
  const target = Math.round((band.min + band.max) / 2);
  const roomCount = Math.min(UE_ROOMS_MAX, Math.max(UE_ROOMS_MIN, target));
  // int32 → uint32 keeps the panel's "seed >= 0" rule while `| 0` on the UE side
  // recovers the identical int32, so the cast is lossless rather than clamping.
  const seed = spec.seedValue >>> 0;

  const notes: string[] = [];
  if (band.min !== band.max) {
    notes.push(`Room band ${band.min}-${band.max} collapsed to ${target} — ARPGLevelGenerator takes one TargetRoomCount, not a range.`);
  }
  if (roomCount !== target) {
    notes.push(`Room count ${target} clamped to ${roomCount} — the UE panel accepts ${UE_ROOMS_MIN}-${UE_ROOMS_MAX}.`);
  }
  if (seed !== spec.seedValue) {
    notes.push(`Seed ${spec.seedValue} sent as unsigned ${seed} — UE reads it back as the same int32.`);
  }
  return { roomCount, seed, notes };
}

// ── Results ──

export interface ProcgenResult {
  engine: ProcgenEngine;
  /** The spec the run was dispatched from, or null when the run recorded none. */
  spec: ProcgenSpec | null;
  specSource: 'declared' | 'unrecorded';
  seedValue: number;
  roomCount: number;
  success: boolean;
  /** '' on success, and never empty on a failure. */
  failureReason: string;
  /** Only an in-process engine returns cells; a UE run reports counts, not a grid. */
  grid: CellType[][] | null;
}

/** The browser preview as a ProcgenResult — the spec is known because we hold it. */
export function browserPreviewResult(spec: ProcgenSpec, preview: PreviewResult): ProcgenResult {
  return {
    engine: 'browser-preview',
    spec,
    specSource: 'declared',
    seedValue: preview.seedValue,
    roomCount: preview.stats.roomCount,
    success: true,
    failureReason: '',
    grid: preview.grid,
  };
}

/**
 * A recorded UE run as a ProcgenResult. Its spec is `unrecorded`, NOT
 * reconstructed: the ledger row holds a room count and a seed, so inventing an
 * algorithm or grid size for it would fabricate the very inputs this model is
 * meant to make explicit.
 */
export function ueRunResult(run: ProcgenRun): ProcgenResult {
  return {
    engine: 'ue-arpg-generator',
    spec: null,
    specSource: 'unrecorded',
    seedValue: run.seed,
    roomCount: run.roomCount,
    success: run.success,
    failureReason: run.failureReason,
    grid: null,
  };
}
