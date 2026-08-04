/**
 * Icon-binding runner — the drain-style production consumer of `bindGeneratedIcons`.
 *
 * Walks the persisted artifacts, and for each gallery step whose selected candidate is
 * still a deterministic swatch, binds the image that `generated/icons/` holds FOR that
 * exact step (matched by the generator's own filename rule) and RE-GRADES through the same
 * `gradeArtifact` the produce POST uses — so a bind can only move a verdict by making the
 * artifact genuinely own a real asset, never by asserting one.
 *
 * Pure orchestration over injected deps (no fs / db / clock here), mirroring
 * `staticVerify.ts`, so it is unit-testable without a generated library or SQLite.
 */
import { bindGeneratedIcon } from './bindGeneratedIcons';
import type { AcceptanceResult } from './types';

export interface BindIconsFilter {
  catalogId?: string;
  entityId?: string;
}

export interface BindIconsRow {
  catalogId: string;
  entityId: string;
  step: string;
  from: string;
  to: string;
  /** The bound image url, or the reason nothing was bound. */
  detail: string;
  changed: boolean;
}

export interface BindIconsSummary {
  /** Icons available in the library (whatever the caller listed). */
  library: number;
  /** Artifacts examined. */
  examined: number;
  /** Artifacts that received a real image. */
  bound: number;
  /** Artifacts whose verdict moved as a result. */
  changed: number;
  /** Artifacts skipped (no art for the step, already real, no history, not gradable). */
  skipped: number;
  results: BindIconsRow[];
}

export interface BindIconsDeps {
  /** Persisted artifacts to consider. */
  listArtifacts: (filter: BindIconsFilter) => { catalogId: string; entityId: string; step: string; status: string; data: Record<string, unknown> }[];
  /** The served url of the art generated FOR this step, or null when the library has none. */
  iconUrlFor: (catalogId: string, step: string) => string | null;
  /** Re-grade the bound data with the step's own server checker (null when unregistered). */
  grade: (catalogId: string, step: string, data: Record<string, unknown>, entityId: string) => AcceptanceResult | null;
  /** Persist the bound data + its re-graded verdict. */
  save: (catalogId: string, entityId: string, step: string, data: Record<string, unknown>, res: AcceptanceResult) => void;
  /** ISO timestamp stamped on the binding (injected so the runner stays pure). */
  now: () => string;
}

export function bindIconsAll(
  filter: BindIconsFilter,
  deps: BindIconsDeps,
  opts?: { apply?: boolean; library?: number },
): BindIconsSummary {
  const apply = opts?.apply !== false;
  const results: BindIconsRow[] = [];
  let examined = 0, bound = 0, changed = 0, skipped = 0;

  for (const a of deps.listArtifacts(filter)) {
    const url = deps.iconUrlFor(a.catalogId, a.step);
    if (!url) { skipped++; continue; }
    examined++;
    const outcome = bindGeneratedIcon(a.data ?? {}, url, deps.now());
    if ('skipped' in outcome) {
      skipped++;
      results.push({ catalogId: a.catalogId, entityId: a.entityId, step: a.step, from: a.status, to: a.status, detail: outcome.skipped, changed: false });
      continue;
    }
    const verdict = deps.grade(a.catalogId, a.step, outcome.data, a.entityId);
    if (!verdict) {
      skipped++;
      results.push({ catalogId: a.catalogId, entityId: a.entityId, step: a.step, from: a.status, to: a.status, detail: 'no server checker — not graded, not written', changed: false });
      continue;
    }
    bound++;
    const moved = verdict.status !== a.status;
    if (moved) changed++;
    if (apply) deps.save(a.catalogId, a.entityId, a.step, outcome.data, verdict);
    results.push({ catalogId: a.catalogId, entityId: a.entityId, step: a.step, from: a.status, to: verdict.status, detail: url, changed: moved });
  }

  return { library: opts?.library ?? 0, examined, bound, changed, skipped, results };
}
