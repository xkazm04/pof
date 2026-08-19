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
 *  1. the budget comes from `polycount-presets`, the size from `world-scale`, and the
 *     verdict vocabulary from `face-budget` — no constants live here;
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
import {
  polycountFor,
  resolveAssetClass,
  type AssetClass,
  type PolycountPreset,
} from '@/lib/visual-gen/polycount-presets';
import { gradeFaceBudget, type BudgetGrade } from '@/lib/visual-gen/face-budget';
import {
  gradeWorldScale,
  isGeneratorNormalized,
  longestExtent,
  nominalExtentFor,
  type ScaleGrade,
  type SizeRequest,
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
  /** Longest measured bbox extent, in the glTF file's own units (metres). */
  longestExtentM: number;
  /** True when the bbox is raw generator output — a ~1 m box regardless of the asset. */
  generatorNormalized: boolean;
  /** The size target actually applied, when one was stated or is honest for the class. */
  targetExtentM?: number;
}

const usable = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

const int = (n: number) => Math.round(n).toLocaleString('en-US');

function budgetSentence(grade: BudgetGrade, preset: PolycountPreset | undefined): string {
  if (!preset) {
    // Deliberately never uses the words the old panel stamped on an ungraded mesh:
    // silence must not read as compliance, and a test guards the phrase.
    return 'no asset class stated — a triangle count cannot be graded without one (40,000 triangles is a whole character budget and four times a prop ceiling), so this mesh is UNMEASURED, not compliant';
  }
  const ceiling = preset.warnAbove;
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

/**
 * Grade a loaded mesh. Pure. Returns null when there is nothing loaded to grade.
 *
 * `assetClass` and `targetExtentM` are both STATED inputs. When no target is stated the
 * class's nominal extent is used ONLY where one is honest (`world-scale` gives a
 * character the 1.8 m UE5 Mannequin and deliberately gives a prop nothing, because a prop
 * can be a coin or a wagon) — so a prop with no stated target grades `unmeasured` rather
 * than inheriting an invented number.
 */
export function gradeViewerAsset(
  stats: AssetStats | null,
  assetClass: string | undefined,
  targetExtentM?: number | null,
): ViewerAssetGrade | null {
  if (!stats) return null;

  const resolved = resolveAssetClass(assetClass || undefined);
  const preset = resolved.assetClass ? polycountFor(resolved.assetClass) : undefined;

  const budget = gradeFaceBudget(
    stats.triangles,
    preset ? { triangleBudget: preset.warnAbove, topology: 'triangles' } : undefined,
  );

  const bbox = [stats.boundingBox.width, stats.boundingBox.height, stats.boundingBox.depth];
  const target = usable(targetExtentM) ? targetExtentM : nominalExtentFor(resolved.assetClass);
  const request: SizeRequest | undefined = usable(target) ? { targetExtentM: target } : undefined;
  const scale = gradeWorldScale(bbox, request);
  const generatorNormalized = isGeneratorNormalized(bbox);

  return {
    assetClass: resolved.assetClass,
    gradedAs: resolved.gradedAs,
    preset,
    ceilingTriangles: preset?.warnAbove,
    budget,
    budgetLine: budgetSentence(budget, preset),
    scale,
    scaleLine: scaleSentence(scale, generatorNormalized),
    longestExtentM: longestExtent(bbox),
    generatorNormalized,
    targetExtentM: request?.targetExtentM,
  };
}
