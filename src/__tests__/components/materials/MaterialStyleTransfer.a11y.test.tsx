import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { MaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ANALYSIS: AnalyzedProperties = {
  colorPalette: [], surfaceType: 'metal', surfaceConfidence: 0.6,
  roughness: 0.3, metallic: 0.9, emissiveIntensity: 2, subsurfacePresence: 0,
  parallaxDepth: 0, opacity: 1, features: [], description: 'probe', suggestions: [],
};

/** Render the panel and drive it to a landed analysis (fetch stubbed — no provider). */
async function renderAnalyzed() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { analysis: ANALYSIS } }) })));
  const utils = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
  fireEvent.change(utils.container.querySelector('textarea')!, { target: { value: 'brushed metal' } });
  const analyze = Array.from(utils.container.querySelectorAll('button')).find((b) => b.textContent?.includes('Analyze Reference'))!;
  await act(async () => { fireEvent.click(analyze); });
  return utils;
}

const byText = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('MaterialStyleTransfer — toggle state is exposed, not colour-only', () => {
  it('each Surface Type override button says whether it is the active surface', async () => {
    const { container } = await renderAnalyzed();
    const metal = byText(container, 'Metal')!;
    const glass = byText(container, 'Glass')!;
    expect(metal.getAttribute('aria-pressed')).toBe('true');
    expect(glass.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(glass);
    expect(glass.getAttribute('aria-pressed')).toBe('true');
    expect(metal.getAttribute('aria-pressed')).toBe('false');
  });

  it('the Compare toggle exposes its on/off state', async () => {
    const { container } = await renderAnalyzed();
    const compare = byText(container, 'Compare')!;
    expect(compare.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(compare);
    expect(compare.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('MaterialStyleTransfer — the Refine Parameters disclosure', () => {
  it('announces whether its sliders are shown and names the region it controls', async () => {
    const { container } = await renderAnalyzed();
    const toggle = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Refine Parameters'))!;
    // A landed analysis opens the panel.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(container.querySelector(`[id="${controls}"]`)?.querySelector('input[type="range"]')).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('MaterialStyleTransfer — the look description field', () => {
  it('is programmatically labelled by its visible caption', () => {
    const { container } = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
    const textarea = container.querySelector('textarea')!;
    const label = textarea.id ? container.querySelector(`label[for="${textarea.id}"]`) : null;
    expect(label?.textContent).toMatch(/Describe the look you want/);
  });
});
