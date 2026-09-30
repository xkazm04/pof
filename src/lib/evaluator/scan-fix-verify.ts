/**
 * Fix & verify — a fix closes a finding only when a targeted re-scan stops
 * finding it. Remediation does not close a finding; verification does: the
 * actor that made the change never certifies it.
 *
 *   fix runs (per finding)  ->  fixed | fix-failed        (exit code: resolves NOTHING)
 *   Verify (operator click) ->  ONE module scan over the fixed targets' passes
 *   its recorded delta      ->  verified (cleared) | still-present (persisting)
 *                               | unverified (not re-scanned / not in the delta)
 *
 * Only `verified` ids are resolved (one PATCH). The verification scan is never
 * dispatched on its own: it is a paid module scan, so it runs on a click.
 * Pure — the Scan tab hook (`useScanTab`) owns the dispatch and the PATCH.
 */
import { EVAL_PASS_VOCABULARY, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { ScanDelta, ScanFinding } from '@/types/scan';

/** The one fix prompt: every Fix path (batch and single row) sends exactly this. */
export function buildScanFixPrompt(finding: ScanFinding, moduleLabel: string): string {
  return `Fix the following issue in the ${moduleLabel} module:\n\n**${finding.category}** (${finding.severity})\n${finding.description}\n\nFile: ${finding.file ?? 'N/A'}\n\nSuggested fix: ${finding.suggestedFix}`;
}

/** One finding as a scan prompt's previous-findings line (same shape a Re-Scan sends). */
export function formatPreviousFinding(f: ScanFinding): string {
  return `- [${f.severity}] ${f.category}: ${f.description} (${f.file ?? 'general'})`;
}

export interface FixVerificationPlan {
  /** The targets' passes, deduped, in pass-vocabulary order. */
  passes: EvalPass[];
  targetIds: string[];
  /** The scan prompt's previous-findings section: exactly the targets. */
  previousFindings: string;
}

const VERIFY_HEADER =
  'FIX VERIFICATION: each issue below was just fixed. Re-check every one of them. '
  + 'If an issue is still present, report it again (same pass, file and category); '
  + 'leave it out only when you confirmed the fix removed it.';

/** One scan over the targets' passes, naming exactly the targets. `null` = nothing to verify. */
export function planFixVerification(targets: readonly ScanFinding[]): FixVerificationPlan | null {
  if (targets.length === 0) return null;
  const used = new Set<string>(targets.map((t) => t.pass));
  return {
    passes: EVAL_PASS_VOCABULARY.filter((p) => used.has(p)),
    targetIds: targets.map((t) => t.id),
    previousFindings: [VERIFY_HEADER, ...targets.map(formatPreviousFinding)].join('\n'),
  };
}

export interface FixSettlement {
  verified: string[];
  stillPresent: string[];
  unverified: string[];
}

/**
 * Judge each target by the verification scan's reconciled delta. Only targets
 * are ever returned: a non-target the scan cleared is the ScanDelta's business.
 */
export function settleFixVerification(
  targetIds: readonly string[],
  delta: Pick<ScanDelta, 'cleared' | 'persisting' | 'notRescanned' | 'new'>,
): FixSettlement {
  const cleared = new Set(delta.cleared);
  const persisting = new Set(delta.persisting);
  const out: FixSettlement = { verified: [], stillPresent: [], unverified: [] };
  for (const id of targetIds) {
    if (persisting.has(id)) out.stillPresent.push(id);
    else if (cleared.has(id)) out.verified.push(id);
    else out.unverified.push(id);
  }
  return out;
}

// ─── The Scan tab's fix-verification state (pure transitions) ────────────────

export type FixTargetState =
  | 'fixing' | 'fixed' | 'fix-failed' | 'verifying' | 'verified' | 'still-present' | 'unverified';

export type FixVerifyStatus = 'idle' | 'fixing' | 'ready-to-verify' | 'verifying' | 'settled' | 'unverified';

export interface FixVerification {
  status: FixVerifyStatus;
  byId: Record<string, FixTargetState>;
  /** Why a verification resolved nothing (`unverified`). */
  reason: string | null;
}

export const FIX_VERIFICATION_IDLE: FixVerification = { status: 'idle', byId: {}, reason: null };

/** Ids in a given state. */
export function idsIn(v: FixVerification, state: FixTargetState): string[] {
  return Object.keys(v.byId).filter((id) => v.byId[id] === state);
}

/** Start fixing `ids`. Fixes still awaiting Verify carry over, so one click verifies them all. */
export function beginFixes(prev: FixVerification, ids: readonly string[]): FixVerification {
  const carry = prev.status === 'fixing' || prev.status === 'ready-to-verify';
  const byId: Record<string, FixTargetState> = {};
  if (carry) for (const id of idsIn(prev, 'fixed')) byId[id] = 'fixed';
  for (const id of ids) byId[id] = 'fixing';
  return { status: 'fixing', byId, reason: null };
}

export function recordFixOutcome(prev: FixVerification, id: string, success: boolean): FixVerification {
  if (prev.byId[id] !== 'fixing') return prev;
  return { ...prev, byId: { ...prev.byId, [id]: success ? 'fixed' : 'fix-failed' } };
}

/** A queued target that vanished before its fix ran: it was never fixed. */
export function dropFixTarget(prev: FixVerification, id: string): FixVerification {
  if (!(id in prev.byId)) return prev;
  const byId = { ...prev.byId };
  delete byId[id];
  return { ...prev, byId };
}

/** The fix queue drained: Verify is offered when something was fixed. */
export function finishFixes(prev: FixVerification): FixVerification {
  if (prev.status !== 'fixing') return prev;
  return { ...prev, status: idsIn(prev, 'fixed').length > 0 ? 'ready-to-verify' : 'settled' };
}

export function beginVerification(prev: FixVerification, targetIds: readonly string[]): FixVerification {
  const byId = { ...prev.byId };
  for (const id of targetIds) byId[id] = 'verifying';
  return { status: 'verifying', byId, reason: null };
}

export function applySettlement(prev: FixVerification, s: FixSettlement): FixVerification {
  const byId = { ...prev.byId };
  for (const id of s.verified) byId[id] = 'verified';
  for (const id of s.stillPresent) byId[id] = 'still-present';
  for (const id of s.unverified) byId[id] = 'unverified';
  return { status: 'settled', byId, reason: null };
}

/** The verification scan left no record: nothing is resolved, and the reason is kept. */
export function markUnverified(prev: FixVerification, reason: string): FixVerification {
  const byId = { ...prev.byId };
  for (const id of idsIn(prev, 'verifying')) byId[id] = 'unverified';
  return { status: 'unverified', byId, reason };
}
