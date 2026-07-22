/**
 * Browser-mirror capability map — which pipeline step classes can also be executed
 * in a browser preview runtime (dual execution: PoF app → Browser → UE).
 * Pure derivation from a step's deliverable class (step-facts vocabulary), so /status,
 * step UIs, and pof-mcp can all answer "does this step have a browser path?" identically.
 * Spec: docs/research/dual-execution-preview-spec.md
 */

/** Deliverable classes as audited in src/lib/status/step-facts.json. */
export type DeliverableClass =
  | 'text-config'
  | 'graph-data'
  | '2d-art'
  | 'audio'
  | '3d-mesh'
  | 'animation'
  | 'vfx-particles'
  | 'ue-runtime';

export type MirrorSupport = 'direct' | 'partial' | 'none';

/** How well a deliverable class hydrates into a browser runtime. */
export const MIRROR_BY_DELIVERABLE: Record<DeliverableClass, MirrorSupport> = {
  'text-config': 'direct', // JSON mechanics/stats hydrate as-is
  'graph-data': 'direct', // dialog trees / state graphs are trivially executable
  '2d-art': 'direct', // served files usable in HUD/inventory unchanged
  audio: 'direct', // generated files play natively
  '3d-mesh': 'partial', // .glb loads; fidelity honestly diverges from UE
  animation: 'partial', // procedural stand-ins or glb clips
  'vfx-particles': 'partial', // readable approximations only
  'ue-runtime': 'none', // the UE verification moat — never mirrored
};

/**
 * UE-realization steps stay moat-side regardless of their data shape — some are
 * audited as text-config (a packaging manifest IS data) but their meaning is
 * "realized in UE", so a browser path claim would be dishonest.
 */
export const UE_REALIZATION_STEPS = new Set(['UE Packaging', 'Test Gate', 'UE Import']);

export function mirrorSupport(deliverable: string, step?: string): MirrorSupport {
  if (step && UE_REALIZATION_STEPS.has(step)) return 'none';
  return MIRROR_BY_DELIVERABLE[deliverable as DeliverableClass] ?? 'none';
}

/** True when the step class has any browser execution path (drives the /status icon + UI badge). */
export function isBrowserMirrorable(deliverable: string, step?: string): boolean {
  return mirrorSupport(deliverable, step) !== 'none';
}

/**
 * Catalogs the thin-slice preview runtime (saber-arpg combat sandbox) can hydrate today.
 * Grows as per-domain preview scenes land (dialog player, progression sim, …).
 */
export const PREVIEW_HYDRATABLE_CATALOGS = [
  'spellbook',
  'items',
  'status-effects',
  'progression-curves',
] as const;

/** Steps whose data carries playable mechanics for the combat-sandbox preview. */
export const MECHANICS_STEPS = [
  'Effect Logic',
  'Targeting',
  'Balance',
  'Stat Block',
  'Curve Formula',
  'Concept Brief',
  'Applies Status',
  'XP Sources',
  'Reward Schedule',
] as const;

export function isPreviewHydratable(catalogId: string): boolean {
  return (PREVIEW_HYDRATABLE_CATALOGS as readonly string[]).includes(catalogId);
}
