import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

afterEach(cleanup);

// ── Biome scatter: the same controls the dungeon panel already fixed ──

import { BiomeScatterPanel } from '@/components/modules/content/level-design/BiomeScatterPanel';

describe('BiomeScatterPanel matches ProcGenDungeonPanel on its controls', () => {
  it('the dice has a focus ring and a hidden icon; Scatter is type=button with a focus ring', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: { runs: [] } }))));
    const view = render(<BiomeScatterPanel onGenerate={vi.fn()} isGenerating={false} />);
    const dice = view.getByRole('button', { name: 'Randomize seed' });
    expect(dice.className).toContain('focus-ring');
    expect(dice.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const scatter = view.getByRole('button', { name: /Scatter Props/ });
    expect(scatter.getAttribute('type')).toBe('button');
    expect(scatter.className).toContain('focus-ring');
    vi.unstubAllGlobals();
  });
});
