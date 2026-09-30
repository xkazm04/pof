/**
 * Package ledger — the UE Packaging step's routing information, derived from its REBUILT
 * manifest (`packageArtifacts.buildPackage`) and its siblings' RESOLVED verdicts.
 *
 * The packaging sweep (`acceptance/packagingVerify.ts`) grades the manifest into one status;
 * this answers the operator's next question — "which sibling owes what?" — without grading
 * anything: every `missing[]` entry is grouped under the step that owes it, every unrealized
 * `/Game` declaration is named (with its declaring step when known), and every sibling whose
 * files were STAGED while its own verdict is not `pass` is listed as unverified content — the
 * package stages files whatever their step's verdict, so a TEMPLATE-held or judge-failed
 * sibling would otherwise ship unnoticed. Blockers follow pipeline order.
 *
 * Pure and client-safe (types only from the engine). Display only: it never moves a verdict.
 */
import type { AcceptanceStatus, SiblingVerdict } from '../acceptance/types';
import type { PackageManifest } from './packageArtifacts';

/** The layer that decided a sibling's verdict — the `SiblingVerdict` vocabulary, plus
 *  `stored` for a row no server checker could re-grade (its stored status stands). */
export type LedgerLayer = SiblingVerdict['source'] | 'stored';

export interface LedgerSibling {
  step: string;
  status: AcceptanceStatus;
  source: LedgerLayer;
  reason?: string;
}

export type LedgerBlockerKind = 'missing-file' | 'unrealized-declaration';

export interface LedgerBlocker {
  /** The step that owes it (`unattributed` when no sibling declared the path). */
  step: string;
  kind: LedgerBlockerKind;
  count: number;
  reason: string;
}

export interface LedgerUnverified {
  step: string;
  status: AcceptanceStatus;
  source: LedgerLayer;
  /** Files of this step's that the package staged anyway. */
  files: number;
  reason?: string;
}

/** `ready` = nothing blocks the disk half; `declarations-only` = the empty-package deferral
 *  `aggregatePackaging` reports (no file staged, no declaration realized). */
export type LedgerState = 'ready' | 'blocked' | 'declarations-only';

export interface PackageLedger {
  state: LedgerState;
  blockers: LedgerBlocker[];
  unverified: LedgerUnverified[];
  staged: number;
  /** `none` · `unchecked (no UE root)` · `<realized>/<checked> realized`. */
  declarations: string;
}

export const UNATTRIBUTED = 'unattributed';

function declarationsLine(decls: PackageManifest['ueDeclarations']): string {
  if (decls.length === 0) return 'none';
  const checked = decls.filter((d) => d.realized !== null);
  if (checked.length === 0) return 'unchecked (no UE root)';
  return `${checked.filter((d) => d.realized === true).length}/${checked.length} realized`;
}

export function packageLedger(
  manifest: Pick<PackageManifest, 'files' | 'missing' | 'ueDeclarations'>,
  siblings: LedgerSibling[],
  stepOrder: string[],
  /** `/Game/...` path → the step whose `ueAssets` declared it (first declarer wins, as in the collector). */
  declaredBy: Record<string, string> = {},
): PackageLedger {
  const rank = (step: string) => {
    const i = stepOrder.indexOf(step);
    return i < 0 ? stepOrder.length : i;
  };

  const missing = new Map<string, LedgerBlocker>();
  for (const m of manifest.missing) {
    const key = `${m.sourceStep}\u0000${m.reason}`;
    const hit = missing.get(key);
    if (hit) hit.count++;
    else missing.set(key, { step: m.sourceStep, kind: 'missing-file', count: 1, reason: m.reason });
  }
  const unrealized: LedgerBlocker[] = manifest.ueDeclarations
    .filter((d) => d.realized === false)
    .map((d) => ({ step: declaredBy[d.path] ?? UNATTRIBUTED, kind: 'unrealized-declaration', count: 1, reason: `${d.path} not realized in Content/` }));
  const blockers = [...missing.values(), ...unrealized]
    .map((b, i) => ({ b, i }))
    .sort((x, y) => rank(x.b.step) - rank(y.b.step) || x.i - y.i)
    .map(({ b }) => b);

  const stagedBy = new Map<string, number>();
  for (const f of manifest.files) stagedBy.set(f.sourceStep, (stagedBy.get(f.sourceStep) ?? 0) + 1);
  const unverified: LedgerUnverified[] = siblings
    .filter((s) => s.status !== 'pass' && stagedBy.has(s.step))
    .sort((a, b) => rank(a.step) - rank(b.step))
    .map((s) => ({ step: s.step, status: s.status, source: s.source, files: stagedBy.get(s.step)!, ...(s.reason ? { reason: s.reason } : {}) }));

  const realizedAny = manifest.ueDeclarations.some((d) => d.realized === true);
  const state: LedgerState =
    blockers.length > 0 || unverified.length > 0 ? 'blocked'
      : manifest.files.length === 0 && !realizedAny ? 'declarations-only'
        : 'ready';

  return { state, blockers, unverified, staged: manifest.files.length, declarations: declarationsLine(manifest.ueDeclarations) };
}
