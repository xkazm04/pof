'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { getAppOrigin } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import type { SubModuleId } from '@/types/modules';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { EditorEffect } from '@/lib/gas-codegen';
import {
  preflightGenerate, applyPreflightFix, applyAllPreflightFixes,
  type GeneratePreflight, type PreflightFix,
} from '@/lib/ability/generate-preflight';
import type { EditorState } from './types';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import { useAbilitySpecStore } from '@/stores/abilitySpecStore';
import { SPELLBOOK_ABILITIES, type SpellbookAbility } from '../_shared/data';
import { useCodegenStatus, type CodegenStatus } from '../_shared/useCodegenStatus';
import { ACCENT } from './data';

/** The blueprint editor authors specs against the spellbook catalog. */
export const SPEC_CATALOG_ID = 'spellbook';
const DEFAULT_ENTITY_ID = 'off-fire-01'; // Fireball — the reference ability.

export type SpecSaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Persisted spec → the editor slices it actually carries. Slices a legacy row
 * never stored stay absent so the editor keeps its own seed instead of being
 * blanked. Pure (exported for unit test).
 */
export function specToSlices(spec: EnrichedAbilitySpec): Partial<EditorState> {
  return {
    effects: spec.effects,
    tagRules: spec.tagRules,
    ...(spec.attributes ? { attributes: spec.attributes } : {}),
    ...(spec.relationships ? { relationships: spec.relationships } : {}),
    ...(spec.loadout ? { loadout: spec.loadout } : {}),
  };
}

/** SpellbookAbility → AbilityRef (the thin identity the CLI tasks need). */
function toAbilityRef(a: SpellbookAbility): AbilityRef {
  return { name: a.name, element: a.element, tag: a.tag, category: a.category, tier: a.tier };
}

interface Args {
  moduleId: SubModuleId;
  /** All five current editor slices — every one of them is persisted. */
  state: EditorState;
  /**
   * Push a loaded/seeded spec into editor state. Only the slices the spec
   * actually carries are provided; the editor keeps its own seed for the rest
   * (legacy rows predate the attributes/relationships/loadout columns).
   */
  onHydrate: (slices: Partial<EditorState>) => void;
}

export interface SpecBinding {
  entityId: string;
  setEntityId: (id: string) => void;
  ability: SpellbookAbility | undefined;
  hydrating: boolean;
  saveState: SpecSaveState;
  error: string | null;
  save: () => Promise<void>;
  draftSpec: () => void;
  /** Dispatch the generate run immediately (no preflight). */
  generateEffects: () => void;
  /**
   * The "Generate GAS effects" click: a clean spec dispatches at once; otherwise
   * the run is held and {@link preflight} lists what it would override/TODO.
   */
  reviewGenerate: () => void;
  /** Live preflight of the CURRENT editor state while a review is open, else null. */
  preflight: GeneratePreflight | null;
  /** Dispatch the held run — with every one-click fix applied to the editor first, or as-is. Never when blocked. */
  confirmGenerate: (opts: { applyFixes: boolean }) => void;
  /** Close the review without dispatching. */
  dismissPreflight: () => void;
  /** Apply one finding's fix to the editor (the review stays open and re-derives). */
  applyFix: (fix: PreflightFix) => void;
  isRunning: boolean;
  /** Reported outcome of the last "Generate GAS effects" run (dispatched → confirmed/failed). */
  codegen: CodegenStatus;
}

/**
 * Binds the GAS Blueprint Editor to a per-entity {@link EnrichedAbilitySpec}.
 *
 * On entity open it GETs /api/ability-spec; an existing record hydrates every
 * editor slice it carries, an empty DB seeds effects/tagRules from
 * {@link deriveDefaultSpec} so the editor is never blank. `save` persists all
 * five slices back (tryApiFetch envelope + optimistic store write).
 * `draftSpec` / `generateEffects` dispatch the EXISTING TaskFactory CLI tasks
 * via useModuleCLI — no bespoke prompt plumbing here.
 *
 * `saveState` is derived, not sticky: the "Spec saved" confirmation reverts to
 * `idle` the moment any slice differs from what was actually persisted, so a
 * stale green check can never imply unsaved edits are safe.
 */
export function useAbilitySpecBinding({ moduleId, state, onHydrate }: Args): SpecBinding {
  const { attributes, relationships, effects, tagRules, loadout } = state;
  const [entityId, setEntityId] = useState(DEFAULT_ENTITY_ID);
  const [hydrating, setHydrating] = useState(false);
  const [saveState, setSaveState] = useState<SpecSaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadSpec = useAbilitySpecStore((s) => s.loadSpec);
  const setSpec = useAbilitySpecStore((s) => s.setSpec);

  const ability = SPELLBOOK_ABILITIES.find((a) => a.id === entityId);

  const codegen = useCodegenStatus(SPEC_CATALOG_ID, entityId);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: 'gas-blueprint-spec',
    label: 'GAS Spec',
    accentColor: ACCENT,
    onComplete: codegen.onCliComplete,
  });

  // onHydrate identity must not re-trigger the fetch — hold it in a ref.
  const onHydrateRef = useRef(onHydrate);
  useEffect(() => { onHydrateRef.current = onHydrate; }, [onHydrate]);

  // Hydrate on entity open. One-shot fetch (not polling) keyed on entityId.
  // All setState lives inside the async runner (never synchronously in the
  // effect body) per react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    const ab = SPELLBOOK_ABILITIES.find((a) => a.id === entityId);
    const run = async () => {
      setHydrating(true);
      setError(null);
      const res = await tryApiFetch<EnrichedAbilitySpec | null>(
        `/api/ability-spec?catalogId=${SPEC_CATALOG_ID}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (cancelled) return;
      if (res.ok) {
        if (res.data) {
          loadSpec(SPEC_CATALOG_ID, entityId, res.data);
          onHydrateRef.current(specToSlices(res.data));
        } else {
          // Empty DB → deriveDefaultSpec seed so the editor is never blank.
          loadSpec(SPEC_CATALOG_ID, entityId, null);
          if (ab) {
            const seed = deriveDefaultSpec(SPEC_CATALOG_ID, ab);
            onHydrateRef.current(specToSlices(seed));
          }
        }
      } else {
        setError(res.error);
      }
      setHydrating(false);
    };
    void run();
    return () => { cancelled = true; };
  }, [entityId, loadSpec]);

  // Signature of the editor's current five slices. Comparing it against the
  // signature captured at the last successful save is a PURE way to expire the
  // "saved" confirmation on the next edit (no setState-in-effect).
  const stateSig = useMemo(
    () => JSON.stringify([attributes, relationships, effects, tagRules, loadout]),
    [attributes, relationships, effects, tagRules, loadout],
  );
  const [savedSig, setSavedSig] = useState<string | null>(null);

  const save = useCallback(async () => {
    // Never save mid-hydration — the editor still holds the previous entity's
    // slices and would overwrite the row we are in the middle of loading.
    if (hydrating) return;
    // Carry forward any adoption provenance the entity already holds — a manual
    // slice tweak must not silently wipe the forged-C++ audit trail.
    // (Provenance is only ever replaced by a new Adopt, never by Save.)
    const existing = useAbilitySpecStore.getState().getSpec(SPEC_CATALOG_ID, entityId);
    const record: EnrichedAbilitySpec = {
      catalogId: SPEC_CATALOG_ID, entityId,
      effects, tagRules, attributes, relationships, loadout,
      ...(existing?.provenance ? { provenance: existing.provenance } : {}),
    };
    const sigAtSave = stateSig;
    setSaveState('saving');
    setError(null);
    const res = await tryApiFetch<EnrichedAbilitySpec>('/api/ability-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      setSpec(SPEC_CATALOG_ID, entityId, res.data);
      setSavedSig(sigAtSave);
      setSaveState('saved');
    } else {
      setError(res.error);
      setSaveState('error');
      logger.warn('[ability-spec] save failed:', res.error);
    }
  }, [hydrating, entityId, effects, tagRules, attributes, relationships, loadout, stateSig, setSpec]);

  // Derived: a later edit (or a new entity's hydration) invalidates "saved".
  const effectiveSaveState: SpecSaveState =
    saveState === 'saved' && savedSig !== stateSig ? 'idle' : saveState;

  const draftSpec = useCallback(() => {
    if (!ability) return;
    const task = TaskFactory.draftAbilitySpec(
      moduleId,
      { catalogId: SPEC_CATALOG_ID, entityId, ref: toAbilityRef(ability) },
      getAppOrigin(),
      `Draft ${ability.name} spec`,
    );
    void cli.execute(task);
  }, [ability, moduleId, entityId, cli]);

  const scalars = useMemo(
    () => (ability ? { manaCost: ability.manaCost, cooldown: ability.cooldown, damage: ability.damage } : undefined),
    [ability],
  );

  const dispatchGenerate = useCallback((effs: EditorEffect[]) => {
    if (!ability) return;
    const task = TaskFactory.generateGasEffects(
      moduleId,
      { ref: toAbilityRef(ability), effects: effs, tagRules, scalars, catalogId: SPEC_CATALOG_ID, entityId },
      getAppOrigin(),
      `Generate GAS effects — ${ability.name}`,
    );
    codegen.markDispatched();
    void cli.execute(task);
  }, [ability, moduleId, entityId, tagRules, scalars, cli, codegen]);

  const generateEffects = useCallback(() => dispatchGenerate(effects), [dispatchGenerate, effects]);

  // The review is keyed to the entity it was opened for, so switching ability
  // closes it; the findings themselves are DERIVED from the live editor state,
  // so a per-finding Fix (via onHydrate) re-derives the list with no sync step.
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const preflight = useMemo(
    () => (reviewFor === entityId ? preflightGenerate({ scalars, effects, attributes }) : null),
    [reviewFor, entityId, scalars, effects, attributes],
  );

  const reviewGenerate = useCallback(() => {
    if (!ability) return;
    if (preflightGenerate({ scalars, effects, attributes }).findings.length === 0) {
      setReviewFor(null);
      dispatchGenerate(effects);
      return;
    }
    setReviewFor(entityId);
  }, [ability, scalars, effects, attributes, entityId, dispatchGenerate]);

  const confirmGenerate = useCallback(({ applyFixes }: { applyFixes: boolean }) => {
    const pf = preflightGenerate({ scalars, effects, attributes });
    if (!pf.canGenerate) return;
    setReviewFor(null);
    if (!applyFixes) { dispatchGenerate(effects); return; }
    const fixed = applyAllPreflightFixes({ effects, attributes }, pf.findings);
    const patch = {
      ...(fixed.effects !== effects ? { effects: fixed.effects } : {}),
      ...(fixed.attributes !== attributes ? { attributes: fixed.attributes } : {}),
    };
    if (Object.keys(patch).length) onHydrateRef.current(patch);
    dispatchGenerate(fixed.effects);
  }, [scalars, effects, attributes, dispatchGenerate]);

  const dismissPreflight = useCallback(() => setReviewFor(null), []);

  const applyFix = useCallback((fix: PreflightFix) => {
    const fixed = applyPreflightFix({ effects, attributes }, fix);
    onHydrateRef.current({ effects: fixed.effects, attributes: fixed.attributes });
  }, [effects, attributes]);

  return {
    entityId, setEntityId, ability, hydrating, saveState: effectiveSaveState, error,
    save, draftSpec, generateEffects, reviewGenerate, preflight, confirmGenerate, dismissPreflight, applyFix,
    isRunning: cli.isRunning, codegen,
  };
}
