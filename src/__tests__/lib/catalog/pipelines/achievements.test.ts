import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('achievements pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "achievements" with correct step labels, acceptance, and test gate', async () => {
    await import('@/lib/catalog/pipelines/achievements');
    const p = getCatalogPipeline('achievements');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Trigger & Progress');
    expect(labels).toContain('Hidden / Visible');
    expect(labels).toContain('Reward Binding');
    expect(labels).toContain('Platform Spec');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Unlock Toast');
    expect(labels).toContain('Anti-Cheat / Validation');
    expect(labels).toContain('Telemetry');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'achievement-first-blood',
      name: 'First Blood',
      lifecycle: 'planned' as const,
      data: {},
    };

    // Concept Brief: produce + accept → pass (≥300 chars)
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // Trigger & Progress: produce + accept → pass
    const trigger = p!.steps.find((s) => s.label === 'Trigger & Progress')!;
    expect(trigger.accept(trigger.produce(entity).data ?? {}).status).toBe('pass');

    // Hidden / Visible: produce + accept → pass
    const visibility = p!.steps.find((s) => s.label === 'Hidden / Visible')!;
    expect(visibility.accept(visibility.produce(entity).data ?? {}).status).toBe('pass');

    // Reward Binding: ≥1 link declared → pass
    const reward = p!.steps.find((s) => s.label === 'Reward Binding')!;
    expect(reward.accept(reward.produce(entity).data ?? {}).status).toBe('pass');

    // Platform Spec: produce + accept → pass
    const platform = p!.steps.find((s) => s.label === 'Platform Spec')!;
    expect(platform.accept(platform.produce(entity).data ?? {}).status).toBe('pass');

    // Icon 2D Art: selected=0 → L1 pass
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    expect(icon.accept(icon.produce(entity).data ?? {}).status).toBe('pass');

    // Unlock Toast: produce + accept → pass
    const toast = p!.steps.find((s) => s.label === 'Unlock Toast')!;
    expect(toast.accept(toast.produce(entity).data ?? {}).status).toBe('pass');

    // Anti-Cheat / Validation: produce + accept → pass
    const antiCheat = p!.steps.find((s) => s.label === 'Anti-Cheat / Validation')!;
    expect(antiCheat.accept(antiCheat.produce(entity).data ?? {}).status).toBe('pass');

    // Telemetry: produce + accept → pass
    const telemetry = p!.steps.find((s) => s.label === 'Telemetry')!;
    expect(telemetry.accept(telemetry.produce(entity).data ?? {}).status).toBe('pass');

    // Localization: produce + accept → pass (≥1 key)
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    expect(loc.accept(loc.produce(entity).data ?? {}).status).toBe('pass');

    // UE Packaging: produce + accept → pass (≥2 assets)
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    expect(pkg.accept(pkg.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
