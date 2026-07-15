'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { getAppOrigin } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import type { SubModuleId } from '@/types/modules';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import { useAbilitySpecStore } from '@/stores/abilitySpecStore';
import { SPELLBOOK_ABILITIES, type SpellbookAbility } from '../_shared/data';
import { ACCENT } from './data';

/** The blueprint editor authors specs against the spellbook catalog. */
export const SPEC_CATALOG_ID = 'spellbook';
const DEFAULT_ENTITY_ID = 'off-fire-01'; // Fireball — the reference ability.

export type SpecSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** SpellbookAbility → AbilityRef (the thin identity the CLI tasks need). */
function toAbilityRef(a: SpellbookAbility): AbilityRef {
  return { name: a.name, element: a.element, tag: a.tag, category: a.category, tier: a.tier };
}

interface Args {
  moduleId: SubModuleId;
  /** Current editor effects/tagRules (the fields an EnrichedAbilitySpec persists). */
  effects: EditorEffect[];
  tagRules: TagRule[];
  /** Push a loaded/seeded spec's effects+tagRules into editor state. */
  onHydrate: (effects: EditorEffect[], tagRules: TagRule[]) => void;
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
  generateEffects: () => void;
  isRunning: boolean;
}

/**
 * Binds the GAS Blueprint Editor to a per-entity {@link EnrichedAbilitySpec}.
 *
 * On entity open it GETs /api/ability-spec; an existing record hydrates the
 * editor's effects/tagRules, an empty DB seeds them from {@link deriveDefaultSpec}
 * so the editor is never blank. `save` persists the current effects/tagRules back
 * (tryApiFetch envelope + optimistic store write). `draftSpec` / `generateEffects`
 * dispatch the EXISTING TaskFactory CLI tasks via useModuleCLI — no bespoke
 * prompt plumbing here.
 */
export function useAbilitySpecBinding({ moduleId, effects, tagRules, onHydrate }: Args): SpecBinding {
  const [entityId, setEntityId] = useState(DEFAULT_ENTITY_ID);
  const [hydrating, setHydrating] = useState(false);
  const [saveState, setSaveState] = useState<SpecSaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadSpec = useAbilitySpecStore((s) => s.loadSpec);
  const setSpec = useAbilitySpecStore((s) => s.setSpec);

  const ability = SPELLBOOK_ABILITIES.find((a) => a.id === entityId);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: 'gas-blueprint-spec',
    label: 'GAS Spec',
    accentColor: ACCENT,
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
          onHydrateRef.current(res.data.effects, res.data.tagRules);
        } else {
          // Empty DB → deriveDefaultSpec seed so the editor is never blank.
          loadSpec(SPEC_CATALOG_ID, entityId, null);
          if (ab) {
            const seed = deriveDefaultSpec(SPEC_CATALOG_ID, ab);
            onHydrateRef.current(seed.effects, seed.tagRules);
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

  const save = useCallback(async () => {
    const record: EnrichedAbilitySpec = { catalogId: SPEC_CATALOG_ID, entityId, effects, tagRules };
    setSaveState('saving');
    setError(null);
    const res = await tryApiFetch<EnrichedAbilitySpec>('/api/ability-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      setSpec(SPEC_CATALOG_ID, entityId, res.data);
      setSaveState('saved');
    } else {
      setError(res.error);
      setSaveState('error');
      logger.warn('[ability-spec] save failed:', res.error);
    }
  }, [entityId, effects, tagRules, setSpec]);

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

  const generateEffects = useCallback(() => {
    if (!ability) return;
    const task = TaskFactory.generateGasEffects(
      moduleId,
      {
        ref: toAbilityRef(ability),
        effects,
        tagRules,
        scalars: { manaCost: ability.manaCost, cooldown: ability.cooldown, damage: ability.damage },
      },
      getAppOrigin(),
      `Generate GAS effects — ${ability.name}`,
    );
    void cli.execute(task);
  }, [ability, moduleId, effects, tagRules, cli]);

  return {
    entityId, setEntityId, ability, hydrating, saveState, error,
    save, draftSpec, generateEffects, isRunning: cli.isRunning,
  };
}
