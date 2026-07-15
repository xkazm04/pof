import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

// Capture what the blueprint editor dispatches to the CLI without spinning up a
// real terminal session.
const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { useAbilitySpecBinding } from '@/components/modules/core-engine/sub_ability/blueprint/useAbilitySpecBinding';
import { useAbilitySpecStore, specKey } from '@/stores/abilitySpecStore';

/** Envelope-shaped fetch response. */
function envelope<T>(data: T, success = true, error = '') {
  return { json: async () => (success ? { success: true, data } : { success: false, error }) } as Response;
}

const effects: EditorEffect[] = [
  { id: 'e1', name: 'GE_Test', duration: 'instant', durationSec: 0, cooldownSec: 0, color: '#ffffff', modifiers: [], grantedTags: [] },
];
const tagRules: TagRule[] = [
  { id: 't1', sourceTag: 'Ability.X', targetTag: 'State.Dead', type: 'blocks' },
];

const onHydrate = vi.fn();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  execute.mockReset();
  onHydrate.mockReset();
  useAbilitySpecStore.setState({ specByEntity: {} });
});

beforeEach(() => {
  useAbilitySpecStore.setState({ specByEntity: {} });
});

describe('useAbilitySpecBinding — hydrate', () => {
  it('empty DB → seeds effects/tagRules from deriveDefaultSpec (Fireball default)', async () => {
    // GET returns data:null (no persisted spec).
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(null)));

    const { result } = renderHook(() =>
      useAbilitySpecBinding({ moduleId: 'arpg-gas', effects, tagRules, onHydrate }),
    );

    await waitFor(() => expect(result.current.hydrating).toBe(false));
    // deriveDefaultSpec(Fireball) → one primary effect + two block rules.
    expect(onHydrate).toHaveBeenCalledTimes(1);
    const [seedEffects, seedRules] = onHydrate.mock.calls[0];
    expect(seedEffects.length).toBe(1);
    expect(seedRules.length).toBe(2);
    // Store records the load-but-none.
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toBeNull();
  });

  it('existing spec → hydrates its effects/tagRules verbatim', async () => {
    const persisted: EnrichedAbilitySpec = { catalogId: 'spellbook', entityId: 'off-fire-01', effects, tagRules };
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(persisted)));

    const { result } = renderHook(() =>
      useAbilitySpecBinding({ moduleId: 'arpg-gas', effects: [], tagRules: [], onHydrate }),
    );

    await waitFor(() => expect(result.current.hydrating).toBe(false));
    expect(onHydrate).toHaveBeenCalledWith(effects, tagRules);
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toEqual(persisted);
  });
});

describe('useAbilitySpecBinding — save round-trip', () => {
  it('POSTs the current effects/tagRules and writes the returned spec to the store', async () => {
    const saved: EnrichedAbilitySpec = { catalogId: 'spellbook', entityId: 'off-fire-01', effects, tagRules, updatedAt: 'now' };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? envelope<EnrichedAbilitySpec>(saved)
        : envelope<EnrichedAbilitySpec | null>(null),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useAbilitySpecBinding({ moduleId: 'arpg-gas', effects, tagRules, onHydrate }),
    );
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    await act(async () => { await result.current.save(); });

    const postCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(postCall![0]).toBe('/api/ability-spec');
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ catalogId: 'spellbook', entityId: 'off-fire-01', effects, tagRules });
    expect(result.current.saveState).toBe('saved');
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toEqual(saved);
  });
});

describe('useAbilitySpecBinding — CLI dispatch wiring', () => {
  it('draftSpec dispatches the existing draft-ability-spec task', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(null)));
    const { result } = renderHook(() =>
      useAbilitySpecBinding({ moduleId: 'arpg-gas', effects, tagRules, onHydrate }),
    );
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.draftSpec());

    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('draft-ability-spec');
    expect(task.catalogId).toBe('spellbook');
    expect(task.entityId).toBe('off-fire-01');
    expect(task.ref.name).toBe('Fireball');
  });

  it('generateEffects dispatches the existing generate-gas-effects task with scalars', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(null)));
    const { result } = renderHook(() =>
      useAbilitySpecBinding({ moduleId: 'arpg-gas', effects, tagRules, onHydrate }),
    );
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.generateEffects());

    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('generate-gas-effects');
    expect(task.ref.name).toBe('Fireball');
    expect(task.effects).toEqual(effects);
    expect(task.tagRules).toEqual(tagRules);
    // Fireball scalars: damage 35, manaCost 20, cooldown 3.
    expect(task.scalars).toMatchObject({ damage: 35, manaCost: 20, cooldown: 3 });
  });
});
