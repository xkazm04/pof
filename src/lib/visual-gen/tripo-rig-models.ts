/**
 * Tripo AUTO-RIG model pin — the rig-side counterpart to `tripo-models.ts`.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 * `tripo-models.ts` was written to eliminate one specific class of defect: sending a
 * generation request with no `model_version` and silently getting the account default,
 * which PoF's own arena graded FAIL. That fix covered MESH generation only. The rig chain
 * had the identical hole and kept it: `scripts/visual-gen/pof_tripo_animate.mjs` built its
 * `animate_rig` body with `rig_type` and `spec` and **no `model_version` at all**.
 *
 * What the unpinned default actually is (read off the auto-rig API docs 2026-09-07):
 *
 *   v1.0-20240301  DEFAULT  — "biped (humanoid) only"; 90+ biped animation presets
 *   v2.5-20260210           — non-humanoid support: quadruped, hexapod, octopod,
 *                             avian, serpentine, aquatic; 11 biped + 5 non-biped presets
 *
 * ── The consequence, which is worse than a missing feature ───────────────────
 * The same chain gained an ANATOMY GATE earlier on 2026-09-07: it calls
 * `animate_prerigcheck` and REFUSES when the detected `rig_type` differs from the one
 * requested, precisely so a biped rigger is never handed a quadruped (see the
 * `creature-rig-not-biped` gotcha). That gate cannot fire while the rig model is
 * unpinned. A biped-ONLY model has no vocabulary for "quadruped", so the prerig check can
 * only ever answer `biped`; the gate then compares `biped` to `biped`, passes, and a human
 * skeleton is fitted to a dog — which is exactly the silent failure it was built to stop.
 * PoF had already recorded the symptom without the cause: `skintokens-rigging-spec.md`
 * notes "`animate_prerigcheck` returns `rig_type:biped` only", and the run that shipped
 * the gate noted its refusal branch was never live-proven. It was asking a model that
 * knows one answer.
 *
 * So the pin here is not a tuning knob. It is what makes an existing safety gate reachable.
 *
 * ── Deliberately NOT changing the biped path ─────────────────────────────────
 * Biped stays on `v1.0-20240301`. PoF's proven end-to-end chain (Jinx → rig → run) ran on
 * it, and v2.5 would trade a 90+ clip library for 11. The fix for biped is that the version
 * is now EXPLICIT instead of inherited — the same distinction `tripoModelFor` draws.
 *
 * Pure data + pure predicates, so the app, a `.ts` script and the `.mjs` executor can all
 * read one source of truth (Node 24 strips types on import, so the `.mjs` imports this
 * file directly rather than duplicating the table).
 */

/** The seven morphologies Tripo's `rig_type` accepts. */
export const TRIPO_RIG_TYPES = [
  'biped',
  'quadruped',
  'hexapod',
  'octopod',
  'avian',
  'serpentine',
  'aquatic',
] as const;

export type TripoRigType = (typeof TRIPO_RIG_TYPES)[number];

/** The rig model the API uses when `model_version` is omitted. Biped-only. */
export const TRIPO_RIG_SILENT_DEFAULT = 'v1.0-20240301';

/** The rig model that supports non-humanoid anatomy. */
export const TRIPO_RIG_MULTI_MORPHOLOGY = 'v2.5-20260210';

export interface TripoRigModel {
  /** True for the version an omitted `model_version` resolves to. */
  isApiDefault: boolean;
  /** Morphologies this model can rig. */
  morphologies: readonly TripoRigType[];
  /**
   * Retarget presets, per morphology.
   *
   * COMPLETE for `v2.5-20260210` — the docs enumerate all 16. **NOT complete** for
   * `v1.0-20240301`, whose biped library is documented as "90+ presets" and is recorded
   * here only for the clips PoF has actually run. {@link validateRigRequest} therefore
   * refuses an unknown preset on v2.5 and permits one on v1.0; a table that is partly a
   * sample must not be used as a whitelist.
   */
  presets: Partial<Record<TripoRigType, readonly string[]>>;
  /** Whether {@link TripoRigModel.presets} enumerates every preset this model offers. */
  presetsComplete: boolean;
  notes: string;
}

export const TRIPO_RIG_MODELS: Record<string, TripoRigModel> = {
  [TRIPO_RIG_SILENT_DEFAULT]: {
    isApiDefault: true,
    morphologies: ['biped'],
    // Recorded from PoF's own proven runs plus the presets the retarget doc names for the
    // v2.5 biped set, which the far larger v1.0 library is a superset of.
    presets: {
      biped: [
        'preset:idle',
        'preset:walk',
        'preset:run',
        'preset:jump',
        'preset:slash',
        'preset:hurt',
        'preset:fall',
        'preset:climb',
        'preset:dive',
        'preset:shoot',
        'preset:turn',
      ],
    },
    presetsComplete: false,
    notes:
      'The API default, and biped-only. An unpinned rig request lands here, which is why a ' +
      'non-humanoid model rigged through this chain returns a human skeleton instead of an ' +
      'error, and why animate_prerigcheck can only ever report rig_type "biped". Documented ' +
      'as carrying 90+ biped presets — far more than the v2.5 biped set — so it remains the ' +
      'right pin for humanoid characters.',
  },
  [TRIPO_RIG_MULTI_MORPHOLOGY]: {
    isApiDefault: false,
    morphologies: TRIPO_RIG_TYPES,
    presets: {
      biped: [
        'preset:idle',
        'preset:walk',
        'preset:run',
        'preset:dive',
        'preset:climb',
        'preset:jump',
        'preset:slash',
        'preset:shoot',
        'preset:hurt',
        'preset:fall',
        'preset:turn',
      ],
      quadruped: ['preset:quadruped:walk'],
      hexapod: ['preset:hexapod:walk'],
      octopod: ['preset:octopod:walk'],
      serpentine: ['preset:serpentine:march'],
      aquatic: ['preset:aquatic:march'],
      // The docs list rig support for `avian` but name no avian preset. Recording it as an
      // empty list would read as "checked, none exist"; leaving the key absent says the
      // same thing without pretending the enumeration covered it. `presetsFor` returns []
      // either way and `validateRigRequest` says so in its reason.
    },
    presetsComplete: true,
    notes:
      'The only rig model with non-humanoid support (quadruped/hexapod/octopod/avian/' +
      'serpentine/aquatic). Its preset library is much smaller than v1.0 — one locomotion ' +
      'clip per non-biped morphology — so a non-humanoid creature is rigged here and then ' +
      'animated from an external clip library or authored motion, not from this preset set.',
  },
};

export interface TripoRigPin {
  modelVersion: string;
  rationale: string;
}

/**
 * The rig model to pin for a morphology.
 *
 * An UNKNOWN rig type resolves to the multi-morphology model, not the default. A stale or
 * mistyped caller asking for something this file does not know about is far more likely to
 * be non-humanoid than humanoid, and the failure modes are not symmetric: the wrong answer
 * here silently fits a human skeleton to a creature.
 */
export function tripoRigModelFor(rigType: TripoRigType): TripoRigPin {
  if (rigType === 'biped') {
    return {
      modelVersion: TRIPO_RIG_SILENT_DEFAULT,
      rationale:
        `biped pins ${TRIPO_RIG_SILENT_DEFAULT} — the same version an unpinned request would ` +
        'have inherited, now stated explicitly, and the one PoF has proven end-to-end. It also ' +
        `carries 90+ biped presets against ${TRIPO_RIG_MULTI_MORPHOLOGY}'s 11.`,
    };
  }
  return {
    modelVersion: TRIPO_RIG_MULTI_MORPHOLOGY,
    rationale:
      `${rigType} pins ${TRIPO_RIG_MULTI_MORPHOLOGY}, the only rig model with non-humanoid ` +
      `support. The API default ${TRIPO_RIG_SILENT_DEFAULT} is biped-only: it would return a ` +
      'human skeleton fitted to the silhouette rather than an error, and animate_prerigcheck ' +
      'would report "biped", defeating the anatomy-mismatch refusal.',
  };
}

/** Retarget presets available for a (model, morphology) pairing. */
export function presetsFor(modelVersion: string, rigType: TripoRigType): readonly string[] {
  return TRIPO_RIG_MODELS[modelVersion]?.presets[rigType] ?? [];
}

export interface RigRequestCheck {
  ok: boolean;
  /** Why the request cannot be sent as written. */
  error?: string;
  /** A real-but-non-blocking observation. */
  warning?: string;
}

/**
 * Check a rig (and optionally retarget) request before spending credits on it.
 *
 * The refusals are the point: each one is a request that would otherwise SUCCEED and
 * return a wrong rig or a wrong clip, which costs credits and produces an asset whose
 * defect only surfaces once something plays it.
 */
export function validateRigRequest(request: {
  rigType: TripoRigType;
  /** Omitted means the API default — which is itself the defect for a non-biped. */
  modelVersion?: string;
  animation?: string;
}): RigRequestCheck {
  const { rigType, animation } = request;
  const pinned = request.modelVersion;
  const effective = pinned ?? TRIPO_RIG_SILENT_DEFAULT;
  const model = TRIPO_RIG_MODELS[effective];

  if (!model) {
    return {
      ok: false,
      error:
        `unknown rig model_version "${effective}" — known versions are ` +
        `${Object.keys(TRIPO_RIG_MODELS).join(', ')}. Pin a known one rather than sending an ` +
        'unrecognized string, which the API resolves however it likes.',
    };
  }

  if (!model.morphologies.includes(rigType)) {
    const fix = tripoRigModelFor(rigType);
    return {
      ok: false,
      error:
        (pinned
          ? `rig model ${effective} cannot rig a ${rigType}: it supports ${model.morphologies.join(', ')} only.`
          : `no model_version was pinned, so this request would use the API default ${effective}, ` +
            `which supports ${model.morphologies.join(', ')} only and cannot rig a ${rigType}.`) +
        ` Send model_version ${fix.modelVersion}. This does NOT fail loudly on its own — a ` +
        'biped-only rigger returns a human skeleton fitted to the silhouette, and ' +
        'animate_prerigcheck reports "biped", so the anatomy-mismatch refusal never fires.',
    };
  }

  if (animation) {
    const available = presetsFor(effective, rigType);
    const known = available.includes(animation);
    if (!known && model.presetsComplete) {
      return {
        ok: false,
        error:
          `"${animation}" is not a ${rigType} preset on ${effective}. Available: ` +
          `${available.length ? available.join(', ') : `none documented for ${rigType} — animate it from an external clip library or authored motion instead`}.`,
      };
    }
    if (!known && !model.presetsComplete) {
      return {
        ok: true,
        warning:
          `"${animation}" is not in this repo's recorded preset list for ${effective}, but that ` +
          'list is a sample of a documented 90+ library, not a whitelist — sending it unchecked.',
      };
    }
  }

  if (!pinned) {
    return {
      ok: true,
      warning:
        `no model_version pinned; this request inherits the API default ${effective}. That is ` +
        'the right model for a biped, but pin it explicitly so the choice survives a change to ' +
        'the account default — the exact failure tripo-models.ts exists to prevent on the mesh side.',
    };
  }

  return { ok: true };
}
