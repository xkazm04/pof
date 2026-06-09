import { describe, it, expect } from 'vitest';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveStack, type AdjustmentLayer } from '@/lib/feel-adjustment-layers';
import { buildStackApplyPrompt } from '@/components/modules/core-engine/sub_character/ai-feel/build-apply-prompt';

const BASE = FEEL_PRESETS[0]; // Dark Souls Heavy — turnRate 360

const LAYERS: AdjustmentLayer[] = [
  { id: 'a', name: 'Boss Encounter', enabled: true, modifiers: [{ field: 'movement.turnRate', op: 'pct', value: -20 }] },
  { id: 'b', name: 'Disabled One', enabled: false, modifiers: [{ field: 'combat.attackSpeed', op: 'pct', value: 50 }] },
];

describe('buildStackApplyPrompt', () => {
  it('mentions the base preset and applies resolved values', () => {
    const resolved = resolveStack(BASE.profile, LAYERS);
    const prompt = buildStackApplyPrompt(BASE, LAYERS, resolved);
    expect(prompt).toContain('Dark Souls Heavy');
    // Resolved turn rate: 360 * 0.8 = 288 (not the base 360)
    expect(prompt).toContain('RotationRate.Yaw: 288');
  });

  it('lists active layers with their modifier summary', () => {
    const resolved = resolveStack(BASE.profile, LAYERS);
    const prompt = buildStackApplyPrompt(BASE, LAYERS, resolved);
    expect(prompt).toContain('Boss Encounter');
    expect(prompt).toContain('Turn Rate -20%');
  });

  it('excludes disabled layers', () => {
    const resolved = resolveStack(BASE.profile, LAYERS);
    const prompt = buildStackApplyPrompt(BASE, LAYERS, resolved);
    expect(prompt).not.toContain('Disabled One');
  });

  it('falls back to base values when there are no layers', () => {
    const prompt = buildStackApplyPrompt(BASE, [], BASE.profile);
    expect(prompt).toContain('RotationRate.Yaw: 360');
  });
});
