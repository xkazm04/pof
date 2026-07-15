'use client';

import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { getAppOrigin } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import type { SubModuleId } from '@/types/modules';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { forgedAbilityToSpec } from '@/lib/ability/forge-adopt';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import { useAbilitySpecStore, useEntityAbilitySpec } from '@/stores/abilitySpecStore';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { SPELLBOOK_ABILITIES, type SpellbookAbility } from '../_shared/data';
import { ACCENT } from './constants';

const SPEC_CATALOG_ID = 'spellbook';
const DEFAULT_ENTITY_ID = 'off-fire-01';

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
  /** True when THIS forged ability is the one persisted on the target entity's spec. */
  isAdopted: boolean;
  adopt: () => Promise<void>;
  generateInUE: () => void;
  isRunning: boolean;
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
  const [entityId, setEntityId] = useState(DEFAULT_ENTITY_ID);
  const [adoptState, setAdoptState] = useState<AdoptState>('idle');
  const [error, setError] = useState<string | null>(null);

  const setSpec = useAbilitySpecStore((s) => s.setSpec);
  const persisted = useEntityAbilitySpec(SPEC_CATALOG_ID, entityId);
  const ability = SPELLBOOK_ABILITIES.find((a) => a.id === entityId);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: 'forge-adopt-gas',
    label: 'Forge → UE',
    accentColor: ACCENT,
  });

  // Honest adopted state: the store's persisted spec carries THIS forge's C++.
  const isAdopted = !!(
    forged &&
    persisted &&
    persisted.provenance?.source === 'forge' &&
    persisted.provenance.className === forged.className
  );

  const adopt = useCallback(async () => {
    if (!forged) return;
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
  }, [forged, entityId, prompt, setSpec]);

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
      },
      getAppOrigin(),
      `Generate in UE — ${forged.displayName}`,
    );
    void cli.execute(task);
  }, [forged, ability, moduleId, entityId, prompt, cli]);

  return {
    entityId, setEntityId, ability, adoptState, error, isAdopted,
    adopt, generateInUE, isRunning: cli.isRunning,
  };
}
