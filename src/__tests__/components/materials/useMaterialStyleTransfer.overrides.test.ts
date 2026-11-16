import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { useMaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer';
import type { AnalyzedProperties, StyleTransferConfig } from '@/components/modules/content/materials/MaterialStyleTransfer/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The refinement overrides (roughness / metallic / emissive / surface) live in ONE
 * record with one setter and one reset. Four parallel useState pairs meant a fifth
 * override touched six sites and a forgotten reset leaked an override onto the next
 * image. Behaviour: the adjustments payload and the reset on image swap / clear.
 * Structure: the source counts that make the drift visible.
 */

const ANALYSIS: AnalyzedProperties = {
  colorPalette: [], surfaceType: 'metal', surfaceConfidence: 0.6,
  roughness: 0.3, metallic: 0.9, emissiveIntensity: 2, subsurfacePresence: 0,
  parallaxDepth: 0, opacity: 1, features: [], description: 'x', suggestions: [],
};

class InstantReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() { this.result = 'data:img'; this.onload?.(); }
}

async function analyzed() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ success: true, data: { analysis: ANALYSIS } }) })));
  vi.stubGlobal('FileReader', InstantReader);
  const onGenerate = vi.fn<(c: StyleTransferConfig) => void>();
  const hook = renderHook(() => useMaterialStyleTransfer(onGenerate));
  act(() => hook.result.current.setReferenceDescription('brushed metal'));
  await act(async () => { await hook.result.current.handleAnalyze(); });
  return { ...hook, onGenerate };
}

function pick(result: { current: ReturnType<typeof useMaterialStyleTransfer> }) {
  act(() => result.current.handleDrop({
    preventDefault() {},
    dataTransfer: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
  } as never));
}

describe('useMaterialStyleTransfer - one overrides record', () => {
  it('overrides reach the effective analysis and the adjustments payload', async () => {
    const { result, onGenerate } = await analyzed();
    act(() => result.current.setOverride('roughness', 0.7));
    act(() => result.current.setOverride('surfaceType', 'cloth'));
    expect(result.current.effectiveAnalysis?.roughness).toBe(0.7);
    expect(result.current.effectiveAnalysis?.surfaceType).toBe('cloth');
    expect(result.current.effectiveAnalysis?.metallic).toBe(0.9);
    act(() => result.current.handleGenerate());
    expect(JSON.parse(JSON.stringify(onGenerate.mock.calls[0][0].adjustments)))
      .toEqual({ roughness: 0.7, surfaceType: 'cloth' });
  });

  it('setting an override to null resets just that key', async () => {
    const { result } = await analyzed();
    act(() => result.current.setOverride('roughness', 0.7));
    act(() => result.current.setOverride('metallic', 0.1));
    act(() => result.current.setOverride('roughness', null));
    expect(result.current.effectiveAnalysis?.roughness).toBe(ANALYSIS.roughness);
    expect(result.current.effectiveAnalysis?.metallic).toBe(0.1);
  });

  it('picking a new image drops every override', async () => {
    const { result, onGenerate } = await analyzed();
    act(() => result.current.setOverride('emissiveIntensity', 9));
    pick(result);
    await act(async () => { await result.current.handleAnalyze(); });
    expect(result.current.effectiveAnalysis?.emissiveIntensity).toBe(ANALYSIS.emissiveIntensity);
    act(() => result.current.handleGenerate());
    expect(JSON.parse(JSON.stringify(onGenerate.mock.calls[0][0].adjustments))).toEqual({});
  });

  it('removing the image drops every override', async () => {
    const { result, onGenerate } = await analyzed();
    act(() => result.current.setOverride('metallic', 0.2));
    act(() => result.current.handleClearImage());
    await act(async () => { await result.current.handleAnalyze(); });
    expect(result.current.effectiveAnalysis?.metallic).toBe(ANALYSIS.metallic);
    act(() => result.current.handleGenerate());
    expect(JSON.parse(JSON.stringify(onGenerate.mock.calls[0][0].adjustments))).toEqual({});
  });
});

describe('MaterialStyleTransfer - override state stays collapsed (source counts)', () => {
  const dir = 'src/components/modules/content/materials/MaterialStyleTransfer';
  const read = (f: string) => readFileSync(resolve(process.cwd(), dir, f), 'utf-8');

  it('the hook holds no per-override useState pair and no per-override reset call', () => {
    const hook = read('useMaterialStyleTransfer.ts');
    expect(hook.match(/const \[override[A-Z]\w*, setOverride[A-Z]\w*\] = useState/g) ?? []).toEqual([]);
    expect(hook.match(/\bsetOverride[A-Z]\w*\(null\)/g) ?? []).toEqual([]);
    expect(hook.match(/\bclearOverrides\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('AnalysisResults takes the override record + one setter (10 props, not 16)', () => {
    const src = read('AnalysisResults.tsx').replace(/\r/g, '');
    const start = src.indexOf('interface AnalysisResultsProps {');
    const block = src.slice(start, src.indexOf('\n}\n', start) + 2);
    const fields = block.split('\n').filter((l) => /^ {2}\w+\??:/.test(l));
    expect(fields.length).toBe(10);
    expect(fields.some((l) => /^ {2}overrides:/.test(l))).toBe(true);
  });
});
