/**
 * Goal-2 instrument — "scan-sweep debt falls week over week". Pure: reads the round rows of
 * `.claude/scan-history/scan-sweep.jsonl` and buckets them per ISO week. The CLI reading lives
 * in `scripts/kpi-scan-sweep-debt.mjs`; this file has no imports so Node can load it directly.
 *
 * Field meanings come from the scan-sweep skill's ledger schema (ai-registry
 * `skills/scan-sweep/SKILL.md` §10), not from guessing at the data:
 *   findings    built + rejected + carried + backlogged findings of the round
 *   fixed       findings shipped (the report's "fixed <title> - <sha>" lines)
 *   carried     approved items left for the NEXT round — a stock, observed per scope
 *   escalations findings routed to the human lane (direction/architecture/irreversible/policy)
 *   fp          auto-accepted items demoted at build
 *   leads       registry leads filed
 */

/** What the reading means, verbatim in every output so a number never travels without it. */
export const SCAN_SWEEP_DEFINITION = {
  outstanding:
    'closing carried (per scope, the carried value of its last round in the week, summed) + escalations raised in the week',
  unfixed:
    'findings - fixed per week: an upper bound on findings left unbuilt (rejected + carried + backlogged); the ledger does not split them',
  notUsed: [
    'fp: the schema says it counts auto-accepted items demoted at build but does not say whether they are inside `findings`, so no findings-minus-fp figure is derived; the raw sum is reported',
    'leads: registry leads are knowledge handed to the registry, not unfinished work in this repo',
    'lens_keys, lenses, auto, lanes, ab, degraded, note: coverage and routing detail, not a debt count',
  ],
  limits: [
    'backlogged findings go to the memory outbox, not the ledger: `outstanding` cannot see them (`unfixed` bounds them from above)',
    'the ledger records no resolution of an escalation, so escalations count when raised and are never netted off',
    'carried is observed only when a scope is swept; a scope that is not re-swept keeps no reading in later weeks',
    'only weeks with at least one round appear; a week with no sweep is absent, not zero',
  ],
};

export type ScanSweepTrend = 'falling' | 'flat' | 'rising' | 'insufficient-data';

export interface ScanSweepWeek {
  /** ISO week label, `YYYY-Www`. */
  week: string;
  /** The Monday of that week (UTC), `YYYY-MM-DD`. */
  weekStart: string;
  rounds: number;
  findings: number;
  fixed: number;
  /** max(0, findings - fixed) summed over the week's rounds. See SCAN_SWEEP_DEFINITION.unfixed. */
  unfixed: number;
  /** Raw sum of the ledger's `fp`; deliberately not subtracted from `findings`. */
  fp: number;
  /** Closing carried stock: per scope, the last observed `carried` in the week, summed. */
  carried: number;
  escalations: number;
  leads: number;
  /** carried + escalations. See SCAN_SWEEP_DEFINITION.outstanding. */
  outstanding: number;
  /** outstanding minus the previous reported week's outstanding; null for the first week. */
  deltaOutstanding: number | null;
  /** The reported week the delta is against (not necessarily the calendar-previous week). */
  previousWeek: string | null;
  /** True while the week has not finished at `now`: its flows are still accumulating. */
  partial: boolean;
}

export interface ScanSweepDebt {
  definition: typeof SCAN_SWEEP_DEFINITION;
  /** Rows accepted into a bucket. */
  rows: number;
  /** Rows (or lines) that were unparseable or malformed and left out. */
  skipped: number;
  /** Chronological, only weeks that had at least one round. */
  weeks: ScanSweepWeek[];
  /** Latest reported week's outstanding vs the one before it. */
  trend: ScanSweepTrend;
  /** The trend's latest week is still running, so its flows are incomplete. */
  latestWeekPartial: boolean;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** ISO-8601 week (Monday start, week 1 holds the year's first Thursday) of an epoch-ms instant, in UTC. */
export function isoWeekOf(ms: number): { week: string; start: string } {
  const d = new Date(ms);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const monday = dayStart - ((d.getUTCDay() + 6) % 7) * DAY_MS;
  const isoYear = new Date(monday + 3 * DAY_MS).getUTCFullYear(); // the week's Thursday decides the year
  const jan4 = Date.UTC(isoYear, 0, 4);
  const week1Monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS;
  const n = Math.round((monday - week1Monday) / WEEK_MS) + 1;
  return { week: `${isoYear}-W${String(n).padStart(2, '0')}`, start: isoDate(monday) };
}

/**
 * Parses ledger text into one entry per non-blank line. A line that is not valid JSON becomes
 * `undefined`, which `scanSweepDebt` counts as skipped. Never throws.
 */
export function parseScanSweepLedger(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      out.push(undefined);
    }
  }
  return out;
}

interface ValidRow {
  at: number;
  scope: string;
  findings: number;
  fixed: number;
  fp: number;
  carried: number | null;
  escalations: number;
  leads: number;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** A flow field missing from older rows reads as 0; a present-but-bad value makes the row malformed. */
const optCount = (v: unknown): number | null | 'bad' => (v === undefined ? null : isCount(v) ? v : 'bad');

/** A row is usable when it has a parseable `at` and numeric `findings` and `fixed`; the rest is optional. */
function validate(raw: unknown): ValidRow | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === 'string' ? Date.parse(r.at) : NaN;
  if (Number.isNaN(at) || !isCount(r.findings) || !isCount(r.fixed)) return null;
  const fp = optCount(r.fp);
  const carried = optCount(r.carried);
  const escalations = optCount(r.escalations);
  const leads = optCount(r.leads);
  if (fp === 'bad' || carried === 'bad' || escalations === 'bad' || leads === 'bad') return null;
  return {
    at,
    scope: typeof r.scope === 'string' ? r.scope : '',
    findings: r.findings,
    fixed: r.fixed,
    fp: fp ?? 0,
    carried,
    escalations: escalations ?? 0,
    leads: leads ?? 0,
  };
}

/**
 * Per-ISO-week scan-sweep backlog reading at `now` (epoch ms). `rows` are parsed ledger objects
 * (anything else, including `undefined` from `parseScanSweepLedger`, is counted in `skipped`).
 * Never throws, including on an empty ledger. Trend compares the latest reported week's
 * `outstanding` with the previous reported week's; fewer than two weeks is `insufficient-data`.
 */
export function scanSweepDebt(rows: ReadonlyArray<unknown>, now: number): ScanSweepDebt {
  const valid: ValidRow[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const v = validate(raw);
    if (v) valid.push(v);
    else skipped += 1;
  }
  valid.sort((a, b) => a.at - b.at);

  const byWeek = new Map<string, { start: string; rows: ValidRow[] }>();
  for (const v of valid) {
    const { week, start } = isoWeekOf(v.at);
    const b = byWeek.get(week) ?? { start, rows: [] };
    b.rows.push(v);
    byWeek.set(week, b);
  }

  const weeks: ScanSweepWeek[] = [];
  for (const [week, { start, rows: wr }] of [...byWeek].sort((a, b) => (a[1].start < b[1].start ? -1 : 1))) {
    const closing = new Map<string, number>(); // rows are time-ordered, so the last write per scope wins
    let findings = 0, fixed = 0, unfixed = 0, fp = 0, escalations = 0, leads = 0;
    for (const r of wr) {
      findings += r.findings;
      fixed += r.fixed;
      unfixed += Math.max(0, r.findings - r.fixed);
      fp += r.fp;
      escalations += r.escalations;
      leads += r.leads;
      if (r.carried !== null) closing.set(r.scope, r.carried);
    }
    let carried = 0;
    for (const c of closing.values()) carried += c;
    const prev = weeks[weeks.length - 1];
    const outstanding = carried + escalations;
    weeks.push({
      week,
      weekStart: start,
      rounds: wr.length,
      findings,
      fixed,
      unfixed,
      fp,
      carried,
      escalations,
      leads,
      outstanding,
      deltaOutstanding: prev ? outstanding - prev.outstanding : null,
      previousWeek: prev ? prev.week : null,
      partial: Date.parse(start) + WEEK_MS > now,
    });
  }

  const latest = weeks[weeks.length - 1];
  const delta = latest?.deltaOutstanding ?? null;
  const trend: ScanSweepTrend =
    delta === null ? 'insufficient-data' : delta < 0 ? 'falling' : delta > 0 ? 'rising' : 'flat';

  return {
    definition: SCAN_SWEEP_DEFINITION,
    rows: valid.length,
    skipped,
    weeks,
    trend,
    latestWeekPartial: latest?.partial ?? false,
  };
}
