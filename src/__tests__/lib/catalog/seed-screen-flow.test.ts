import { describe, it, expect } from 'vitest';
import { screenNodeToEntry, seedScreenEntries } from '@/lib/catalog/seed-screen-flow';
import { FLOW_NODES } from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';

describe('screenNodeToEntry', () => {
  const n0 = FLOW_NODES[0];
  it('prefixes id, keeps label as name + data', () => {
    const e = screenNodeToEntry(n0);
    expect(e.id).toBe(`screen-${n0.id}`);
    expect(e.name).toBe(n0.label);
    expect(e.data).toBe(n0);
    expect(e.catalogId).toBe('screen-flow');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Screens, group ?? "Misc"]', () => {
    const e = screenNodeToEntry(n0);
    expect(e.categoryPath).toEqual(['Screens', n0.group ?? 'Misc']);
  });
});

describe('seedScreenEntries', () => {
  it('maps every flow node with unique ids', () => {
    const entries = seedScreenEntries();
    expect(entries.length).toBe(FLOW_NODES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
