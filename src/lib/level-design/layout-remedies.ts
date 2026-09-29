/**
 * "Tweak params or reseed" — answered by the app instead of the designer.
 *
 * A fragmented preview used to end in that advice and nothing else, and the
 * advice is often wrong: at the wizard defaults WFC stays fragmented on every
 * seed and every corridor width, and only a larger room band connects it, while
 * a cellular cave is one toggle ('Ensure Connected') away from one region. The
 * preview is pure and seeded (`generatePreview` over FRandomStream, ~0.3-4 ms at
 * the preview cap), so every candidate the designer could try by hand can be
 * TRIED here, deterministically, on an explicit click.
 *
 * {@link findLayoutRemedies} returns only what it measured to connect:
 *  - seedScan — the next {@link REMEDY_SEED_SCAN} seeds after the current one;
 *  - remedies — for each lever the browser preview READS for this algorithm
 *    (derived from `specFieldsIgnoredBy('browser-preview', spec)`, never listed
 *    per algorithm here), the smallest in-range step that gives one region at
 *    the CURRENT seed, with the stats it produced.
 * Total work is capped by {@link REMEDY_PREVIEW_BUDGET}; nothing is cached.
 */
import { hashSeed } from './frandom-stream';
import { normalizeRoomBand } from './algo-params';
import { generatePreview, type PreviewStats } from './procgen-preview';
import {
  PROCGEN_ENGINES, SPEC_FIELD_LABELS, previewConfigFromSpec, specFieldsIgnoredBy, specFieldValue,
  type ProcgenSpec, type ProcgenSpecField, type ProcgenConstraints,
} from './procgen-spec';

/** Seeds tried after the current one. Kept <= 100: a remedy found further out is not "nearby". */
export const REMEDY_SEED_SCAN = 64;
/** Connected seeds returned (best-ranked first). */
export const REMEDY_SEED_KEEP = 3;
/** Hard cap on `generatePreview` calls per diagnosis, baseline included. */
export const REMEDY_PREVIEW_BUDGET = 96;

/** The wizard's slider ranges — a remedy never proposes a value a designer could not set by hand. */
export const REMEDY_SLIDER_BOUNDS = {
  grid: { min: 16, max: 512, step: 16 },
  roomCountMin: { min: 1, max: 50 },
  roomCountMax: { min: 1, max: 100 },
  corridorWidth: { min: 1, max: 10 },
} as const;

type SizeKey = 'gridWidth' | 'gridHeight' | 'roomCountMin' | 'roomCountMax' | 'corridorWidth';

/** What a remedy changes: size fields and/or constraint toggles. Never the seed or algorithm. */
export type RemedyPatch = Partial<Pick<ProcgenSpec, SizeKey>> & { constraints?: Partial<ProcgenConstraints> };

export interface LeverRemedy {
  field: ProcgenSpecField;
  /** "Room count band 8-15 → 32-60" — the old value stays on screen beside the new one. */
  label: string;
  patch: RemedyPatch;
  /** The preview stats the patched spec produced at the current seed (regions === 1). */
  after: PreviewStats;
}

export interface SeedCandidate {
  seedValue: number;
  /** What to type into the seed field (hashes back to `seedValue`). */
  seedLabel: string;
  /** Distance from the current seed. */
  offset: number;
  after: PreviewStats;
}

export type LayoutDiagnosis =
  | { needed: false; current: PreviewStats }
  | {
      needed: true;
      current: PreviewStats;
      seedScan: { from: number; tried: number; found: number; connected: SeedCandidate[] };
      remedies: LeverRemedy[];
      /** One honest line: what connects, or that nothing in range does. */
      verdict: string;
      previewCalls: number;
    };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snapGrid = (v: number) => {
  const { min, max, step } = REMEDY_SLIDER_BOUNDS.grid;
  return clamp(Math.round(v / step) * step, min, max);
};

/** The candidate patches for one lever, smallest change first. Only levers with steps appear here. */
const LEVER_STEPS: Partial<Record<ProcgenSpecField, (s: ProcgenSpec) => RemedyPatch[]>> = {
  roomBand: (s) => [2, 0.5, 3, 4, 6].map((f) => {
    const b = normalizeRoomBand(s.roomCountMin, s.roomCountMax);
    const lo = clamp(Math.round(b.min * f), REMEDY_SLIDER_BOUNDS.roomCountMin.min, REMEDY_SLIDER_BOUNDS.roomCountMin.max);
    const hi = clamp(Math.round(b.max * f), REMEDY_SLIDER_BOUNDS.roomCountMax.min, REMEDY_SLIDER_BOUNDS.roomCountMax.max);
    return { roomCountMin: Math.min(lo, hi), roomCountMax: Math.max(lo, hi) };
  }),
  corridorWidth: (s) => {
    const { min, max } = REMEDY_SLIDER_BOUNDS.corridorWidth;
    const all = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return all
      .sort((a, b) => Math.abs(a - s.corridorWidth) - Math.abs(b - s.corridorWidth) || b - a)
      .map((corridorWidth) => ({ corridorWidth }));
  },
  gridSize: (s) => [2, 0.5, 1.5, 0.75].map((f) => ({ gridWidth: snapGrid(s.gridWidth * f), gridHeight: snapGrid(s.gridHeight * f) })),
  ensureConnected: (s) => (s.constraints.ensureConnected ? [] : [{ constraints: { ensureConnected: true } }]),
};

/** The spec with a remedy's patch applied. Pure — the input is never touched. */
export function applyRemedy(spec: ProcgenSpec, remedy: Pick<LeverRemedy, 'patch'>): ProcgenSpec {
  const { constraints, ...size } = remedy.patch;
  return { ...spec, ...size, constraints: { ...spec.constraints, ...constraints } };
}

/** The spec at another seed, resolved the way the reducer resolves it. */
export function specAtSeed(spec: ProcgenSpec, seedValue: number): ProcgenSpec {
  const seedLabel = String(seedValue);
  return { ...spec, seedLabel, seedValue: hashSeed(seedLabel) };
}

function describePatch(spec: ProcgenSpec, field: ProcgenSpecField, patched: ProcgenSpec): string {
  return `${SPEC_FIELD_LABELS[field]} ${specFieldValue(spec, field)} → ${specFieldValue(patched, field)}`;
}

function samePatch(spec: ProcgenSpec, patch: RemedyPatch): boolean {
  const next = applyRemedy(spec, { patch });
  return (Object.keys(patch) as (keyof RemedyPatch)[]).every((k) =>
    k === 'constraints' ? next.constraints.ensureConnected === spec.constraints.ensureConnected : next[k] === spec[k]);
}

/**
 * Diagnose a layout and list the verified ways to connect it. `current` may be
 * passed when the caller already holds this spec's preview stats; otherwise it
 * costs one preview.
 */
export function findLayoutRemedies(spec: ProcgenSpec, current?: PreviewStats): LayoutDiagnosis {
  let calls = 0;
  const run = (s: ProcgenSpec): PreviewStats | null => {
    if (calls >= REMEDY_PREVIEW_BUDGET) return null;
    calls++;
    return generatePreview(previewConfigFromSpec(s)).stats;
  };
  const base = current ?? run(spec)!;
  if (base.regions <= 1) return { needed: false, current: base };

  // Levers: only fields this algorithm's preview reads, per the engine matrix.
  const ignored = new Set(specFieldsIgnoredBy('browser-preview', spec));
  const live = PROCGEN_ENGINES['browser-preview'].reads.filter((f) => !ignored.has(f));
  const remedies: LeverRemedy[] = [];
  for (const field of live) {
    const steps = LEVER_STEPS[field]?.(spec) ?? [];
    for (const patch of steps) {
      if (samePatch(spec, patch)) continue;
      const patched = applyRemedy(spec, { patch });
      const after = run(patched);
      if (after?.regions === 1) {
        remedies.push({ field, label: describePatch(spec, field, patched), patch, after });
        break;
      }
    }
  }

  // Seeds: the next REMEDY_SEED_SCAN, ranked by room count nearest the band
  // midpoint when the algorithm reads the band, then by distance.
  const found: SeedCandidate[] = [];
  let tried = 0;
  for (let offset = 1; offset <= REMEDY_SEED_SCAN; offset++) {
    const at = specAtSeed(spec, (spec.seedValue + offset) | 0);
    const after = run(at);
    if (!after) break;
    tried++;
    if (after.regions === 1) found.push({ seedValue: at.seedValue, seedLabel: at.seedLabel, offset, after });
  }
  const band = normalizeRoomBand(spec.roomCountMin, spec.roomCountMax);
  const mid = (band.min + band.max) / 2;
  const bandLive = !ignored.has('roomBand');
  const ranked = [...found].sort((a, b) =>
    (bandLive ? Math.abs(a.after.roomCount - mid) - Math.abs(b.after.roomCount - mid) : 0) || a.offset - b.offset);

  const leverNames = live.filter((f) => LEVER_STEPS[f]).map((f) => SPEC_FIELD_LABELS[f]).join(', ');
  const verdict = found.length === 0 && remedies.length === 0
    ? `Nothing in range connects this layout: none of the next ${tried} seeds, and no single step of ${leverNames}, produced one region.`
    : `${found.length} of the next ${tried} seeds connect; ${remedies.length} single lever change${remedies.length === 1 ? '' : 's'} connect${remedies.length === 1 ? 's' : ''} at this seed.`;

  return {
    needed: true,
    current: base,
    seedScan: { from: spec.seedValue, tried, found: found.length, connected: ranked.slice(0, REMEDY_SEED_KEEP) },
    remedies,
    verdict,
    previewCalls: calls,
  };
}
