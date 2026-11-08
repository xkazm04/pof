import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sun, Gem } from 'lucide-react';

import { PropertyBar } from '@/components/modules/content/materials/MaterialStyleTransfer/PropertyBar';
import { AnalysisMiniPreview } from '@/components/modules/content/materials/MaterialStyleTransfer/AnalysisMiniPreview';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer/types';
import { STATUS_WARNING } from '@/lib/chart-colors';

afterEach(cleanup);

/**
 * The analysis bar formatted by VALUE (`v > 1 ? 1 : 2` decimals), so one
 * Emissive figure read "0.50" / "1.00" / "1.5" while the compare pane's mini
 * preview printed the same figures as "0.5" / "1.0" / "1.5". Precision must
 * follow the bar's scale, and both surfaces must print one figure alike.
 */

const BASE: AnalyzedProperties = {
  colorPalette: [], surfaceType: 'metal', surfaceConfidence: 0.6,
  roughness: 0.35, metallic: 0.9, emissiveIntensity: 0, subsurfacePresence: 0,
  parallaxDepth: 0, opacity: 1, features: [], description: '', suggestions: [],
};

function bar(value: number, max: number): string {
  const { container } = render(<PropertyBar label="Probe" value={value} max={max} color={STATUS_WARNING} icon={max > 1 ? Sun : Gem} />);
  const text = container.querySelector('span.font-mono')?.textContent ?? '';
  cleanup();
  return text;
}

function miniEmissive(v: number): string {
  const { container } = render(<AnalysisMiniPreview analysis={{ ...BASE, emissiveIntensity: v }} />);
  const row = Array.from(container.querySelectorAll('div.flex')).find((d) => d.textContent?.startsWith('Emissive'));
  const text = row?.querySelector('span.font-mono')?.textContent ?? '';
  cleanup();
  return text;
}

describe('PropertyBar readout precision', () => {
  it('prints Emissive (0-20) with one decimal count, matching the mini preview', () => {
    for (const v of [0.5, 1, 1.5, 12]) {
      expect(bar(v, 20)).toBe(miniEmissive(v));
    }
    expect(new Set([0.5, 1, 1.5, 12].map((v) => bar(v, 20).split('.')[1].length)).size).toBe(1);
  });

  it('keeps unit-scale bars (Roughness / Metallic / SSS) at two decimals', () => {
    expect([0, 0.35, 1].map((v) => bar(v, 1))).toEqual(['0.00', '0.35', '1.00']);
  });
});
