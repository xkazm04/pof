import type { BindIconsSummary } from '@/lib/catalog/acceptance/bindIconsAll';

/**
 * The wording of the icon-bind pass, read by `MatrixSettle` (the matrix header's one
 * preview → confirmed apply over bind-icons / verify-static / verify-packaging).
 *
 * The `MatrixBindIcons` button that once lived here was unmounted when MatrixSettle replaced
 * it — its Bind POSTed '{}', binding EVERY catalog from inside one catalog's header — and is
 * gone. What stays is the honest wording: "0 bound" is a first-class line WITH its top reason
 * rather than a silent no-op or a bare "done", and every bound row reports which scope of the
 * library served it (`entity` = art generated for that exact entity, `step` = the catalog-wide
 * icon standing in), so a substitution is stated.
 */

/** A skipped/`0 bound` outcome, explained. Pure so the wording is testable without a fetch. */
export interface BindOutcomeLines {
  headline: string;
  /** Skip reasons the route reported, most frequent first. */
  reasons: { reason: string; count: number }[];
  /** How many bound rows came from entity art vs the per-step fallback. */
  scopes: { entity: number; step: number };
  /** Verdict deltas the re-grade produced (`deferred → pass`), most frequent first. */
  moved: { label: string; count: number }[];
  /** Artifacts the library holds no art for at all — counted, never listed as rows. */
  noArt: number;
}

function tally<T>(items: T[], key: (t: T) => string): { k: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count);
}

/** Turn the route's own counters into the lines the panel renders. Pure. */
export function describeBindOutcome(s: BindIconsSummary, applied: boolean): BindOutcomeLines {
  const rows = s.results ?? [];
  const bound = rows.filter((r) => r.scope != null);
  const skips = rows.filter((r) => r.scope == null);
  const noArt = Math.max(0, s.skipped - skips.length);
  const reasons = tally(skips, (r) => r.detail).map(({ k, count }) => ({ reason: k, count }));
  const verb = applied ? 'bound' : 'would bind';
  let headline: string;
  if (s.bound === 0) {
    const why =
      s.library === 0
        ? 'the icon library is empty — generated/icons/ holds no files for any step'
        : noArt > 0 && reasons.length === 0
          ? `the library holds no art matching ${noArt} artifact${noArt > 1 ? 's' : ''}`
          : (reasons[0]?.reason ?? 'nothing matched');
    headline = `0 ${verb} — ${why}.`;
  } else {
    headline = `${s.bound} ${verb} · ${s.changed} verdict${s.changed === 1 ? '' : 's'} ${applied ? 'moved' : 'would move'} · ${s.skipped} skipped · ${s.library} file${s.library === 1 ? '' : 's'} in the library.`;
  }
  return {
    headline,
    reasons,
    scopes: {
      entity: bound.filter((r) => r.scope === 'entity').length,
      step: bound.filter((r) => r.scope === 'step').length,
    },
    moved: tally(bound.filter((r) => r.changed), (r) => `${r.from} → ${r.to}`).map(({ k, count }) => ({ label: k, count })),
    noArt,
  };
}
