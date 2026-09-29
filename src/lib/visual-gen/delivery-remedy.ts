/**
 * The delivered mesh's NEXT STEP — the remedy a queue card offers under its verdict.
 *
 * The Tier-1 gate already knows more than "rejected": `assessStage` says which failing
 * criteria another paid roll could change and which the $0 local finish stage resolves,
 * and `planFinishFromCritique` decides whether a finish would help at all (including the
 * budget-DEFERRED character whose green `warn` is a mesh nobody has finished yet). This
 * projects those two existing decisions onto one of three answers. Pure — it never
 * spends, never touches the filesystem, and never changes a verdict.
 *
 *   - `finish` — $0. Names what it addresses and what will STILL be wrong afterwards.
 *   - `reroll` — PAID. Stated, never offered as a new button: the only path that pays
 *     for a generation stays the existing explicit Retry, which runs on failed jobs only.
 *   - `none`   — with the reason (floater-only failure, critic unavailable, mesh not in
 *     a servable dir). The refused fix that cannot help is SAID, never offered.
 *
 * `undefined` means there is nothing to remedy (a non-failing verdict with no deferred
 * budget left to enforce), so a clean card stays quiet.
 *
 * Runs server-side (the status route): `findings` never reach the client, so the client
 * could not compute this itself. The client imports the TYPE only.
 */
import type { CritiqueResult, FindingCode } from './mesh-critique';
import { assessStage } from './critique-stage';
import { planFinishFromCritique } from './finish-routing';
import { ASSET_DIRS, safeAssetDir, safeAssetName } from './generated-assets';

export type DeliveryRemedy =
  | {
      kind: 'finish';
      paid: false;
      /** Basename inside `generated/<dir>/` — exactly what the remediate route takes. */
      name: string;
      dir: string;
      addresses: FindingCode[];
      unaddressed: FindingCode[];
      /** The planner's own sentence, verbatim. */
      note: string;
    }
  | { kind: 'reroll'; paid: true; addresses: FindingCode[]; note: string }
  | { kind: 'none'; reason: string };

export interface RemedyInput {
  critique: CritiqueResult | undefined;
  assetClass?: string;
  /** Server-side path of the delivered mesh. */
  meshPath?: string;
}

const SERVABLE = ASSET_DIRS.map((d) => d.dir).join(', ');

/** `generated/<dir>/<name>` → `{ name, dir }`, or the reason it is not that shape. Pure. */
function locate(meshPath: string | undefined): { name: string; dir: string } | { reason: string } {
  if (!meshPath) return { reason: 'no delivered mesh path was recorded, so there is no file to finish' };
  const parts = meshPath.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] ?? '';
  const dir = parts[parts.length - 2] ?? '';
  // `safeAssetDir('')` resolves the DEFAULT dir, so an absent dir must be refused here.
  if (!dir || !safeAssetDir(dir)) {
    return { reason: `the mesh is in "${dir || '(no dir)'}", not a servable generated dir (${SERVABLE}) — the finish route only reads generated/<dir>/` };
  }
  if (parts[parts.length - 3] !== 'generated') {
    return { reason: `the mesh is at ${meshPath}, not under generated/${dir}/ — the finish route only reads there` };
  }
  if (!safeAssetName(name)) return { reason: `"${name}" is not a safe generated-asset basename` };
  return { name, dir };
}

export function remedyFor({ critique, assetClass, meshPath }: RemedyInput): DeliveryRemedy | undefined {
  if (!critique) return undefined;
  if (critique.unavailable) {
    return { kind: 'none', reason: `the critic could not run (${critique.error ?? 'reason not reported'}) — with no verdict there is nothing to route to a remedy` };
  }
  if (!critique.ok || critique.verdict === undefined) {
    return { kind: 'none', reason: `the critique did not complete (${critique.error ?? 'no verdict'}), so no remedy can be derived from it` };
  }

  // A bad DRAW (empty / degenerate) is the one failure another roll can change. It is
  // paid, so it is stated beside the verdict and never becomes a button here.
  const assessment = assessStage(critique, 'raw');
  if (assessment.rerollWorthwhile) {
    return {
      kind: 'reroll',
      paid: true,
      addresses: assessment.rerollResolvable,
      note: `${assessment.rerollResolvable.join(', ')} is a bad draw that finishing cannot repair — only another generation can change it, and another generation is PAID. Submit one from the panel above if you want to spend it.`,
    };
  }

  const at = locate(meshPath);
  const plan = 'reason' in at
    ? null
    : planFinishFromCritique({ meshName: at.name, meshDir: at.dir, critique, assetClass, stage: 'raw' });

  if (critique.verdict !== 'fail') {
    // Only the deferred-budget branch finishes a non-failing mesh; anything else has
    // nothing to remedy and must not grow a line on a clean card.
    return plan?.ok && !('reason' in at)
      ? { kind: 'finish', paid: false, name: at.name, dir: at.dir, addresses: plan.addresses, unaddressed: plan.unaddressed, note: plan.note }
      : undefined;
  }

  if ('reason' in at) return { kind: 'none', reason: at.reason };
  if (!plan?.ok) return { kind: 'none', reason: plan?.reason ?? 'no finish plan' };
  return { kind: 'finish', paid: false, name: at.name, dir: at.dir, addresses: plan.addresses, unaddressed: plan.unaddressed, note: plan.note };
}
