/**
 * Snapshot review — the pure decisions behind the Test Harness Snapshots tab.
 *
 * The plugin contract (docs/ue5-companion-plugin-design.md, route table):
 *   POST /pof/snapshot/capture  -> { accepted: true, presetIds }   (async ACK, not a report)
 *   GET  /pof/snapshot/diff     -> DiffReport                       (the latest report)
 *   POST /pof/snapshot/baseline -> { saved: [...] }                 (overwrites <id>-baseline.png)
 *
 * So a capture is read back, and a re-baseline is only ever of a view the user
 * saw not pass. A baseline overwrite cannot be undone from PoF (the plugin has
 * no restore endpoint), which is why the confirm copy names what it overwrites.
 */

import type { PofSnapshotDiffReport, PofSnapshotDiffResult } from '@/types/pof-bridge';

export type CaptureReply =
  | { kind: 'accepted'; presetIds: string[] }
  | { kind: 'report'; report: PofSnapshotDiffReport }
  | { kind: 'invalid'; reason: string };

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** The value as a DiffReport when it has the report's shape, else null. */
export function readDiffReport(x: unknown): PofSnapshotDiffReport | null {
  if (!isRecord(x)) return null;
  if (typeof x.generatedAt !== 'string' || !Array.isArray(x.results) || !isRecord(x.summary)) return null;
  if (x.overallStatus !== 'passed' && x.overallStatus !== 'failed') return null;
  return x as unknown as PofSnapshotDiffReport;
}

/** Read a capture reply for what it is: the plugin's async ack, an inline report, or neither. */
export function normalizeCaptureReply(x: unknown): CaptureReply {
  const report = readDiffReport(x);
  if (report) return { kind: 'report', report };
  if (!isRecord(x)) return { kind: 'invalid', reason: 'capture reply was not an object' };
  if (x.accepted === true && Array.isArray(x.presetIds) && x.presetIds.every((id) => typeof id === 'string')) {
    return { kind: 'accepted', presetIds: x.presetIds as string[] };
  }
  if (x.accepted === false) return { kind: 'invalid', reason: 'the plugin declined the capture' };
  return { kind: 'invalid', reason: 'capture reply was neither an ack ({ accepted, presetIds }) nor a diff report' };
}

export interface ReadbackTarget {
  /** generatedAt of the report known BEFORE the capture (null: none existed). */
  since: string | null;
  presetIds: string[];
}

/** A read-back report counts only when it is newer than the pre-capture one and covers every requested preset. */
export function isReadbackFresh(report: PofSnapshotDiffReport, target: ReadbackTarget): boolean {
  if (target.since !== null && !(Date.parse(report.generatedAt) > Date.parse(target.since))) return false;
  const covered = new Set(report.results.map((r) => r.presetId));
  return target.presetIds.every((id) => covered.has(id));
}

// ── Review ───────────────────────────────────────────────────────────────────

/** A row whose baseline file already exists (accepting it overwrites). */
const hasBaseline = (r: PofSnapshotDiffResult) => r.status === 'failed' || r.status === 'resolution-mismatch';

export interface ReviewRow {
  presetId: string;
  result: PofSnapshotDiffResult;
  /** Offers "Accept as baseline" (every status but passed). */
  acceptable: boolean;
  /** Accepting replaces an existing baseline (failed / resolution-mismatch). */
  overwrites: boolean;
}

export interface SnapshotReview {
  rows: ReviewRow[];
  acceptable: string[];
  /** "Accept N as baseline", or null when nothing may be accepted. */
  bulkLabel: string | null;
}

export function reviewRows(report: PofSnapshotDiffReport): SnapshotReview {
  const rows = report.results.map((result) => ({
    presetId: result.presetId,
    result,
    acceptable: result.status !== 'passed',
    overwrites: hasBaseline(result),
  }));
  const acceptable = rows.filter((r) => r.acceptable).map((r) => r.presetId);
  return { rows, acceptable, bulkLabel: acceptable.length > 0 ? `Accept ${acceptable.length} as baseline` : null };
}

/** The ids that may be re-baselined: present in the report and not passed, in the order asked. */
export function planAccept(report: PofSnapshotDiffReport, ids: string[]): string[] {
  const byId = new Map(report.results.map((r) => [r.presetId, r]));
  return [...new Set(ids)].filter((id) => {
    const r = byId.get(id);
    return r !== undefined && r.status !== 'passed';
  });
}

/** The confirm copy: what an accept overwrites (irreversibly) and what it creates. */
export function describeAccept(report: PofSnapshotDiffReport, ids: string[]): string {
  const byId = new Map(report.results.map((r) => [r.presetId, r]));
  const plan = planAccept(report, ids);
  const overwrites = plan.filter((id) => hasBaseline(byId.get(id)!));
  const creates = plan.filter((id) => !overwrites.includes(id));
  const parts: string[] = [];
  if (overwrites.length > 0) {
    const noun = overwrites.length === 1 ? 'baseline' : 'baselines';
    parts.push(`Overwrites ${overwrites.length} existing ${noun} (${overwrites.join(', ')}) - cannot be undone from PoF`);
  }
  if (creates.length > 0) {
    parts.push(parts.length > 0
      ? `creates ${creates.length} (${creates.join(', ')})`
      : `Creates ${creates.length} ${creates.length === 1 ? 'baseline' : 'baselines'} (${creates.join(', ')})`);
  }
  return parts.join('; ');
}

/** Ids the verified re-diff still does not show as passed. */
export function unverifiedAccepts(report: PofSnapshotDiffReport, ids: string[]): string[] {
  const passed = new Set(report.results.filter((r) => r.status === 'passed').map((r) => r.presetId));
  return ids.filter((id) => !passed.has(id));
}

/** Parse the presets field ("a, b c") into unique ids. */
export function parsePresetIds(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}
