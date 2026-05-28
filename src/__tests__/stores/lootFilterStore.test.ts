import { describe, it, expect, beforeEach } from 'vitest';
import { useLootFilterStore } from '@/stores/lootFilterStore';
import type { LootFilterRule } from '@/lib/loot-filter/types';

const mkRule = (id: string, name: string): LootFilterRule => ({
  id, name, enabled: true, action: 'show', condition: {}, style: {},
});

beforeEach(() => {
  useLootFilterStore.setState({
    rulesetsById: {
      rs: { id: 'rs', name: 'Base', updatedAt: '2026-01-01T00:00:00.000Z', rules: [mkRule('a', 'A'), mkRule('b', 'B')] },
    },
    order: ['rs'],
    activeRulesetId: 'rs',
  });
});

describe('useLootFilterStore — rules', () => {
  it('appends a new rule and returns its id, bumping updatedAt', () => {
    const before = useLootFilterStore.getState().rulesetsById.rs.updatedAt;
    const id = useLootFilterStore.getState().addRule('rs');
    const rs = useLootFilterStore.getState().rulesetsById.rs;
    expect(rs.rules).toHaveLength(3);
    expect(rs.rules[2].id).toBe(id);
    expect(rs.updatedAt).not.toBe(before);
  });

  it('patches a rule via updateRule', () => {
    useLootFilterStore.getState().updateRule('rs', 'a', { action: 'hide', name: 'Hidden' });
    const rule = useLootFilterStore.getState().rulesetsById.rs.rules.find((r) => r.id === 'a');
    expect(rule?.action).toBe('hide');
    expect(rule?.name).toBe('Hidden');
  });

  it('removes a rule', () => {
    useLootFilterStore.getState().removeRule('rs', 'a');
    const rules = useLootFilterStore.getState().rulesetsById.rs.rules;
    expect(rules.map((r) => r.id)).toEqual(['b']);
  });

  it('reorders rules with moveRule and clamps at the ends', () => {
    useLootFilterStore.getState().moveRule('rs', 'b', -1); // b up
    expect(useLootFilterStore.getState().rulesetsById.rs.rules.map((r) => r.id)).toEqual(['b', 'a']);
    useLootFilterStore.getState().moveRule('rs', 'b', -1); // already first → no-op
    expect(useLootFilterStore.getState().rulesetsById.rs.rules.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('duplicates a rule directly after the original with a fresh id', () => {
    useLootFilterStore.getState().duplicateRule('rs', 'a');
    const rules = useLootFilterStore.getState().rulesetsById.rs.rules;
    expect(rules).toHaveLength(3);
    expect(rules[1].id).not.toBe('a');
    expect(rules[1].name).toMatch(/copy/i);
  });
});

describe('useLootFilterStore — rulesets', () => {
  it('creates a ruleset, makes it active, and tracks order', () => {
    const id = useLootFilterStore.getState().createRuleset('Speedfarm');
    const s = useLootFilterStore.getState();
    expect(s.activeRulesetId).toBe(id);
    expect(s.rulesetsById[id].name).toBe('Speedfarm');
    expect(s.order).toContain(id);
  });

  it('renames and switches the active ruleset', () => {
    const id = useLootFilterStore.getState().createRuleset('Tmp');
    useLootFilterStore.getState().renameRuleset(id, 'Renamed');
    expect(useLootFilterStore.getState().rulesetsById[id].name).toBe('Renamed');
    useLootFilterStore.getState().setActiveRuleset('rs');
    expect(useLootFilterStore.getState().activeRulesetId).toBe('rs');
  });

  it('deletes a ruleset and moves active to a survivor', () => {
    const id = useLootFilterStore.getState().createRuleset('Doomed');
    useLootFilterStore.getState().deleteRuleset(id);
    const s = useLootFilterStore.getState();
    expect(s.rulesetsById[id]).toBeUndefined();
    expect(s.activeRulesetId).toBe('rs');
  });

  it('always keeps at least one ruleset — deleting the last reseeds a default', () => {
    useLootFilterStore.getState().deleteRuleset('rs');
    const s = useLootFilterStore.getState();
    expect(s.order).toHaveLength(1);
    expect(s.rulesetsById[s.activeRulesetId]).toBeDefined();
  });
});
