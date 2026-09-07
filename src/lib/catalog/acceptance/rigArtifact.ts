import { readHistory, selectedCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import { gradeGallerySelection } from './galleryArtifact';
import type { AcceptanceResult, Checker } from './types';
import type { RigFacts, RigVerdict } from '@/lib/visual-gen/rig-gate';

/**
 * THE RIG ARTIFACT — writer and grader together, the same contract shape as
 * `galleryArtifact.ts`, and for the same reason: the grader is only honest if it can rely
 * on the shape the producer writes.
 *
 * ── The defect this closes ────────────────────────────────────────────────────
 * The bestiary's "3D & Rig" step graded with `selected('mesh', 'A rigged mesh candidate is
 * selected')`. That checker grades ASSET PRESENCE — a candidate carrying a real `.glb`
 * passes. A **static, unrigged** `.glb` therefore passed a step whose own label claims a
 * rigged mesh, and nothing anywhere examined whether a skeleton existed. That is exactly
 * the shape-only-checker class the /status map flags.
 *
 * Now the step can only pass on evidence that a rig was actually produced AND survived the
 * Tier-1 gate (`src/lib/visual-gen/rig-gate.ts`): joints exist, every vertex carries
 * weight, weights are normalized, no negative/non-finite weights.
 *
 * ── Why "no rig record" is DEFERRED and not FAIL ──────────────────────────────
 * An ungated mesh is not a broken artifact — it is an unjudged one, and no local edit can
 * conjure a rig; `skintokens-cli` has to run. So it defers at L4 with a reason that names
 * the missing run, matching how `galleryArtifact` treats a swatch placeholder. Honesty
 * over greenness: deferred, never a manufactured pass.
 *
 * The rig gate itself is GPU-only and its backend is flaky — see
 * `docs/research/skintokens-rigging-spec.md` for the measurements and the retry that
 * makes it usable.
 */

/** Key the rig record lives under on a gallery candidate's `payload`. */
export const RIG_PAYLOAD_KEY = 'rig';

/**
 * What a producer stamps onto the candidate payload after gating a rigged mesh.
 * Deliberately a flat, serializable summary of {@link RigVerdict} + the {@link RigFacts}
 * a reader would want to see, not the whole facts object: the artifact is persisted JSON
 * and read by humans in the provenance strip.
 */
export interface RigCandidateRecord {
  pass: boolean;
  score: number;
  jointCount: number;
  referencedJoints: number;
  vertexCount: number;
  zeroWeightVertices: number;
  /**
   * Morph-target channels the mesh declares — whether the character can move its FACE at
   * all. Recorded because a skeleton says nothing about it: a rig can score 100/100 on
   * every weight and still be unable to blink or speak. `undefined` on records written
   * before the gate read this, which must not be read as "no face".
   */
  morphTargetCount?: number;
  failures: string[];
  warnings: string[];
}

/**
 * Project a `runSkintokens` result onto the candidate payload fragment.
 *
 * Spread into a mesh candidate's payload:
 * `payload: { [field]: i, glbUrl: url, ...rigCandidatePayload(result) }`.
 *
 * Returns `{}` when the gate did not run. That is the load-bearing case: recording a
 * placeholder would let "we never gated this" read as "gated and fine", which is the
 * failure mode this whole contract exists to prevent.
 */
export function rigCandidatePayload(result: {
  rig?: RigVerdict;
  facts?: RigFacts;
}): Record<string, unknown> {
  const { rig, facts } = result;
  if (!rig || !facts) return {};
  const record: RigCandidateRecord = {
    pass: rig.pass,
    score: rig.score,
    jointCount: facts.jointCount,
    referencedJoints: facts.referencedJoints,
    vertexCount: facts.vertexCount,
    zeroWeightVertices: facts.zeroWeightVertices,
    morphTargetCount: facts.morphTargetCount,
    failures: rig.failures,
    warnings: rig.warnings,
  };
  return { [RIG_PAYLOAD_KEY]: record };
}

/** Read the rig record off a candidate payload, or null when the gate never ran. */
function readRigRecord(payload: Record<string, unknown> | undefined): RigCandidateRecord | null {
  const raw = (payload ?? {})[RIG_PAYLOAD_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RigCandidateRecord>;
  if (typeof r.pass !== 'boolean' || typeof r.jointCount !== 'number') return null;
  return {
    pass: r.pass,
    score: typeof r.score === 'number' ? r.score : 0,
    jointCount: r.jointCount,
    referencedJoints: typeof r.referencedJoints === 'number' ? r.referencedJoints : 0,
    vertexCount: typeof r.vertexCount === 'number' ? r.vertexCount : 0,
    zeroWeightVertices: typeof r.zeroWeightVertices === 'number' ? r.zeroWeightVertices : 0,
    morphTargetCount: typeof r.morphTargetCount === 'number' ? r.morphTargetCount : undefined,
    failures: Array.isArray(r.failures) ? r.failures.map(String) : [],
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
  };
}

/**
 * Grade a rig-bearing gallery step. Pure; reads only the step's own artifact `data`, so it
 * behaves identically on the lab path, the server re-grade and the headless loop.
 *
 * The asset question is answered FIRST by `gradeGallerySelection` and outranks the rig
 * question: if no real mesh is attached (stub swatch, unresolved selection, no history)
 * there is nothing to have rigged, and that verdict is returned unchanged.
 */
export function gradeRiggedSelection(
  data: Record<string, unknown>,
  field: string,
  label: string,
): AcceptanceResult {
  const gallery = gradeGallerySelection(data, field, label);
  if (gallery.status !== 'pass') return gallery;

  const cand = selectedCandidate(readHistory(data));
  const rig = readRigRecord(cand?.payload as Record<string, unknown> | undefined);
  const named = cand?.caption ?? cand?.id ?? `candidate ${String(data[field])}`;

  if (!rig) {
    return {
      label,
      tier: 'L4',
      status: 'deferred',
      detail: `${named} — mesh attached, rig ungated`,
      reason:
        `the selected candidate (${named}) carries a real mesh, but no rig gate has run on it — ` +
        'nothing proves it has a skeleton or vertex weights, and this step claims a RIGGED mesh. ' +
        'A static mesh is indistinguishable from a rigged one at this layer. Run skintokens ' +
        '(src/lib/visual-gen/skintokens-runner.ts, GPU/Vulkan) so the candidate records its ' +
        'Tier-1 rig verdict, then re-grade.',
    };
  }

  if (!rig.pass) {
    return {
      label,
      tier: 'L2',
      status: 'fail',
      detail: `${named} — rig gate failed (${rig.jointCount} joints)`,
      reason:
        `the selected candidate (${named}) carries a rig that cannot deform the mesh: ` +
        `${rig.failures.join('; ') || 'no reason recorded'}.`,
    };
  }

  const warn = rig.warnings.length ? ` · ${rig.warnings.join('; ')}` : '';
  // State the facial channel where it is known. A reader looking at "28 joints, 100/100"
  // has no way to tell a character that can speak from one that can only ever be silent.
  const face =
    rig.morphTargetCount === undefined
      ? ''
      : rig.morphTargetCount === 0
        ? ' · no facial channel (0 morph targets)'
        : ` · ${rig.morphTargetCount} morph targets`;
  return {
    label,
    tier: 'L2',
    status: 'pass',
    detail: `${named} — ${rig.jointCount} joints / ${rig.vertexCount} verts, rig gate ${rig.score}/100${face}${warn}`,
  };
}

/**
 * Checker for a gallery step whose selected candidate must be a GATED RIG, not merely an
 * attached mesh. Drop-in replacement for `selected(field, label)` on rig steps.
 */
export function riggedMeshSelected(field: string, label: string): Checker {
  return (data) => gradeRiggedSelection(data, field, label);
}
