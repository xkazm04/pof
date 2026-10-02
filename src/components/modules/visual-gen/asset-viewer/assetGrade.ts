/**
 * The viewer's grade for a loaded mesh — triangles against a class budget, size against
 * a stated target.
 *
 * The one screen where a human LOOKS at a generated mesh used to report six numbers and
 * grade none of them, while two server-side authorities already existed to grade them.
 * What it did have was a second, rival budget table (`UE5_PRESETS` in `assetStats.ts`:
 * prop = 100,000 triangles) contradicting the project's authored budgets
 * (`polycount-presets.ts`: prop `faceLimit` 10,000, `warnAbove` 15,000) by up to 10x —
 * so `chair.glb` at 83,728 measured triangles was stamped "Within budget". That table is
 * gone; this module is the replacement, and it owns no numbers of its own.
 *
 * Three rules, inherited rather than re-invented:
 *  1. what the mesh is held to comes from the Tier-1 gate's own request (`gateRequestFor`)
 *     and how bad each finding is from the gate's own scorer (`scoreGeometry` → `scoreMesh`),
 *     so the viewer and the job verdict cannot disagree on a fact both can measure — no
 *     constants and no second severity vocabulary live here;
 *  2. the asset class is a STATED INPUT. It is never guessed from a filename: a file
 *     called `warrior.glb` is not evidence of anything, and a wrong guess grades a
 *     character against a prop budget;
 *  3. `face-budget`'s honesty rule holds — a missing measurement or a missing request
 *     yields `unmeasured`, never `honored`. Silence must not read as compliance.
 *
 * `drawCalls` is deliberately absent: it is a material-SLOT proxy counted by traversing
 * the loaded scene, not a measured draw count, and PoF authors no draw-call budget.
 * Grading a proxy against an invented number is the failure this module exists to undo.
 */
import { polycountFor, type AssetClass, type PolycountPreset } from '@/lib/visual-gen/polycount-presets';
import { gateRequestFor } from '@/lib/visual-gen/gate-request';
import { scoreGeometry, GATE_ONLY_CODES, type Finding, type FindingCode } from '@/lib/visual-gen/mesh-score';
import { gradeFaceBudget, type BudgetGrade } from '@/lib/visual-gen/face-budget';
import {
  isGeneratorNormalized,
  longestExtent,
  type ScaleGrade,
  type OrientationGrade,
} from '@/lib/visual-gen/world-scale';
import type { AssetStats } from './assetStats';

/**
 * Why the triangle line is a CEILING and not a request.
 *
 * A file opened in the viewer carries no record of what it was generated at, so calling
 * `warnAbove` "the requested budget" would fabricate a request — the exact mistake
 * `localCritiqueDeps` documents for budget-blind providers. The class ceiling is the
 * honest class-aware line, and it is stated as such.
 */
export const CEILING_NOTE =
  'a mesh opened in the viewer carries no record of the budget it was generated at, so this is the class ceiling from polycount-presets, not a budget this mesh was asked for';

/** What `drawCalls` actually counts, stated wherever it is shown. */
export const DRAW_CALLS_PROXY_NOTE =
  'material slots traversed in the loaded scene — a proxy for draw calls, not a measured draw count, and not graded';

/** A row's severity: the gate's finding when it has one, else pass or unmeasured. */
export type RowSeverity = 'fail' | 'warn' | 'pass' | 'unmeasured';

export interface ViewerAssetGrade {
  /** The class the user stated, or undefined — never inferred. */
  assetClass?: AssetClass;
  /** `resolveAssetClass`'s sentence: exactly what this mesh is being held to. */
  gradedAs: string;
  preset?: PolycountPreset;
  /** The triangle line applied — the class ceiling (`warnAbove`). */
  ceilingTriangles?: number;
  budget: BudgetGrade;
  /** One sentence naming the number, its source, and the overrun. Always set. */
  budgetLine: string;
  scale: ScaleGrade;
  /** One sentence on the size verdict. Always set. */
  scaleLine: string;
  /**
   * Which way up the asset sits. Every TripoSR asset measured on 2026-08-31 was authored
   * lying down, and the scale line above compares the LONGEST extent to the target — so
   * for a mis-oriented asset it holds the sideways length to the intended height.
   */
  orientation: OrientationGrade;
  /** The orientation grade as one sentence. */
  orientationLine: string;
  /** Longest measured bbox extent, in the glTF file's own units (metres). */
  longestExtentM: number;
  /** True when the bbox is raw generator output — a ~1 m box regardless of the asset. */
  generatorNormalized: boolean;
  /** The size target actually applied, when one was stated or is honest for the class. */
  targetExtentM?: number;
  /** The gate's findings on the faces + bbox the viewer measured, in the gate's order. */
  findings: Finding[];
  /**
   * The worst finding severity (the gate's own). With no finding: `pass` when a class was
   * stated, `unmeasured` when not — class-blind is stated, never graded green.
   */
  verdict: RowSeverity;
  /** Criteria only the Tier-1 gate's trimesh pass measures — named, never implied passed. */
  gateOnly: readonly FindingCode[];
  /** Each visible row's severity, taken from the gate's findings. */
  severity: { budget: RowSeverity; scale: RowSeverity; orientation: RowSeverity };
}

const usable = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

const int = (n: number) => Math.round(n).toLocaleString('en-US');

function budgetSentence(grade: BudgetGrade, preset: PolycountPreset | undefined, ceiling: number | undefined): string {
  if (!preset || ceiling === undefined) {
    // Deliberately never uses the words the old panel stamped on an ungraded mesh:
    // silence must not read as compliance, and a test guards the phrase.
    return 'no asset class stated — a triangle count cannot be graded without one (40,000 triangles is a whole character budget and four times a prop ceiling), so this mesh is UNMEASURED, not compliant';
  }
  const measured = grade.measuredTriangles;
  if (measured === undefined) {
    return `mesh was not measured — the ${int(ceiling)}-triangle ${preset.label} ceiling cannot be confirmed without a triangle count`;
  }
  if (grade.verdict === 'over') {
    const ratio = grade.ratio ?? measured / ceiling;
    return `${int(measured)} triangles against the ${int(ceiling)}-triangle ${preset.label} ceiling (${ratio.toFixed(1)}x) — the generation target for this class is ${int(preset.faceLimit)}; decimate before shipping. ${CEILING_NOTE}`;
  }
  return `${int(measured)} triangles, inside the ${int(ceiling)}-triangle ${preset.label} ceiling (generation target ${int(preset.faceLimit)}). ${CEILING_NOTE}`;
}

function orientationSentence(grade: OrientationGrade): string {
  if (grade.reason) return grade.reason;
  if (grade.verdict === 'upright') {
    return `stands on its up axis (${(grade.upExtentM ?? 0).toFixed(2)} m tall against a ${(grade.longestExtentM ?? 0).toFixed(2)} m longest extent)`;
  }
  return 'no orientation verdict available';
}

function scaleSentence(grade: ScaleGrade, normalized: boolean): string {
  if (grade.reason) return grade.reason;
  if (grade.verdict === 'matches') {
    const s = grade.importUniformScale;
    return `longest extent ${(grade.measuredExtentM ?? 0).toFixed(2)} m matches the ${(grade.targetExtentM ?? 0).toFixed(2)} m target${s !== undefined ? ` (import uniform scale ${s.toFixed(2)})` : ''}`;
  }
  return normalized
    ? 'generator-normalised output — the extents below are a unit box, not a real-world size'
    : 'no size verdict available';
}

const rowSeverity = (findings: readonly Finding[], codes: readonly FindingCode[], ok: boolean): RowSeverity => {
  const hit = findings.filter((f) => codes.includes(f.code));
  if (hit.some((f) => f.severity === 'fail')) return 'fail';
  if (hit.length) return 'warn';
  return ok ? 'pass' : 'unmeasured';
};

/**
 * Grade a loaded mesh. Pure. Returns null when there is nothing loaded to grade.
 *
 * `assetClass` and `targetExtentM` are both STATED inputs, turned into a request by the
 * gate's one rule (`gateRequestFor`): an absent target falls back to the class nominal only
 * where one is honest (a character gets the 1.8 m Mannequin, a prop nothing, because a
 * prop can be a coin or a wagon), and only a class that reliably stands is held upright.
 */
export function gradeViewerAsset(
  stats: AssetStats | null,
  assetClass: string | undefined,
  targetExtentM?: number | null,
): ViewerAssetGrade | null {
  if (!stats) return null;

  // Stage `unknown`: a file opened in the viewer carries no record of its pipeline stage,
  // and no `sentBudget` for the same reason — see CEILING_NOTE.
  const gate = gateRequestFor({ assetClass: assetClass || undefined, stage: 'unknown', targetExtentM: targetExtentM ?? undefined });
  const preset = assetClass ? polycountFor(assetClass) : undefined;
  const ceiling = preset ? gate.deps.thresholds?.maxFacesWarn : undefined;

  const bbox: [number, number, number] = [stats.boundingBox.width, stats.boundingBox.height, stats.boundingBox.depth];
  const card = scoreGeometry({ faces: stats.triangles, verts: stats.vertices, bbox }, gate.deps);
  const findings = card.findings;
  const faceCount = findings.find((f) => f.code === 'face-count');

  // The ceiling row speaks `face-budget`'s vocabulary, but its verdict may not contradict
  // the gate: a count inside `face-budget`'s 10% overrun tolerance still draws the gate's
  // face-count WARN, so the row reads over whenever the gate says so.
  const graded = gradeFaceBudget(stats.triangles, ceiling !== undefined ? { triangleBudget: ceiling, topology: 'triangles' } : undefined);
  const budget: BudgetGrade = faceCount && graded.verdict === 'honored' ? { ...graded, verdict: 'over', reason: faceCount.reason } : graded;
  // `scoreMesh` always grades scale and orientation, so both are present on every card.
  const scale = card.scale as ScaleGrade;
  const orientation = card.orientation as OrientationGrade;
  const generatorNormalized = isGeneratorNormalized(bbox);
  const sizeTarget = gate.deps.size?.targetExtentM;

  return {
    assetClass: preset?.assetClass,
    gradedAs: gate.gradedAs,
    preset,
    ceilingTriangles: ceiling,
    budget,
    budgetLine: budgetSentence(budget, preset, ceiling),
    scale,
    scaleLine: scaleSentence(scale, generatorNormalized),
    orientation,
    orientationLine: orientationSentence(orientation),
    longestExtentM: longestExtent(bbox),
    generatorNormalized,
    targetExtentM: usable(sizeTarget) ? sizeTarget : undefined,
    findings,
    verdict: card.verdict === 'pass' && !preset ? 'unmeasured' : card.verdict,
    gateOnly: GATE_ONLY_CODES,
    severity: {
      budget: rowSeverity(findings, ['face-count', 'budget-over'], budget.verdict === 'honored'),
      scale: rowSeverity(findings, ['scale-off'], scale.verdict === 'matches'),
      orientation: rowSeverity(findings, ['orientation-lying'], orientation.verdict === 'upright'),
    },
  };
}
