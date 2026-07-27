/**
 * Version-keyed engine facts — the ONE place a prompt's claims about Unreal
 * Engine live.
 *
 * Why this exists: the prompt layer used to hard-code 5.7-era framing in three
 * different files (`prompt-context.ts`'s `DOMAIN_CONTEXT`,
 * `prompts/material-configurator.ts`, `prompts/animation-checklist.ts`) while the
 * live project is on **UE 5.8**. Every daily prompt therefore taught the model
 * stale engine truths — most loudly "MegaLights (beta)", which 5.8 promoted to
 * production-ready. Facts are now selected from the PROJECT's actual engine
 * version (`ProjectContext.ueVersion`), so upgrading the project upgrades the
 * prompts.
 *
 * Scope discipline: this is **not** a general engine-capability database. It
 * holds exactly the facts the prompts already assert, one authored literal each.
 * Add a field only when a prompt needs to state that fact.
 *
 * Sourcing: every claim below is grounded in this repo's own knowledge —
 * `docs/ue5-capability-integration-candidates.md` (per-version shipped-feature
 * ledger) and the MSVC ranges read from the INSTALLED engine's UBT config
 * (`<UE_5.8>/Engine/Config/Windows/Windows_SDK.json`). Where the repo records
 * nothing about a feature's 5.8 status, the 5.7 claim is carried forward
 * CONSERVATIVELY and says so in the text rather than inventing a promotion.
 */

/** The project's default engine version (mirrors `projectStore`'s initial state). */
export const DEFAULT_UE_VERSION = '5.8.0';

export interface EngineFacts {
  /** The `major.minor` key these facts describe, e.g. `'5.8'`. */
  version: string;
  /**
   * Minimum MSVC toolchain family to require in prompts.
   *
   * Ground truth for 5.8, read from the installed engine's
   * `Engine/Config/Windows/Windows_SDK.json`: `MinimumVisualCppVersion` is
   * `14.38.33130`, but `BannedVisualCppVersions` rules out 14.39–14.43 entirely
   * (ICEs / AVX codegen crashes) and `PreferredVisualCppVersions` is
   * `14.44.35207+` (VS 2022 17.14) or `14.50.35717+` (VS 2026 18.0). `14.44` is
   * therefore the lowest family that is both allowed and preferred — the same
   * answer 5.7 gives, now asserted from an explicit 5.8 branch instead of a
   * `minor >= 7` catch-all.
   */
  msvc: string;
  /** Substrate — the single authored Substrate sentence. */
  substrate: string;
  /** Compact inline Substrate hint for a per-surface shading-model line. */
  substrateSlabHint: string;
  /** MegaLights maturity + guidance. */
  megaLights: string;
  /** PCG framework maturity + guidance. */
  pcg: string;
  /** State Tree framing (the Behavior Tree alternative). */
  stateTree: string;
  /** Iris replication framing. */
  iris: string;
  /** Nanite displacement vs the removed legacy tessellation. */
  naniteDisplacement: string;
}

/** Shared across every version we model — the claim itself is version-independent. */
const NANITE_DISPLACEMENT =
  'Enable Tessellation/Displacement: For UE5.4+ use Nanite displacement (production-ready since 5.7). Legacy tessellation (World Displacement + tessellation multiplier) is removed in 5.4+.';

const FACTS_5_8: EngineFacts = {
  version: '5.8',
  msvc: '14.44',
  substrate:
    'Substrate is the production material framework (production-ready since UE 5.7). Prefer a Substrate Slab over the legacy shading models (Default Lit, Subsurface, Cloth) for new materials — Substrate unifies PBR, subsurface, cloth, eye, thin-film, and clearcoat into a single flexible material graph.',
  substrateSlabHint: 'or Substrate Slab — Substrate is production-ready on UE 5.8',
  megaLights:
    'MegaLights is production-ready on 5.8 — prefer it for many dynamic lights without baked lightmaps.',
  pcg:
    'the PCG framework is production-ready for procedural content generation, and 5.8 makes generated PCG results editable in place.',
  stateTree:
    'State Trees (the enhanced Behavior Tree alternative, available since 5.7)',
  iris:
    'Iris replication system (still beta as far as this project has verified — 5.8 records no promotion) replaces UReplicationBridge with the StartActorReplication API.',
  naniteDisplacement: NANITE_DISPLACEMENT,
};

const FACTS_5_7: EngineFacts = {
  version: '5.7',
  msvc: '14.44',
  substrate:
    'Substrate is the production material framework (production-ready as of UE 5.7). Prefer a Substrate Slab over the legacy shading models (Default Lit, Subsurface, Cloth) for new materials — Substrate unifies PBR, subsurface, cloth, eye, thin-film, and clearcoat into a single flexible material graph.',
  substrateSlabHint: 'or Substrate Slab — Substrate is production-ready on UE 5.7',
  megaLights: 'MegaLights (beta on 5.7) for dynamic lighting without baked lightmaps.',
  pcg: 'the PCG framework is production-ready for procedural content generation.',
  stateTree: 'State Trees (the enhanced Behavior Tree alternative, new in 5.7)',
  iris:
    'Iris replication system (beta on 5.7) replaces UReplicationBridge with the StartActorReplication API.',
  naniteDisplacement: NANITE_DISPLACEMENT,
};

/**
 * Facts for UE 5.0–5.6 — before Substrate / PCG / MegaLights shipped as
 * production paths. Deliberately understated: these engines predate every
 * promotion this repo has recorded, so the prompts must not promise them.
 */
function legacyFacts(major: number, minor: number): EngineFacts {
  const version = `${major}.${minor}`;
  return {
    version,
    // Pre-5.7 UBT minimums, unchanged from the original getRequiredMSVCVersion mapping.
    msvc: minor >= 4 ? '14.38' : '14.34',
    substrate: `Substrate is NOT a production path on UE ${version} (it became production-ready in 5.7) — author with the legacy shading models (Default Lit, Subsurface, Cloth).`,
    substrateSlabHint: `legacy shading model — Substrate is not production-ready before 5.7`,
    megaLights: `MegaLights is not available on UE ${version} — use baked lightmaps or standard dynamic lights.`,
    pcg: `the PCG framework is available but not production-ready before 5.7 on UE ${version}.`,
    stateTree: 'Behavior Trees (State Trees are not the recommended path before 5.7)',
    iris: `Iris replication is not an option on UE ${version} — use the standard replication path.`,
    naniteDisplacement:
      minor >= 4
        ? NANITE_DISPLACEMENT
        : 'Enable Tessellation/Displacement: legacy tessellation (World Displacement + tessellation multiplier) is the only path before UE 5.4.',
  };
}

/**
 * Resolve the engine facts for a project's UE version string (`'5.8.0'`,
 * `'5.7'`, …).
 *
 * Throws — rather than silently bucketing — on an unparseable version or a
 * non-UE5 major, exactly like the `getRequiredMSVCVersion` it now backs: a
 * `6.0` input has no known mapping and must fail loudly, not masquerade as the
 * oldest toolchain. A UE5 minor ABOVE the newest modelled version falls through
 * to the newest facts (a 5.9 project gets 5.8 framing, not 5.7 framing).
 */
export function getEngineFacts(ueVersion: string): EngineFacts {
  const [major, minor = 0] = ueVersion.split('.').map(Number);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error(`getEngineFacts: unparseable UE version "${ueVersion}"`);
  }
  if (major !== 5) {
    throw new Error(
      `getEngineFacts: unsupported UE major version "${ueVersion}" — only UE5 engine facts are known.`,
    );
  }
  if (minor >= 8) return FACTS_5_8;
  if (minor === 7) return FACTS_5_7;
  return legacyFacts(major, minor);
}
