import { describe, it, expect, beforeEach } from 'vitest';
import { useAbilitySpecStore, specKey } from '@/stores/abilitySpecStore';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';

const spec: EnrichedAbilitySpec = {
  catalogId: 'spellbook', entityId: 'off-fire-01', effects: [], tagRules: [],
};

describe('abilitySpecStore', () => {
  beforeEach(() => useAbilitySpecStore.setState({ specByEntity: {} }));

  it('getSpec returns undefined before load, null after loading none', () => {
    const s = useAbilitySpecStore.getState();
    expect(s.getSpec('spellbook', 'x')).toBeUndefined();
    s.loadSpec('spellbook', 'x', null);
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'x')).toBeNull();
  });

  it('loadSpec / setSpec store under the composite key', () => {
    const s = useAbilitySpecStore.getState();
    s.loadSpec('spellbook', 'off-fire-01', spec);
    expect(useAbilitySpecStore.getState().getSpec('spellbook', 'off-fire-01')).toEqual(spec);
    const next = { ...spec, tagRules: [{ id: 'r', sourceTag: 'A', targetTag: 'B', type: 'blocks' as const }] };
    useAbilitySpecStore.getState().setSpec('spellbook', 'off-fire-01', next);
    expect(useAbilitySpecStore.getState().specByEntity[specKey('spellbook', 'off-fire-01')]).toEqual(next);
  });
});
