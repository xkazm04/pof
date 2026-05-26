import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('characters pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "characters" with correct step labels, acceptance, and deferred gate', async () => {
    await import('@/lib/catalog/pipelines/characters');
    const p = getCatalogPipeline('characters');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Stat Block');
    expect(labels).toContain('3D & Rig');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('Behavior (NPC)');
    expect(labels).toContain('Icon 2D Art (portrait)');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'char-captain-vael',
      name: 'Captain Vael',
      lifecycle: 'planned' as const,
      data: {},
    };

    // Stat Block: produce + accept → pass (L0 fieldsPopulated)
    const statBlock = p!.steps.find((s) => s.label === 'Stat Block')!;
    expect(statBlock.accept(statBlock.produce(entity).data ?? {}).status).toBe('pass');

    // Stat Block static checks: declared but deferred without UE root (no fixture for FARPGAttributeInitRow)
    const statChecks = statBlock.staticChecks!(entity);
    expect(statChecks).toHaveLength(1);
    const l2stat = statChecks[0](null);
    expect(l2stat.tier).toBe('L2');

    // Behavior (NPC): produce + accept → pass (L0 fieldsPopulated)
    const behavior = p!.steps.find((s) => s.label === 'Behavior (NPC)')!;
    expect(behavior.accept(behavior.produce(entity).data ?? {}).status).toBe('pass');

    // Behavior produces cross-catalog links to dialog-trees + quests
    const behaviorData = behavior.produce(entity).data ?? {};
    const links = (behaviorData as Record<string, unknown>).links as Array<{ catalogId: string; role: string }>;
    expect(links.some((l) => l.catalogId === 'dialog-trees')).toBe(true);
    expect(links.some((l) => l.catalogId === 'quests')).toBe(true);

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // UE Packaging static checks: declared (result is tier L2 regardless of UE root availability)
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgChecks = packaging.staticChecks!(entity);
    expect(pkgChecks).toHaveLength(1);
    const l2pkg = pkgChecks[0](null);
    expect(l2pkg.tier).toBe('L2');
  });
});
