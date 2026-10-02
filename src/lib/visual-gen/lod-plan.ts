/**
 * LOD chain planning and grading, in TRIANGLES.
 *
 * Plan: each ratio becomes a triangle target from the MEASURED source count, and
 * LOD0 is stood against its asset class budget (`polycount-presets`). A missing
 * count plans no targets — a plan is never invented from a number nobody measured.
 *
 * Grade: each level is read from the `lod` receipt Blender printed after decimating
 * it. Within the 10% decimator tolerance (`BUDGET_OVERRUN_TOLERANCE`) it is
 * honoured; past it, over — and a ~2x overrun is attributed to the quad/triangle
 * unit trap by name; a level with no receipt is unmeasured, never a pass.
 */
import { parseReceipts } from '@/lib/blender-mcp/receipt';
import type { ExecuteOutput, Receipt } from '@/lib/blender-mcp/types';
import { BUDGET_OVERRUN_TOLERANCE, FACE_BUDGET_UNIT } from '@/lib/visual-gen/face-budget';
import { polycountFor } from '@/lib/visual-gen/polycount-presets';

/** Overrun ratio band read as the quad trap (a ratio computed from polygons, not triangles). */
const QUAD_TRAP_BAND: readonly [number, number] = [1.8, 2.2];
/** Below this fraction of its target a level lost more detail than it was asked to. */
const UNDERRUN_FLOOR = 2 - BUDGET_OVERRUN_TOLERANCE;

const fmt = (n: number) => n.toLocaleString('en-US');
const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Split a comma-separated ratio field into the (0,1) levels and the entries it rejected. */
export function parseLodRatios(text: string): { ratios: number[]; rejected: string[] } {
  const ratios: number[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const n = parseFloat(token);
    if (Number.isFinite(n) && n > 0 && n < 1) ratios.push(n);
    else rejected.push(token);
  }
  return { ratios, rejected };
}

export interface LodTarget {
  level: number;
  ratio: number;
  /** Undefined when the source was not measured. */
  targetTris?: number;
}

export type Lod0Verdict = 'within-target' | 'over-target' | 'over-ceiling' | 'unmeasured' | 'unclassed';

export interface Lod0Standing {
  tris?: number;
  verdict: Lod0Verdict;
  target?: number;
  ceiling?: number;
  reason: string;
}

export interface LodPlan {
  levels: LodTarget[];
  rejected: string[];
  lod0: Lod0Standing;
}

function standLod0(tris: number | undefined, assetClass: string): Lod0Standing {
  if (!usable(tris)) {
    return { verdict: 'unmeasured', reason: `source mesh not measured — read the scene meshes to plan in ${FACE_BUDGET_UNIT}` };
  }
  const preset = polycountFor(assetClass);
  if (!preset) {
    return { tris, verdict: 'unclassed', reason: `no asset class chosen — ${fmt(tris)} ${FACE_BUDGET_UNIT} is not graded against a budget` };
  }
  const budget = { target: preset.faceLimit, ceiling: preset.warnAbove };
  if (tris > preset.warnAbove) {
    return { tris, verdict: 'over-ceiling', ...budget, reason: `LOD0 ${fmt(tris)} ${FACE_BUDGET_UNIT} is over the ${preset.label} ceiling of ${fmt(preset.warnAbove)} — finish LOD0 before chaining LODs from it` };
  }
  if (tris > preset.faceLimit) {
    return { tris, verdict: 'over-target', ...budget, reason: `LOD0 ${fmt(tris)} ${FACE_BUDGET_UNIT} is over the ${preset.label} target of ${fmt(preset.faceLimit)} (ceiling ${fmt(preset.warnAbove)})` };
  }
  return { tris, verdict: 'within-target', ...budget, reason: `LOD0 ${fmt(tris)} ${FACE_BUDGET_UNIT} is within the ${preset.label} target of ${fmt(preset.faceLimit)}` };
}

export function planLodChain(input: { sourceTris: number | undefined; assetClass: string; ratiosText: string }): LodPlan {
  const { ratios, rejected } = parseLodRatios(input.ratiosText);
  const measured = usable(input.sourceTris) ? input.sourceTris : undefined;
  const levels = ratios.map((ratio, i) => ({
    level: i + 1,
    ratio,
    targetTris: measured === undefined ? undefined : Math.floor(measured * ratio),
  }));
  return { levels, rejected, lod0: standLod0(measured, input.assetClass) };
}

export type LodLevelState = 'honoured' | 'over' | 'under' | 'unmeasured';

export interface LodLevelGrade {
  level: number;
  state: LodLevelState;
  targetTris?: number;
  tris?: number;
  name?: string;
  cause?: 'quad-trap';
  reason?: string;
}

export interface LodGrade {
  levels: LodLevelGrade[];
  honoured: number;
  allHonoured: boolean;
  summary: string;
}

function receiptsOf(source: string | Partial<ExecuteOutput> | readonly Receipt[]): readonly Receipt[] {
  if (typeof source === 'string') return parseReceipts(source);
  if (Array.isArray(source)) return source;
  const out = source as Partial<ExecuteOutput>;
  return Array.isArray(out.receipts) && out.receipts.length > 0 ? out.receipts : parseReceipts(out.output ?? '');
}

function gradeLevel(level: number, planned: number | undefined, r: Receipt | undefined): LodLevelGrade {
  if (!r) return { level, state: 'unmeasured', targetTris: planned, reason: `no receipt for LOD${level} — Blender never confirmed this level` };
  const name = typeof r.name === 'string' ? r.name : undefined;
  // Unmeasured plan (typed name, ratios only): the target Blender derived from its own measurement.
  const targetTris = usable(planned) ? planned : usable(r.targetTris) ? r.targetTris : undefined;
  const base = { level, targetTris, name };
  if (!usable(r.tris)) return { ...base, state: 'unmeasured', reason: `the LOD${level} receipt carried no triangle count` };
  const tris = r.tris;
  if (targetTris === undefined) return { ...base, tris, state: 'unmeasured', reason: `LOD${level} has no triangle target to grade against` };
  const ratio = tris / targetTris;
  const vs = `${fmt(tris)} of ${fmt(targetTris)} ${FACE_BUDGET_UNIT} (${ratio.toFixed(2)}x)`;
  if (ratio > BUDGET_OVERRUN_TOLERANCE) {
    const quad = ratio >= QUAD_TRAP_BAND[0] && ratio <= QUAD_TRAP_BAND[1];
    return quad
      ? { ...base, tris, state: 'over', cause: 'quad-trap', reason: `${vs} — a ~2x overrun is the quad/triangle unit trap: the ratio was taken from polygons, not triangles` }
      : { ...base, tris, state: 'over', reason: `${vs} — the decimator overran its target past the 10% tolerance` };
  }
  if (ratio < UNDERRUN_FLOOR) return { ...base, tris, state: 'under', reason: `${vs} — decimated below its target; this level lost more detail than planned` };
  return { ...base, tris, state: 'honoured' };
}

/** Grade each planned level from the `lod` receipts in what a dispatch returned. */
export function gradeLodReceipt(
  source: string | Partial<ExecuteOutput> | readonly Receipt[],
  levels: readonly { level: number; targetTris?: number }[],
): LodGrade {
  const lods = receiptsOf(source).filter((r) => r.kind === 'lod');
  const graded = levels.map((l) => gradeLevel(l.level, l.targetTris, [...lods].reverse().find((r) => r.level === l.level)));
  const honoured = graded.filter((g) => g.state === 'honoured').length;
  const allHonoured = graded.length > 0 && honoured === graded.length;
  const off = graded.filter((g) => g.state !== 'honoured').map((g) => `LOD${g.level} ${g.state}`);
  const summary =
    graded.length === 0
      ? 'No LOD levels were planned'
      : allHonoured
        ? `All ${graded.length} levels honoured`
        : `${honoured} of ${graded.length} levels honoured — ${off.join(', ')}`;
  return { levels: graded, honoured, allHonoured, summary };
}
