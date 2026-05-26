import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('tutorial-beats pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "tutorial-beats" with correct step labels, acceptance, and test gate', async () => {
    await import('@/lib/catalog/pipelines/tutorial-beats');
    const p = getCatalogPipeline('tutorial-beats');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Step Sequence');
    expect(labels).toContain('Telemetry');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Localization');

    const entity = { id: 'tutorial-first-dodge', name: 'First Dodge', lifecycle: 'planned' as const, data: {} };

    // Concept Brief: produce + accept → pass (≥300 chars)
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // Trigger: produce + accept → pass
    const trigger = p!.steps.find((s) => s.label === 'Trigger')!;
    expect(trigger.accept(trigger.produce(entity).data ?? {}).status).toBe('pass');

    // Step Sequence: produce + accept → pass
    const sequence = p!.steps.find((s) => s.label === 'Step Sequence')!;
    expect(sequence.accept(sequence.produce(entity).data ?? {}).status).toBe('pass');

    // Telemetry: produce + accept → pass
    const telemetry = p!.steps.find((s) => s.label === 'Telemetry')!;
    expect(telemetry.accept(telemetry.produce(entity).data ?? {}).status).toBe('pass');

    // VO: produce + accept → pass (≥1 line)
    const vo = p!.steps.find((s) => s.label === 'VO')!;
    expect(vo.accept(vo.produce(entity).data ?? {}).status).toBe('pass');

    // Localization: produce + accept → pass (≥1 key)
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    expect(loc.accept(loc.produce(entity).data ?? {}).status).toBe('pass');

    // VFX / Audio Cue: produce + accept → pass (≥1 cue)
    const cues = p!.steps.find((s) => s.label === 'VFX / Audio Cue')!;
    expect(cues.accept(cues.produce(entity).data ?? {}).status).toBe('pass');

    // Icon 2D Art: selected=0 → L1 pass
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    expect(icon.accept(icon.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
