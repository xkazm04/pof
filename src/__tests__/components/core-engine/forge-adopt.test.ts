import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { useForgeAdopt } from '@/components/modules/core-engine/sub_ability/forge/useForgeAdopt';
import { useAbilitySpecStore, specKey } from '@/stores/abilitySpecStore';

function envelope<T>(data: T) {
  return { json: async () => ({ success: true, data }) } as Response;
}

const forged: ForgedAbility = {
  className: 'GA_Fireball',
  displayName: 'Fireball',
  description: 'Hurl a ball of fire',
  headerCode: '// header',
  cppCode: '// cpp',
  tags: { abilityTag: 'Ability.Fire.Fireball', cooldownTag: 'Cooldown.Fireball', ownedTags: ['State.Casting'], blockedTags: ['State.Dead'] },
  stats: { baseDamage: 35, manaCost: 20, cooldownSec: 3, damageType: 'Fire' },
  comboEntry: { animDuration: 1.2, damageWindow: [0.3, 0.6], recovery: 0.3, comboMultiplier: 1 },
  radarValues: [0.7, 0.85, 0.3, 0.5, 0.5],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  execute.mockReset();
  useAbilitySpecStore.setState({ specByEntity: {} });
});
beforeEach(() => useAbilitySpecStore.setState({ specByEntity: {} }));

describe('useForgeAdopt — adopt persistence', () => {
  it('adopt POSTs the mapped spec (with provenance) and marks adopted honestly', async () => {
    const returned: EnrichedAbilitySpec = {
      catalogId: 'spellbook', entityId: 'off-fire-01',
      effects: [], tagRules: [],
      provenance: { source: 'forge', className: 'GA_Fireball', displayName: 'Fireball', damageType: 'Fire', headerCode: '// header', cppCode: '// cpp' },
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => envelope<EnrichedAbilitySpec>(returned));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useForgeAdopt('arpg-gas', forged, 'a fireball'));

    // No fake success before the POST resolves.
    expect(result.current.isAdopted).toBe(false);

    await act(async () => { await result.current.adopt(); });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ability-spec');
    expect(init!.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ catalogId: 'spellbook', entityId: 'off-fire-01' });
    expect(body.provenance).toMatchObject({ source: 'forge', className: 'GA_Fireball', cppCode: '// cpp', prompt: 'a fireball' });

    expect(result.current.adoptState).toBe('adopted');
    // Badge tied to the persisted store spec's provenance, not a local flag.
    expect(result.current.isAdopted).toBe(true);
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toEqual(returned);
  });
});

describe('useForgeAdopt — Generate in UE dispatch', () => {
  it('generateInUE dispatches the existing generate-gas-effects task with forged scalars', () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec>({ catalogId: 'spellbook', entityId: 'off-fire-01', effects: [], tagRules: [] })));
    const { result } = renderHook(() => useForgeAdopt('arpg-gas', forged, 'a fireball'));

    act(() => result.current.generateInUE());

    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('generate-gas-effects');
    expect(task.ref.name).toBe('Fireball');
    // Mapped effects carry the forged damage; scalars mirror the forge stats.
    expect(task.effects[0].modifiers[0]).toMatchObject({ attribute: 'Health', magnitude: -35 });
    expect(task.scalars).toMatchObject({ damage: 35, manaCost: 20, cooldown: 3 });
  });

  it('no-ops when there is no forged ability', () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(null)));
    const { result } = renderHook(() => useForgeAdopt('arpg-gas', null, null));
    act(() => result.current.generateInUE());
    expect(execute).not.toHaveBeenCalled();
  });
});
