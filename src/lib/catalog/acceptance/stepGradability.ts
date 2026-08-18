import type { Checker } from './types';
import { ITEMS_BESPOKE_CHECKERS } from './itemsBespokeCheckers';

/**
 * WHICH persisted step labels the server can grade, and — for the ones it cannot — WHY.
 *
 * The produce POST re-grades every submitted artifact so a fabricated `pass` is impossible…
 * for steps the server can resolve a checker for. `gradeArtifact` returns `graded: false`
 * for the rest, and the PRODUCER's status then stands. That is the one door the re-grade
 * exists to close, and it was still ajar for the project's own reference pipeline: measured
 * against the real `~/.pof/pof.db` on 2026-08-18, 15 of the `items` catalog's 90 rows carried
 * labels the registered `items` pipeline never declares.
 *
 * The contract this module enforces is that a step label is in exactly ONE of three states —
 * never a silent fourth:
 *
 *  1. `registered`  — declared by a registered catalog pipeline; `serverCheckerFor` resolves it.
 *  2. `bespoke`     — a legacy/bespoke label with a server-importable checker registered HERE
 *                     (the Items UI steps that predate `pipelines/items.ts`).
 *  3. `unservable`  — explicitly recorded as ungradable WITH A REASON.
 *  4. `unknown`     — none of the above. This is not an accepted state: it is a FINDING that a
 *                     write path is persisting rows nothing can grade. `describeUngraded`
 *                     stamps it loudly onto the row so the gap is visible in the DB itself.
 *
 * Deliberately NOT a rename. A step label is a DB key (`pipeline_artifacts` is upserted on
 * `(catalog_id, entity_id, step)`), so aligning the bespoke labels onto the registered ones
 * would orphan every existing row for those steps. The server learns the labels instead.
 */

/** Bespoke (non-pipeline) checkers, per catalog, keyed by the LIVE persisted step label. */
const BESPOKE_CHECKERS: Readonly<Record<string, Readonly<Record<string, Checker>>>> = {
  items: ITEMS_BESPOKE_CHECKERS,
};

/**
 * Catalogs the server genuinely cannot grade, each with the reason. A catalog listed here
 * is a stated limitation, not an oversight — a row it produces is still reported as ungraded
 * (never as verified), it just carries an explanation instead of a "nothing knows about this"
 * finding.
 *
 * `loot-filter` writes `pipeline_artifacts` rows under a synthetic catalog id with its own
 * lifecycle steps (`datatable` / `wire` / `verify`, see `lib/loot-filter/pipeline.ts`); it has
 * no registered catalog pipeline and its acceptance is derived by the loot-filter feature
 * itself, not by a catalog checker.
 */
const UNSERVABLE_CATALOGS: Readonly<Record<string, string>> = {
  'loot-filter':
    'synthetic catalog: loot-filter tracks rulesets in pipeline_artifacts under its own ' +
    'datatable/wire/verify steps and derives their acceptance in lib/loot-filter, so there is ' +
    'no registered catalog pipeline for the server to re-grade against',
};

/** Prefix form of {@link UNSERVABLE_CATALOGS} — loot-filter also writes `loot-filter-*` ids. */
function unservableCatalogReason(catalogId: string): string | null {
  const exact = UNSERVABLE_CATALOGS[catalogId];
  if (exact) return exact;
  for (const [id, reason] of Object.entries(UNSERVABLE_CATALOGS)) {
    if (catalogId.startsWith(`${id}-`)) return reason;
  }
  return null;
}

/**
 * Per-(catalog, step) unservable entries, for a label that IS in a registered catalog but
 * genuinely cannot be re-derived server-side. Empty today: after the bespoke Items checkers
 * landed, every persisted `items` label resolves. Add an entry here (never silence a row)
 * when a real one appears.
 */
const UNSERVABLE_STEPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {};

export type Gradability =
  | { kind: 'registered' }
  | { kind: 'bespoke' }
  | { kind: 'unservable'; reason: string }
  | { kind: 'unknown' };

/**
 * The bespoke server-importable checker for a (catalog, step), or null. Consulted by
 * `serverCheckerFor` AFTER the registered pipeline, so a registered step always wins and
 * this can only ever ADD gradability, never override it.
 */
export function bespokeCheckerFor(catalogId: string, step: string): Checker | null {
  return BESPOKE_CHECKERS[catalogId]?.[step] ?? null;
}

/**
 * Classify a (catalog, step) into exactly one of the four states above.
 *
 * `hasRegisteredChecker` is injected rather than imported so this module stays free of the
 * pipeline registry (which `serverCheckerFor` itself lives beside) — no import cycle, and the
 * classification is testable without booting every pipeline.
 */
export function stepGradability(
  catalogId: string,
  step: string,
  hasRegisteredChecker: (catalogId: string, step: string) => boolean,
): Gradability {
  if (hasRegisteredChecker(catalogId, step)) return { kind: 'registered' };
  if (bespokeCheckerFor(catalogId, step)) return { kind: 'bespoke' };
  const perStep = UNSERVABLE_STEPS[catalogId]?.[step];
  if (perStep) return { kind: 'unservable', reason: perStep };
  const perCatalog = unservableCatalogReason(catalogId);
  if (perCatalog) return { kind: 'unservable', reason: perCatalog };
  return { kind: 'unknown' };
}

/** Marker every ungraded row's `reason` starts with, so the gap is greppable in the DB. */
export const UNGRADED_MARKER = 'UNGRADED';

/**
 * The `reason` to persist on a row the server could NOT re-grade.
 *
 * The producer's own status is preserved (there is nothing truer to replace it with), but the
 * row now SAYS it was never verified — which is the whole point. Silently keeping a producer's
 * `pass` with no annotation is what re-opens the fabricated-pass hole; a loud `UNGRADED:` reason
 * keeps the finding visible wherever the artifact is read.
 */
export function describeUngraded(
  catalogId: string,
  step: string,
  hasRegisteredChecker: (catalogId: string, step: string) => boolean,
  producerReason?: string,
): string {
  const g = stepGradability(catalogId, step, hasRegisteredChecker);
  const head =
    g.kind === 'unservable'
      ? `${UNGRADED_MARKER}: no server checker — ${g.reason}`
      : `${UNGRADED_MARKER}: no server checker is registered for step "${step}" in catalog ` +
        `"${catalogId}", so this status is the PRODUCER's and has not been verified by the server`;
  return producerReason ? `${head} · producer reported: ${producerReason}` : head;
}
