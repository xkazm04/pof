import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('quests pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "quests" with correct step labels, acceptance, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/quests');
    const p = getCatalogPipeline('quests');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Objective Graph');
    expect(labels).toContain('Rewards');
    expect(labels).toContain('NPC & Dialog Binding');
    expect(labels).toContain('Marker / Tracker UI');
    expect(labels).toContain('Journal / Lore');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = { id: 'quest-ember-pact', name: 'The Ember Pact', lifecycle: 'planned' as const, data: {} };

    // Concept Brief: produce → accept → pass
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // Objective Graph: produce → accept → pass
    const graph = p!.steps.find((s) => s.label === 'Objective Graph')!;
    expect(graph.accept(graph.produce(entity).data ?? {}).status).toBe('pass');

    // Rewards: produce contains cross-catalog links and accept → pass
    const rewards = p!.steps.find((s) => s.label === 'Rewards')!;
    const rewardsOutput = rewards.produce(entity);
    expect(rewardsOutput.data?.links).toBeDefined();
    const links = rewardsOutput.data!.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(links.some((l) => l.catalogId === 'loot-tables')).toBe(true);
    expect(links.some((l) => l.catalogId === 'currencies')).toBe(true);
    expect(rewards.accept(rewardsOutput.data ?? {}).status).toBe('pass');

    // NPC & Dialog Binding: cross-catalog links to characters + dialog-trees
    const npcs = p!.steps.find((s) => s.label === 'NPC & Dialog Binding')!;
    const npcsOutput = npcs.produce(entity);
    const npcLinks = npcsOutput.data!.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(npcLinks.some((l) => l.catalogId === 'characters')).toBe(true);
    expect(npcLinks.some((l) => l.catalogId === 'dialog-trees')).toBe(true);
    expect(npcs.accept(npcsOutput.data ?? {}).status).toBe('pass');

    // Marker / Tracker UI: produce → accept → pass
    const tracker = p!.steps.find((s) => s.label === 'Marker / Tracker UI')!;
    expect(tracker.accept(tracker.produce(entity).data ?? {}).status).toBe('pass');

    // Journal / Lore: produce → accept → pass
    const journal = p!.steps.find((s) => s.label === 'Journal / Lore')!;
    expect(journal.accept(journal.produce(entity).data ?? {}).status).toBe('pass');

    // Localization: produce → accept → pass
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    expect(loc.accept(loc.produce(entity).data ?? {}).status).toBe('pass');

    // UE Packaging: produce → accept → pass
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    expect(pkg.accept(pkg.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // No staticChecks on any step (no C++ struct found in UE source for quests)
    p!.steps.forEach((s) => {
      expect(s.staticChecks).toBeUndefined();
    });
  });
});
