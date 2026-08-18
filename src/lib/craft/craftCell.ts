/**
 * Per-cell A-axis projection — the client-safe join of the audited step facts, the
 * lens map, the recorded ceilings, and the craft verdicts the page fetched.
 *
 * Mirrors how realization attaches to cells (display-only, post-hoc): nothing here
 * touches grading, and the DB module is only referenced by type (erased at compile,
 * so better-sqlite3 stays out of the client bundle).
 */
import stepFactsJson from '@/lib/status/step-facts.json';
import ceilingsJson from './craft-ceilings.json';
import { lensForStep, type DeliverableClass, type LensId } from './lens-map';
import { LENS_VERSIONS } from './lens-versions';
import {
  craftOf,
  craftRank,
  distanceToRoof,
  type Craft,
  type CraftLevel,
  type GaugedCraftLevel,
} from '@/lib/status/craft';

/**
 * How many gauges are kept per (catalog, entity, step) in the craft history log.
 *
 * Mirrors `VERDICT_HISTORY_LIMIT` on the R-axis, and lives HERE for the same reason: this
 * module is pure and client-safe, while `craft-verdicts-db` opens better-sqlite3 at import
 * time, so a client component that wants to state the bound cannot import the DB module. The
 * DB module imports this constant for its prune — there is exactly one definition.
 */
export const CRAFT_HISTORY_LIMIT = 20;

/** The verdict fields the projection needs — structurally satisfied by the API's
 *  `CraftVerdict` rows without importing the DB module at runtime. */
export interface CraftVerdictView {
  catalogId: string;
  entityId: string;
  step: string;
  aLevel: GaugedCraftLevel;
  lensVersion: number;
  artifactUpdatedAt?: string;
  /**
   * The A-level movement across this cell's kept gauges, when there are at least two.
   * Attached by `GET /api/craft-verdicts` from the history log in the SAME response, so a
   * cell can state "moved A1 → A3" without a second round-trip. Display only.
   */
  movement?: CraftMovement;
}

// ── A-level trend (the A-axis answer to "did my fix raise the craft level?") ─────────
//
// `craft_verdicts` keeps ONE row per (catalog, entity, step), so before the append-only
// history log existed a re-gauge overwrote its predecessor and that question was
// unanswerable from the data. These helpers are the A-axis mirror of `buildVerdictTrend`
// (src/lib/judge/verdictTrend.ts): pure, framework-free, no clock, no fetching. Evidence
// only — nothing in `src/lib/catalog/acceptance/` or `statusModel` imports this file, so it
// provably cannot move an R-grade.

/** The history-row shape a trend reads — structurally satisfied by `CraftVerdict`. */
export interface CraftTrendInput {
  aLevel: GaugedCraftLevel;
  lensVersion: number;
  model: string;
  /** The artifact `updatedAt` this gauge was bound to — the A-axis content anchor. */
  artifactUpdatedAt?: string;
  judgedAt?: string;
}

/** One kept gauge on the trend line. */
export interface CraftTrendPoint {
  aLevel: GaugedCraftLevel;
  lensVersion: number;
  model: string;
  judgedAt?: string;
  /** Did this gauge read the SAME artifact as the previous one? `null` for the first point. */
  sameContentAsPrevious: boolean | null;
}

export interface CraftTrend {
  /** Oldest first — the direction a trend is read in. */
  points: CraftTrendPoint[];
  /** rungs(latest) − rungs(first), or `null` when there is nothing to compare (0 or 1 gauge). */
  delta: number | null;
  /** What the delta says, in one word. `none` = no comparison possible. */
  direction: 'improved' | 'regressed' | 'unchanged' | 'none';
  /** Best / worst levels across the kept window (`null` when empty). */
  best: GaugedCraftLevel | null;
  worst: GaugedCraftLevel | null;
}

/**
 * Build the A-level trend for ONE cell from its kept gauges.
 *
 * Ordering: by `judgedAt` when every point carries one (the log is already insertion-ordered
 * and the sort is stable, so same-second ties keep write order); otherwise the given order is
 * trusted.
 */
export function buildCraftTrend(history: readonly CraftTrendInput[]): CraftTrend {
  const ordered = [...history];
  if (ordered.every((v) => v.judgedAt)) {
    ordered.sort((a, b) => String(a.judgedAt).localeCompare(String(b.judgedAt)));
  }

  const points: CraftTrendPoint[] = ordered.map((v, i) => ({
    aLevel: v.aLevel,
    lensVersion: v.lensVersion,
    model: v.model,
    ...(v.judgedAt ? { judgedAt: v.judgedAt } : {}),
    // Only a REAL comparison counts: two gauges both bound to an artifact timestamp. A
    // missing anchor on either side is unknown, never "same" — an unbound gauge must not
    // imply the content stood still (the `__process__` scorecard has no anchor at all).
    sameContentAsPrevious:
      i === 0
        ? null
        : Boolean(
            v.artifactUpdatedAt &&
              ordered[i - 1].artifactUpdatedAt &&
              v.artifactUpdatedAt === ordered[i - 1].artifactUpdatedAt,
          ),
  }));

  if (points.length < 2) {
    return {
      points,
      delta: null,
      direction: 'none',
      best: points.length ? points[0].aLevel : null,
      worst: points.length ? points[0].aLevel : null,
    };
  }

  const delta = craftRank(points[points.length - 1].aLevel) - craftRank(points[0].aLevel);
  let best = points[0].aLevel;
  let worst = points[0].aLevel;
  for (const p of points) {
    if (craftRank(p.aLevel) > craftRank(best)) best = p.aLevel;
    if (craftRank(p.aLevel) < craftRank(worst)) worst = p.aLevel;
  }
  return {
    points,
    delta,
    direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged',
    best,
    worst,
  };
}

/** The compact movement a cell can render — the trend squeezed to one chip. */
export interface CraftMovement {
  /** Oldest kept gauge's level. */
  from: GaugedCraftLevel;
  /** Newest kept gauge's level (the level the current verdict carries). */
  to: GaugedCraftLevel;
  /** Rungs moved (`to` − `from`). */
  delta: number;
  direction: 'improved' | 'regressed' | 'unchanged';
  /** How many gauges the movement is drawn from (at most {@link CRAFT_HISTORY_LIMIT}). */
  gauges: number;
  /** When the newest gauge was written. */
  at?: string;
}

/**
 * The movement a trend shows, or `undefined` when there is none to show.
 *
 * A single gauge yields NO movement rather than an `unchanged` one — one measurement is not a
 * comparison, and rendering it as "held" would claim evidence the log does not hold.
 */
export function craftMovementOf(t: CraftTrend): CraftMovement | undefined {
  if (t.points.length < 2 || t.delta === null) return undefined;
  const first = t.points[0];
  const last = t.points[t.points.length - 1];
  return {
    from: first.aLevel,
    to: last.aLevel,
    delta: t.delta,
    direction: t.delta > 0 ? 'improved' : t.delta < 0 ? 'regressed' : 'unchanged',
    gauges: t.points.length,
    ...(last.judgedAt ? { at: last.judgedAt } : {}),
  };
}

/** `2026-08-18 14:03` → `2026-08-18` (the date a movement is reported on). */
function movementDate(at?: string): string | undefined {
  if (!at) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(at);
  return m ? m[1] : at.slice(0, 10);
}

/** One sentence stating what a cell's craft level did — or that it has not moved yet. */
export function craftMovementLabel(m: CraftMovement | undefined): string {
  if (!m) return 'Gauged once — no prior gauge to compare against yet.';
  const on = movementDate(m.at);
  const when = on ? ` on ${on}` : '';
  if (m.direction === 'unchanged') return `Held at ${m.to} across ${m.gauges} gauges${when}.`;
  const verb = m.direction === 'improved' ? 'Moved' : 'Dropped';
  return `${verb} ${m.from} → ${m.to}${when} (${m.gauges} gauges).`;
}

/** One sentence for a full trend — or honestly, that there is no trend yet. */
export function craftTrendSummary(t: CraftTrend): string {
  if (t.points.length === 0) return 'No craft gauge recorded for this step yet.';
  if (t.points.length === 1) return `Gauged once at ${t.points[0].aLevel} — nothing to compare against yet.`;
  const sign = t.delta! > 0 ? '+' : '';
  return `${t.points.length} gauges · ${t.direction} ${sign}${t.delta} rungs (${t.points[0].aLevel} → ${
    t.points[t.points.length - 1].aLevel
  }), best ${t.best} / worst ${t.worst}.`;
}

interface StepFact {
  catalogId: string;
  step: string;
  deliverable: DeliverableClass;
}

const FACTS = (stepFactsJson as { steps: StepFact[] }).steps;

const CEILINGS = (ceilingsJson as {
  ceilings: Record<string, { ceiling: CraftLevel; class: string; reason: string }>;
}).ceilings;

export function ceilingFor(deliverable: DeliverableClass): CraftLevel {
  return CEILINGS[deliverable]?.ceiling ?? 'A4';
}

const factIndex = new Map<string, StepFact>();
for (const f of FACTS) factIndex.set(`${f.catalogId}\u0000${f.step}`, f);

export interface CellCraft {
  craft: Craft;
  lens: LensId;
  deliverable: DeliverableClass;
  ceiling: CraftLevel;
  /**
   * The A-level movement of the verdict this cell is REPORTING (the worst one) — present
   * only when that verdict has at least two kept gauges. Carried on the verdict rows the
   * page already fetched, so surfacing it costs no extra request. Display only: it is
   * derived after `craft` is decided and never feeds back into it.
   */
  movement?: CraftMovement;
}

/**
 * The A-axis reading for one /status cell. Pure.
 *
 * A cell aggregates every entity's artifact for the step, so it may hold several
 * gauges — the cell shows the WORST projected one (the map states the floor, never the
 * best case). A step absent from the fleet audit gets no chip at all (`undefined`) —
 * an unaudited step must not claim an A0 it was never measured for.
 *
 * `artifactUpdatedAtByEntity` carries each entity's current artifact `updatedAt` so a
 * verdict written before a re-produce projects as stale.
 */
export function craftForCell(
  catalogId: string,
  stepLabel: string,
  verdicts: CraftVerdictView[],
  artifactUpdatedAtByEntity: ReadonlyMap<string, string>,
): CellCraft | undefined {
  const fact = factIndex.get(`${catalogId}\u0000${stepLabel}`);
  if (!fact) return undefined;
  const lens = lensForStep(fact.deliverable, catalogId);
  const ceiling = ceilingFor(fact.deliverable);
  const currentLensVersion = LENS_VERSIONS[lens];

  const mine = verdicts.filter((v) => v.catalogId === catalogId && v.step === stepLabel);
  if (mine.length === 0) {
    return {
      craft: craftOf({ currentLensVersion, ceiling }),
      lens,
      deliverable: fact.deliverable,
      ceiling,
    };
  }
  let worst: Craft | undefined;
  let worstVerdict: CraftVerdictView | undefined;
  for (const v of mine) {
    const projected = craftOf({
      verdict: v,
      currentLensVersion,
      ceiling,
      artifactUpdatedAt: artifactUpdatedAtByEntity.get(v.entityId),
    });
    if (
      !worst ||
      craftRank(projected.level) < craftRank(worst.level) ||
      (craftRank(projected.level) === craftRank(worst.level) && projected.state === 'stale' && worst.state !== 'stale')
    ) {
      worst = projected;
      worstVerdict = v;
    }
  }
  return {
    craft: worst!,
    lens,
    deliverable: fact.deliverable,
    ceiling,
    ...(worstVerdict?.movement ? { movement: worstVerdict.movement } : {}),
  };
}

/**
 * Rungs still to climb for one cell — the rollup unit. A STALE gauge counts its full
 * ceiling distance (the content on record has never been gauged, so the whole climb is
 * unproven); at-ceiling counts 0 by construction.
 */
export function cellDistanceToRoof(c: CellCraft): number {
  if (c.craft.state === 'stale') return distanceToRoof('A0', c.ceiling);
  return distanceToRoof(c.craft.level, c.ceiling);
}
