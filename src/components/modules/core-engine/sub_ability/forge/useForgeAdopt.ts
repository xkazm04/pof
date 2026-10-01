'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { getAppOrigin } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import type { SubModuleId } from '@/types/modules';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { forgedAbilityToSpec } from '@/lib/ability/forge-adopt';
import { previewAdopt, suggestAdoptTargets, type AdoptPreview, type AdoptSuggestion } from '@/lib/ability/adopt-preview';
import type { Result } from '@/types/result';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import { useAbilitySpecStore, useEntityAbilitySpec } from '@/stores/abilitySpecStore';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { SPELLBOOK_ABILITIES, type SpellbookAbility } from '../_shared/data';
import { useCodegenStatus, type CodegenStatus } from '../_shared/useCodegenStatus';
import { ACCENT } from './constants';

const SPEC_CATALOG_ID = 'spellbook';
/** Target when there is no forge result to rank against. */
const FALLBACK_ENTITY_ID = 'off-fire-01';

export type AdoptState = 'idle' | 'adopting' | 'adopted' | 'error';

function toAbilityRef(a: SpellbookAbility): AbilityRef {
  return { name: a.name, element: a.element, tag: a.tag, category: a.category, tier: a.tier };
}

export interface ForgeAdoptBinding {
  entityId: string;
  setEntityId: (id: string) => void;
  ability: SpellbookAbility | undefined;
  adoptState: AdoptState;
  error: string | null;
  /** Ranked targets for the current forge (element match, then nearest radar). */
  suggestions: AdoptSuggestion[];
  /** What adopting into the target replaces (null without a forge result). */
  preview: AdoptPreview | null;
  /** Why the target's stored spec could not be read (preview stays `unloaded`). */
  targetReadError: string | null;
  /** True when THIS forged ability is the one persisted on the target entity's spec. */
  isAdopted: boolean;
  /** Persist now (the confirmed operation) — the Result keeps a confirm dialog open on failure. */
  adopt: () => Promise<Result<EnrichedAbilitySpec, string>>;
  /** Adopt button: writes at once when nothing real is replaced, else opens the confirmation. */
  requestAdopt: () => void;
  confirmOpen: boolean;
  cancelAdopt: () => void;
  generateInUE: () => void;
  isRunning: boolean;
  /** Reported outcome of the last "Generate in UE" run (dispatched → confirmed/failed). */
  codegen: CodegenStatus;
}

/**
 * Closes the forge→spec loop: adopt a {@link ForgedAbility} into the target
 * entity's {@link EnrichedAbilitySpec} (pure map → POST /api/ability-spec, with
 * the raw C++ + prompt as provenance), and optionally dispatch the existing
 * generateGasEffects CLI task to materialize it in UE. The adopted badge is tied
 * to the persisted store spec's provenance — never a fake local success.
 */
export function useForgeAdopt(
  moduleId: SubModuleId,
  forged: ForgedAbility | null,
  prompt: string | null,
): ForgeAdoptBinding {
  const suggestions = useMemo(
    () => (forged
      ? suggestAdoptTargets({ damageType: forged.stats.damageType, radarValues: forged.radarValues }, SPELLBOOK_ABILITIES)
      : []),
    [forged],
  );
  // The top suggestion is the target for each NEW forge result; a manual pick
  // sticks only for the result it was made on (derived, no reset effect).
  const [manualPick, setManualPick] = useState<{ forged: ForgedAbility | null; id: string } | null>(null);
  const entityId = manualPick && manualPick.forged === forged
    ? manualPick.id
    : (suggestions[0]?.id ?? FALLBACK_ENTITY_ID);
  const setEntityId = useCallback((id: string) => setManualPick({ forged, id }), [forged]);

  const [adoptState, setAdoptState] = useState<AdoptState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [readFailure, setReadFailure] = useState<{ entityId: string; error: string } | null>(null);
  const targetReadError = readFailure?.entityId === entityId ? readFailure.error : null;

  const setSpec = useAbilitySpecStore((s) => s.setSpec);
  const loadSpec = useAbilitySpecStore((s) => s.loadSpec);
  const persisted = useEntityAbilitySpec(SPEC_CATALOG_ID, entityId);
  const loaded = persisted !== undefined;

  // Read the target's stored spec once per target (the store may never have
  // seen it — the blueprint loads only the entity it opens, and a reload
  // empties it). setState only inside the async runner.
  useEffect(() => {
    if (!forged || loaded) return;
    let cancelled = false;
    void (async () => {
      const res = await tryApiFetch<EnrichedAbilitySpec | null>(
        `/api/ability-spec?catalogId=${SPEC_CATALOG_ID}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (cancelled) return;
      if (res.ok) loadSpec(SPEC_CATALOG_ID, entityId, res.data ?? null);
      else {
        setReadFailure({ entityId, error: res.error });
        logger.warn('[forge-adopt] target spec read failed:', res.error);
      }
    })();
    return () => { cancelled = true; };
  }, [forged, entityId, loaded, loadSpec]);

  const preview = useMemo(
    () => (forged ? previewAdopt(persisted, forgedAbilityToSpec(SPEC_CATALOG_ID, entityId, forged, prompt ?? undefined)) : null),
    [forged, persisted, entityId, prompt],
  );
  const ability = SPELLBOOK_ABILITIES.find((a) => a.id === entityId);

  const codegen = useCodegenStatus(SPEC_CATALOG_ID, entityId);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: 'forge-adopt-gas',
    label: 'Forge → UE',
    accentColor: ACCENT,
    onComplete: codegen.onCliComplete,
  });

  // Honest adopted state: the store's persisted spec carries THIS forge's C++.
  const isAdopted = !!(
    forged &&
    persisted &&
    persisted.provenance?.source === 'forge' &&
    persisted.provenance.className === forged.className
  );

  const adopt = useCallback(async (): Promise<Result<EnrichedAbilitySpec, string>> => {
    if (!forged) return { ok: false, error: 'No forged ability to adopt.' };
    const record = forgedAbilityToSpec(SPEC_CATALOG_ID, entityId, forged, prompt ?? undefined);
    setAdoptState('adopting');
    setError(null);
    const res = await tryApiFetch<EnrichedAbilitySpec>('/api/ability-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      setSpec(SPEC_CATALOG_ID, entityId, res.data);
      setAdoptState('adopted');
    } else {
      setError(res.error);
      setAdoptState('error');
      logger.warn('[forge-adopt] adopt failed:', res.error);
    }
    return res;
  }, [forged, entityId, prompt, setSpec]);

  const requestAdopt = useCallback(() => {
    if (!forged) return;
    if (preview?.needsConfirm) setConfirmOpen(true);
    else void adopt();
  }, [forged, preview, adopt]);
  const cancelAdopt = useCallback(() => setConfirmOpen(false), []);

  const generateInUE = useCallback(() => {
    if (!forged || !ability) return;
    const spec = forgedAbilityToSpec(SPEC_CATALOG_ID, entityId, forged, prompt ?? undefined);
    const task = TaskFactory.generateGasEffects(
      moduleId,
      {
        ref: toAbilityRef(ability),
        effects: spec.effects,
        tagRules: spec.tagRules,
        scalars: {
          manaCost: forged.stats.manaCost,
          cooldown: forged.stats.cooldownSec,
          damage: forged.stats.baseDamage,
        },
        catalogId: SPEC_CATALOG_ID,
        entityId,
      },
      getAppOrigin(),
      `Generate in UE — ${forged.displayName}`,
    );
    codegen.markDispatched();
    void cli.execute(task);
  }, [forged, ability, moduleId, entityId, prompt, cli, codegen]);

  return {
    entityId, setEntityId, ability, suggestions, preview, targetReadError, adoptState, error, isAdopted,
    adopt, requestAdopt, confirmOpen, cancelAdopt, generateInUE, isRunning: cli.isRunning, codegen,
  };
}
