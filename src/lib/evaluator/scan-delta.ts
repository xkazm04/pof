/**
 * Scan-delta feed — derives a per-scan NEW / RESOLVED / PERSISTING trend from the
 * persisted deep-eval scan history, so the Game Director's regression tracking can
 * consume evaluator scans as a source alongside playtest/crash sessions.
 *
 * Pure (no DB / no React): fed the scan history from `evaluator-results-db`
 * (server) and imported type-only by the client view. Reuses the same
 * fingerprint-based {@link diffScans} that the live regression banner uses, so the
 * historical trend and the in-session diff agree.
 */

import { diffScans } from './regression-diff';
import type { SeverityCounts } from './regression-diff';
import type { EvalFinding } from './finding-collector';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A scan's regression delta against the immediately-prior scan. */
export interface ScanDelta {
  scanId: string;
  /** ms epoch of the scan. */
  timestamp: number;
  scannedAt: string;
  /** Modules re-evaluated in this scan (the diff scope). */
  modulesEvaluated: string[];
  /** Findings that appeared in this scan (absent from the prior scan / first scan). */
  newTotal: number;
  /** Prior findings no longer present. */
  resolvedTotal: number;
  /** Findings present in both. */
  persistingTotal: number;
  newBySeverity: SeverityCounts;
  resolvedBySeverity: SeverityCounts;
  /** False for the oldest scan (no baseline to diff against). */
  hasPrevious: boolean;
}

/** The minimal shape {@link deriveScanDeltas} needs from a persisted scan. */
export interface ScanLike {
  scanId: string;
  scannedAt: string;
  timestamp: number;
  modulesEvaluated: string[];
  findings: EvalFinding[];
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Derive the delta feed from scan history.
 *
 * @param scans  Scans **newest-first** (as `getScanHistory` returns them).
 * @returns      Deltas newest-first. Each scan is diffed against the scan
 *               immediately older than it, scoped to the modules that scan
 *               re-evaluated. The oldest scan has no baseline (`hasPrevious:false`)
 *               — every finding it surfaced counts as new, nothing resolved.
 */
export function deriveScanDeltas(scans: ScanLike[]): ScanDelta[] {
  return scans.map((scan, i) => {
    // The next index is the immediately-older scan (list is newest-first).
    const previous = scans[i + 1] ?? null;
    // Each persisted scan holds the MERGED baseline (re-evaluated modules' fresh
    // findings + carried-over findings for untouched modules). To surface only
    // what THIS scan changed, restrict BOTH sides to the modules it re-evaluated:
    // diffScans scopes `previous` internally, so we scope `current` here too —
    // otherwise identical carried-over findings would read as false NEW/RESOLVED.
    const scope = new Set(scan.modulesEvaluated);
    const scopedCurrent = scan.findings.filter((f) => scope.has(f.moduleId));
    const diff = diffScans(previous?.findings ?? null, scopedCurrent, {
      scopeModuleIds: scan.modulesEvaluated,
    });
    return {
      scanId: scan.scanId,
      timestamp: scan.timestamp,
      scannedAt: scan.scannedAt,
      modulesEvaluated: scan.modulesEvaluated,
      newTotal: diff.summary.newTotal,
      resolvedTotal: diff.summary.resolvedTotal,
      persistingTotal: diff.summary.persistingTotal,
      newBySeverity: diff.summary.new,
      resolvedBySeverity: diff.summary.resolved,
      hasPrevious: previous != null,
    };
  });
}
