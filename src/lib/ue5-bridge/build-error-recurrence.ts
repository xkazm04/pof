/**
 * Recurring build errors, derived from the builds themselves.
 *
 * Every headless build persists its parsed diagnostics in
 * `headless_builds.diagnostics_json`. This pure module turns a project's build
 * rows into recurring-error entries: each error diagnostic is fingerprinted
 * with the shared {@link fingerprintErrors} (line numbers and paths stripped),
 * `occurrences` counts the BUILDS that carried the fingerprint, and resolution
 * is judged PER LANE (target | target type | configuration | platform): an
 * error is still failing when the latest completed build of any lane it
 * occurred in still carries it. A clean Editor build therefore never "fixes"
 * an error that the latest Shipping build still reports.
 *
 * It replaces the old read of `error_memory`, which has no project column and
 * which no build in the app writes (it is only fed when a build carries a
 * moduleId, and the only enqueue caller sends none).
 */

import { fingerprintErrors } from '@/lib/error-fingerprint';

// ── Types ────────────────────────────────────────────────────────────────────

/** The build columns recurrence needs (a structural subset of `HealthBuild`). */
export interface RecurrenceBuild {
  buildId: string;
  targetName: string;
  targetType?: string;
  configuration: string;
  platform: string;
  status: string;
  errorCount: number;
  createdAt: string;
  /** Raw `diagnostics_json`; null/absent when the build counted no errors. */
  diagnosticsJson?: string | null;
}

export interface RecurringError {
  fingerprint: string;
  pattern: string;
  category: string;
  message: string;
  /** Number of charted builds whose diagnostics carried this fingerprint. */
  occurrences: number;
  /** Kept for response compatibility; builds carry no module, so always ''. */
  moduleId: string;
  errorCode: string | null;
  /** `!stillFailing` — the latest build of every lane it hit no longer has it. */
  wasResolved: boolean;
  lastSeenAt: string;
  lastSeenBuildId: string;
  /** The latest completed build of some lane it occurred in still carries it. */
  stillFailing: boolean;
  /** Label of the lane to show: a still-failing lane if any, else where last seen. */
  lane: string;
  /** Every lane label it occurred in, most recent first. */
  lanes: string[];
  fixDescription: string;
  /** How many builds were scanned (the denominator for `occurrences`). */
  buildsScanned: number;
}

type LaneFields = Pick<RecurrenceBuild, 'targetName' | 'targetType' | 'configuration' | 'platform'>;

// ── Lanes ────────────────────────────────────────────────────────────────────

export function laneKey(b: LaneFields): string {
  return [b.targetName, b.targetType ?? '', b.configuration, b.platform].join('|');
}

/** 'Did' + 'Editor' -> 'DidEditor Development Win64'; Game adds no suffix. */
export function laneLabel(b: LaneFields): string {
  const type = b.targetType ?? '';
  const suffix = type === 'Game' || b.targetName.endsWith(type) ? '' : type;
  return `${b.targetName}${suffix} ${b.configuration} ${b.platform}`;
}

// ── Diagnostics parsing ──────────────────────────────────────────────────────

interface ErrorEntry {
  message: string;
  code: string | null;
  file: string | null;
}

/** Error-severity diagnostics from a stored JSON column; anything malformed yields []. */
export function parseErrorDiagnostics(json: string | null | undefined): ErrorEntry[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ErrorEntry[] = [];
  for (const d of parsed) {
    if (!d || typeof d !== 'object') continue;
    const rec = d as Record<string, unknown>;
    if (rec.severity !== 'error' || typeof rec.message !== 'string' || rec.message === '') continue;
    out.push({
      message: rec.message,
      code: typeof rec.code === 'string' ? rec.code : null,
      file: typeof rec.file === 'string' ? rec.file : null,
    });
  }
  return out;
}

// ── Derivation ───────────────────────────────────────────────────────────────

function time(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

interface Acc {
  base: ReturnType<typeof fingerprintErrors>[number];
  buildIds: Set<string>;
  lanes: Map<string, { label: string; lastAt: number }>;
  last: RecurrenceBuild;
}

export function deriveRecurringErrors(builds: RecurrenceBuild[], limit = 8): RecurringError[] {
  // Oldest first, so later builds overwrite "last seen" and "latest in lane".
  const chronological = [...builds].sort((a, b) => time(a.createdAt) - time(b.createdAt));
  const fingerprintsByBuild = new Map<string, Set<string>>();
  const latestInLane = new Map<string, string>(); // laneKey -> buildId
  const acc = new Map<string, Acc>();

  for (const b of chronological) {
    const key = laneKey(b);
    const fps = b.errorCount > 0 ? fingerprintErrors(parseErrorDiagnostics(b.diagnosticsJson)) : [];
    // A build testifies about its lane only if it finished (not aborted) and, when it
    // counted errors, they parsed — otherwise it can neither fix nor keep an error.
    const testifies = b.status !== 'aborted' && (b.errorCount <= 0 || fps.length > 0);
    if (testifies) latestInLane.set(key, b.buildId);
    if (fps.length === 0) continue;
    fingerprintsByBuild.set(b.buildId, new Set(fps.map((f) => f.fingerprint)));
    for (const fp of fps) {
      const entry = acc.get(fp.fingerprint) ?? { base: fp, buildIds: new Set(), lanes: new Map(), last: b };
      entry.base = fp; // latest wording wins
      entry.buildIds.add(b.buildId);
      entry.lanes.set(key, { label: laneLabel(b), lastAt: time(b.createdAt) });
      entry.last = b;
      acc.set(fp.fingerprint, entry);
    }
  }

  const out: RecurringError[] = [];
  for (const [fingerprint, e] of acc) {
    const lanesRecent = [...e.lanes.entries()].sort((a, b) => b[1].lastAt - a[1].lastAt);
    const failing = lanesRecent.find(([k]) => {
      const latest = latestInLane.get(k);
      return latest != null && (fingerprintsByBuild.get(latest)?.has(fingerprint) ?? false);
    });
    const stillFailing = failing != null;
    out.push({
      fingerprint,
      pattern: e.base.pattern,
      category: e.base.category,
      message: e.base.message,
      occurrences: e.buildIds.size,
      moduleId: '',
      errorCode: e.base.errorCode,
      wasResolved: !stillFailing,
      lastSeenAt: e.last.createdAt,
      lastSeenBuildId: e.last.buildId,
      stillFailing,
      lane: (failing ?? lanesRecent[0])[1].label,
      lanes: lanesRecent.map(([, l]) => l.label),
      fixDescription: e.base.fixDescription,
      buildsScanned: builds.length,
    });
  }

  return out
    .sort(
      (a, b) =>
        Number(b.stillFailing) - Number(a.stillFailing) ||
        b.occurrences - a.occurrences ||
        time(b.lastSeenAt) - time(a.lastSeenAt),
    )
    .slice(0, limit);
}
