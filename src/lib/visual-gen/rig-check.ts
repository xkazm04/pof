/**
 * Rig check — one produced rig compared against EVERY target skeleton, for the Auto-Rig
 * tab's "Check a produced rig" panel.
 *
 * The tab chose its target skeleton from three static cards while every rig PoF produces
 * (Tripo `animate_rig`, SkinTokens) was judged only from a terminal. This module projects
 * one `gateRig` result (`rig-gate.ts`) through `bindRigToPreset` (`rig-binding.ts`) once
 * per preset, so the operator sees, side by side, how many required IK chain endpoints
 * the rig's ACTUAL bone names bind on each target, which limbs break, and which target
 * the evidence supports.
 *
 * The recommendation is deliberately narrow: the FIRST remap preset (in `RIG_PRESETS`
 * order) whose binding is `bound`. A conform target is never recommended — its template
 * ships its own skeleton, so a produced rig's names are not bound to it — and an
 * anonymous, partial or unread rig recommends nothing and says why.
 *
 * Pure and client-safe: types only from `rig-gate.ts` (which reads the disk), so the
 * panel can import this without pulling `node:fs` into the browser bundle.
 */
import type { RigGateResult, RigVerdict } from './rig-gate';
import { bindRigToPreset, type RigBindingStatus } from './rig-binding';
import type { RigPreset, RigTargetKind } from './rig-presets';
import { MORPHOLOGY_GROUPS, classifyNaming, type BoneNaming, type Morphology } from './skeleton-profiles';

/** The endpoint the Auto-Rig panel posts to. */
export const RIG_CHECK_ENDPOINT = '/api/visual-gen/rig-check';

/** The seven morphologies a check may assume — the anatomy vocabulary of `skeleton-profiles.ts`. */
export const RIG_CHECK_MORPHOLOGIES = Object.keys(MORPHOLOGY_GROUPS) as Morphology[];

export function isMorphology(value: unknown): value is Morphology {
  return typeof value === 'string' && (RIG_CHECK_MORPHOLOGIES as string[]).includes(value);
}

/** Whether the file was read and carries a skin — not whether the rig passed. */
export type RigCheckState = 'rigged' | 'not-rigged' | 'unreadable';

export interface RigCheckRow {
  presetId: string;
  presetName: string;
  kind: RigTargetKind;
  status: RigBindingStatus;
  /** Required chain endpoints some rig bone binds to. */
  bound: number;
  /** Required chain endpoints the target declares. */
  required: number;
  /** IK chains that will not retarget on this target. */
  unboundChains: string[];
  /** Safe to print verbatim. */
  reason: string;
}

export interface RigCheckSummary {
  state: RigCheckState;
  naming: BoneNaming | null;
  jointCount: number;
  vertexCount: number;
  /** `null` when the mesh's morph targets were not read. */
  morphTargetCount: number | null;
  /** The Tier-1 gate verdict; `null` only when the file could not be read. */
  verdict: RigVerdict | null;
  /** One row per preset when rigged; empty otherwise. */
  rows: RigCheckRow[];
  /** The preset id the evidence supports, or `null` with {@link recommendationReason}. */
  recommended: string | null;
  recommendationReason: string;
  /** One line describing the state. Safe to print verbatim. */
  message: string;
}

/** What the route answers: the summary plus the request it answers. */
export interface RigCheckResponse extends RigCheckSummary {
  name: string;
  dir: string;
  morphology: Morphology;
}

/** Project one gate result onto every target preset. Pure. */
export function summarizeRigCheck(gate: RigGateResult, presets: readonly RigPreset[]): RigCheckSummary {
  if (!gate.ok || !gate.facts) {
    const error = gate.error ?? 'the rig could not be read';
    return {
      state: 'unreadable', naming: null, jointCount: 0, vertexCount: 0, morphTargetCount: null,
      verdict: null, rows: [], recommended: null,
      recommendationReason: `no target can be recommended: ${error}`,
      message: `the file could not be read as a rig: ${error}`,
    };
  }
  const { facts } = gate;
  const verdict = gate.verdict ?? null;
  const base = {
    jointCount: facts.jointCount,
    vertexCount: facts.vertexCount,
    morphTargetCount: facts.morphTargetCount ?? null,
    verdict,
  };

  if (!facts.hasSkin) {
    return {
      ...base, state: 'not-rigged', naming: null, rows: [], recommended: null,
      recommendationReason: 'no target can be recommended: the asset is not rigged',
      message: verdict?.failures[0] ?? 'no skin: the asset has no joints or vertex weights, so it is not rigged',
    };
  }

  const naming = facts.jointNames ? classifyNaming(facts.jointNames) : null;
  const rows: RigCheckRow[] = presets.map((preset) => {
    const b = bindRigToPreset(facts.jointNames, preset);
    return {
      presetId: preset.id,
      presetName: preset.name,
      kind: preset.kind,
      status: b.status,
      bound: b.boundRequired.length,
      required: b.required.length,
      unboundChains: b.unboundChains,
      reason: b.reason,
    };
  });

  return {
    ...base,
    state: 'rigged',
    naming,
    rows,
    ...recommend(rows),
    message: `rig read: ${facts.jointCount} joint(s) over ${facts.vertexCount} vertices, ${naming ?? 'uncaptured'} names`,
  };
}

/** The first fully-bound remap row, else `null` with the reason none qualifies. Pure. */
function recommend(rows: RigCheckRow[]): { recommended: string | null; recommendationReason: string } {
  const remap = rows.filter((r) => r.kind === 'remap');
  const hit = remap.find((r) => r.status === 'bound');
  if (hit) {
    return {
      recommended: hit.presetId,
      recommendationReason: `${hit.presetId} binds all ${hit.required} required chain endpoints — the first remap target that does`,
    };
  }
  if (remap.length === 0) {
    return { recommended: null, recommendationReason: 'no remap target is defined, so no produced rig can be bound to one' };
  }
  const unverifiable = remap.find((r) => r.status === 'unverifiable');
  if (unverifiable) {
    return { recommended: null, recommendationReason: `no target can be recommended: ${unverifiable.reason}` };
  }
  const broken = remap.map((r) => `${r.presetId} breaks ${r.unboundChains.join(', ')}`).join('; ');
  return { recommended: null, recommendationReason: `no remap target binds every IK chain: ${broken}` };
}
