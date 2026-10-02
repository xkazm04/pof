import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import type { EnrichedAbilitySpec, SpecProvenance } from '@/lib/ability/spec';
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

/** fetch mock that answers GET (target spec read) and POST (adopt) separately. */
function routedFetch(getData: EnrichedAbilitySpec | null, postData?: EnrichedAbilitySpec) {
  return vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? envelope(postData ?? null) : envelope(getData));
}

function postCalls(fetchMock: ReturnType<typeof routedFetch>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
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

const iceForged: ForgedAbility = {
  ...forged,
  className: 'GA_IceLance',
  displayName: 'Ice Lance',
  tags: { abilityTag: 'Ability.Ice.Lance', cooldownTag: 'Cooldown.IceLance', ownedTags: [], blockedTags: ['State.Dead'] },
  stats: { baseDamage: 30, manaCost: 15, cooldownSec: 2, damageType: 'Ice' },
  radarValues: [0.55, 0.8, 0.1, 0.7, 0.65],
};

const prov = (className: string): SpecProvenance =>
  ({ source: 'forge', className, displayName: className, damageType: 'Ice', headerCode: '', cppCode: '' });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  execute.mockReset();
  useAbilitySpecStore.setState({ specByEntity: {} });
});
beforeEach(() => useAbilitySpecStore.setState({ specByEntity: {} }));

describe('useForgeAdopt — adopt persistence', () => {
  it('[guard] Fireball-shaped forge keeps target off-fire-01; adopt POSTs the mapped spec and marks adopted honestly', async () => {
    const returned: EnrichedAbilitySpec = {
      catalogId: 'spellbook', entityId: 'off-fire-01',
      effects: [], tagRules: [],
      provenance: { source: 'forge', className: 'GA_Fireball', displayName: 'Fireball', damageType: 'Fire', headerCode: '// header', cppCode: '// cpp' },
    };
    const fetchMock = routedFetch(null, returned);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useForgeAdopt('arpg-gas', forged, 'a fireball'));
    expect(result.current.entityId).toBe('off-fire-01');

    // No fake success before the POST resolves (the target GET found no spec).
    await waitFor(() => expect(result.current.preview?.status).toBe('fresh'));
    expect(result.current.isAdopted).toBe(false);

    await act(async () => { await result.current.adopt(); });

    const posts = postCalls(fetchMock);
    expect(posts).toHaveLength(1);
    const [url, init] = posts[0];
    expect(url).toBe('/api/ability-spec');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ catalogId: 'spellbook', entityId: 'off-fire-01' });
    expect(body.provenance).toMatchObject({ source: 'forge', className: 'GA_Fireball', cppCode: '// cpp', prompt: 'a fireball' });

    expect(result.current.adoptState).toBe('adopted');
    // Badge tied to the persisted store spec's provenance, not a local flag.
    expect(result.current.isAdopted).toBe(true);
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toEqual(returned);
  });

  it('an Ice forge GETs its suggested target first and reads Adopted from the persisted spec without adopting', async () => {
    const stored: EnrichedAbilitySpec = {
      catalogId: 'spellbook', entityId: 'off-ice-01', effects: [], tagRules: [], provenance: prov('GA_IceLance'),
    };
    const fetchMock = routedFetch(stored);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useForgeAdopt('arpg-gas', iceForged, 'p'));
    expect(result.current.entityId).toBe('off-ice-01');
    expect(result.current.suggestions.map((s) => s.id)[0]).toBe('off-ice-01');

    await waitFor(() => expect(result.current.isAdopted).toBe(true));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ability-spec?catalogId=spellbook&entityId=off-ice-01');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('requestAdopt over a spec it would replace opens the confirmation and writes only on confirm', async () => {
    const stored: EnrichedAbilitySpec = {
      catalogId: 'spellbook', entityId: 'off-ice-01',
      effects: [{ id: 'x', name: 'Ice Strike', duration: 'instant', durationSec: 0, cooldownSec: 0, color: '', modifiers: [], grantedTags: [] }],
      tagRules: [], provenance: prov('GA_OldLance'),
    };
    const fetchMock = routedFetch(stored, { ...stored, provenance: prov('GA_IceLance') });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useForgeAdopt('arpg-gas', iceForged, 'p'));
    await waitFor(() => expect(result.current.preview?.status).toBe('replaces'));

    act(() => result.current.requestAdopt());
    expect(result.current.confirmOpen).toBe(true);
    expect(postCalls(fetchMock)).toHaveLength(0);

    act(() => result.current.cancelAdopt());
    expect(result.current.confirmOpen).toBe(false);
    expect(postCalls(fetchMock)).toHaveLength(0);

    act(() => result.current.requestAdopt());
    await act(async () => { await result.current.adopt(); });
    expect(postCalls(fetchMock)).toHaveLength(1);
    expect(result.current.isAdopted).toBe(true);
  });

  it('requestAdopt into a target with no stored spec writes straight away (nothing to replace)', async () => {
    const fetchMock = routedFetch(null, { catalogId: 'spellbook', entityId: 'off-ice-01', effects: [], tagRules: [], provenance: prov('GA_IceLance') });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useForgeAdopt('arpg-gas', iceForged, 'p'));
    await waitFor(() => expect(result.current.preview?.status).toBe('fresh'));
    await act(async () => { result.current.requestAdopt(); });
    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
    expect(result.current.confirmOpen).toBe(false);
  });

  it('a manual target pick sticks for the current forge result', async () => {
    vi.stubGlobal('fetch', routedFetch(null));
    const { result } = renderHook(() => useForgeAdopt('arpg-gas', iceForged, 'p'));
    act(() => result.current.setEntityId('off-ice-04'));
    expect(result.current.entityId).toBe('off-ice-04');
    await waitFor(() => expect(result.current.preview?.status).toBe('fresh'));
    expect(result.current.entityId).toBe('off-ice-04');
  });
});

describe('useForgeAdopt — Generate in UE dispatch', () => {
  it('[guard] generateInUE dispatches the existing generate-gas-effects task with forged scalars', () => {
    vi.stubGlobal('fetch', routedFetch(null));
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
    vi.stubGlobal('fetch', routedFetch(null));
    const { result } = renderHook(() => useForgeAdopt('arpg-gas', null, null));
    act(() => result.current.generateInUE());
    expect(execute).not.toHaveBeenCalled();
  });
});
