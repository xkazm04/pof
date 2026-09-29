/**
 * The packaging sweep's pure halves: the sibling view the package is built from
 * (`siblingsForPackaging`), a rebuilt manifest's disk truth (`aggregatePackaging`) and its fold
 * with the step's static checks (`combinePackagingVerdict`). Extracted from packagingVerify.ts
 * (which re-exports all three) to keep the sweep under the 200-LOC ceiling.
 */
import type { AcceptanceResult } from './types';
import type { SiblingArtifact } from '../packaging/collect';
import type { PackageManifest } from '../packaging/packageArtifacts';
import { worstOf } from './combineVerdicts';

/** Grade a rebuilt manifest into the step's L2 verdict. Pure.
 *  Files and declarations are graded together (Tier 2 rung A): a step passes only when
 *  every referenced output exists on disk AND every checked `/Game/...` declaration is
 *  realized as a `.uasset`/`.umap` under the UE root. Unchecked declarations (no UE
 *  root) fall back to the Tier 1 files-only verdict, saying so. Never 'fail'. */
export function aggregatePackaging(manifest: PackageManifest, label: string): AcceptanceResult {
  const staged = manifest.files.length;
  const decls = manifest.ueDeclarations;
  const checked = decls.filter((d) => d.realized !== null);
  const realized = checked.filter((d) => d.realized === true);
  const unrealized = checked.filter((d) => d.realized === false);
  const declDetail =
    checked.length > 0
      ? `${realized.length}/${checked.length} UE declarations realized on disk`
      : decls.length > 0
        ? `${decls.length} UE declarations unchecked (no UE root resolved)`
        : '';

  const reasons: string[] = [];
  if (manifest.missing.length > 0) {
    reasons.push(...manifest.missing.map((m) => `${m.path} (${m.sourceStep}: ${m.reason})`));
  }
  if (unrealized.length > 0) {
    const head = unrealized.slice(0, 6).map((d) => d.path).join(', ');
    reasons.push(`${unrealized.length} UE declaration(s) not realized in Content/: ${head}${unrealized.length > 6 ? ', …' : ''}`);
  }

  if (reasons.length > 0) {
    return {
      label, tier: 'L2', status: 'deferred',
      detail: [`${staged}/${staged + manifest.missing.length} referenced outputs present on disk`, declDetail].filter(Boolean).join('; '),
      reason: reasons.join('; '),
    };
  }

  const hasSubstance = staged > 0 || realized.length > 0;
  if (hasSubstance) {
    return {
      label, tier: 'L2', status: 'pass',
      detail: [staged > 0 ? `${staged} real files staged + hashed in the package manifest` : '', declDetail].filter(Boolean).join('; '),
    };
  }

  return {
    label, tier: 'L2', status: 'deferred',
    detail: 'package is empty — no sibling step has produced a file yet',
    reason:
      `no packageable file outputs among sibling artifacts; ` +
      `${decls.length} UE asset declaration(s) listed — those are realized/verified by the L3 gates`,
  };
}

/** A packaging step's ONE verdict: its package's disk truth AND its declared static checks,
 *  the worse of the two, naming both halves. Pure. Null static = the step declares none. */
export function combinePackagingVerdict(pkg: AcceptanceResult, stat: AcceptanceResult | null): AcceptanceResult {
  return worstOf(pkg, stat);
}

/** Sibling view for the package build: every OTHER artifact contributes data + declarations;
 *  the packaging artifact itself contributes ONLY its `ueAssets` — that declared list is
 *  the step's own claim (the thing Tier 2 verifies), while its data (the hand-typed asset
 *  name list) must never feed the file collector. Pure. */
export function siblingsForPackaging(
  artifacts: { step: string; data: Record<string, unknown>; ueAssets: string[] }[],
  packagingStep: string,
): SiblingArtifact[] {
  return artifacts.map((a) =>
    a.step === packagingStep
      ? { step: a.step, data: {}, ueAssets: a.ueAssets }
      : { step: a.step, data: a.data, ueAssets: a.ueAssets },
  );
}
