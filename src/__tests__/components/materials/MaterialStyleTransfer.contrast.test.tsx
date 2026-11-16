import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer/types';
import { blendOver, contrastRatio, WCAG_AA_TEXT } from '@/lib/contrast';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Three captions ("PNG, JPG up to 10MB", "NN% confidence", "Adjust before
 * generating") were `text-text-muted/60`: 3.17:1 on --surface and 3.33:1 on
 * --surface-deep, under WCAG 1.4.3's 4.5:1. Every opacity-faded text token on
 * the panel must still clear AA on the lightest card it sits on.
 */

const CSS = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf-8');
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)![1];
const SURFACE = token('surface');

const ANALYSIS: AnalyzedProperties = {
  colorPalette: [], surfaceType: 'metal', surfaceConfidence: 0.6,
  roughness: 0.3, metallic: 0.9, emissiveIntensity: 2, subsurfacePresence: 0,
  parallaxDepth: 0, opacity: 1, features: [], description: 'probe', suggestions: [],
};

function fadedTextFailures(root: HTMLElement): string[] {
  const failing: string[] = [];
  for (const el of Array.from(root.querySelectorAll('[class]'))) {
    for (const m of el.className.toString().matchAll(/(?:^|\s)text-(text|text-muted|text-subtle)\/(\d+)(?=\s|$)/g)) {
      const fg = blendOver(token(m[1]), Number(m[2]) / 100, SURFACE);
      const ratio = contrastRatio(fg, SURFACE);
      if (ratio < WCAG_AA_TEXT) failing.push(`text-${m[1]}/${m[2]} ${ratio.toFixed(2)}:1 "${el.textContent}"`);
    }
  }
  return failing;
}

describe('MaterialStyleTransfer caption contrast', () => {
  it('the empty drop zone has no faded caption under AA', () => {
    const { container } = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
    expect(fadedTextFailures(container)).toEqual([]);
  });

  it('the analysis results have no faded caption under AA', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { analysis: ANALYSIS } }) })));
    const { container } = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'brushed metal' } });
    const analyze = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Analyze Reference'))!;
    await act(async () => { fireEvent.click(analyze); });
    expect(container.textContent).toContain('% confidence');
    expect(fadedTextFailures(container)).toEqual([]);
  });
});
