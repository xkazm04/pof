import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ParameterDetails } from '@/components/modules/core-engine/sub_character/ai-feel/ParameterDetails';
import { ComparisonPanel } from '@/components/modules/core-engine/sub_character/ai-feel/ComparisonPanel';
import { FEEL_PRESETS, compareProfiles } from '@/lib/character-feel-optimizer';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));

afterEach(() => cleanup());

/* Every show/hide toggle in this context announces its state the way
 * FeelLayerStack's two toggles already do (aria-expanded). Before: 0 of 3
 * (ParameterDetails categories, A/B Comparison header, Playground preset menu). */

describe('feel disclosure toggles announce aria-expanded', () => {
  it('ParameterDetails category headers', () => {
    render(<ParameterDetails preset={FEEL_PRESETS[0]} />);
    const movement = screen.getByRole('button', { name: /movement/i });
    expect(movement.getAttribute('aria-expanded')).toBe('true');
    const combat = screen.getByRole('button', { name: /combat/i });
    expect(combat.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(combat);
    expect(combat.getAttribute('aria-expanded')).toBe('true');
    expect(movement.getAttribute('aria-expanded')).toBe('false');
  });

  it('ComparisonPanel header', () => {
    const a = FEEL_PRESETS[0];
    const b = FEEL_PRESETS[1];
    const comparison = compareProfiles(a.profile, b.profile);
    const byCat = new Map<string, typeof comparison>();
    for (const c of comparison) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
    const { rerender } = render(
      <ComparisonPanel selectedPreset={a} comparePreset={b} comparison={comparison}
        comparisonByCategory={byCat} showComparison={false} onToggle={vi.fn()} />,
    );
    const toggle = screen.getByRole('button', { name: /a\/b comparison/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    rerender(
      <ComparisonPanel selectedPreset={a} comparePreset={b} comparison={comparison}
        comparisonByCategory={byCat} showComparison={true} onToggle={vi.fn()} />,
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('Playground preset menu button', async () => {
    const { CharacterFeelPlayground } = await import(
      '@/components/modules/core-engine/sub_character/playground/PlaygroundTab'
    );
    const { useCharacterBlueprintStore } = await import('@/stores/characterBlueprintStore');
    useCharacterBlueprintStore.setState({ baseFeelPresetId: FEEL_PRESETS[0].id, feelLayers: [] });
    render(<CharacterFeelPlayground moduleId="arpg-character" />);
    const menu = screen.getByRole('button', { name: new RegExp(FEEL_PRESETS[0].name) });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(menu.getAttribute('aria-haspopup')).toBe('true');
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
  });
});
