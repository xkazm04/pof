import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { toStackSpec, toCompositorSettings } from '@/lib/post-process-studio/stack-spec';
import { estimateGPUBudget } from '@/lib/post-process-studio/gpu-estimator';
import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';
import { buildPostProcessPrompt } from '@/lib/prompts/post-process';
import { usePostProcessStudioStore } from '@/stores/postProcessStudioStore';
import { PostProcessStackBuilder } from '@/components/modules/content/materials/PostProcessStackBuilder';
import type { PPStudioEffect } from '@/types/post-process-studio';
import type { ProjectContext } from '@/lib/prompt-context';

/**
 * One post-process stack, one projection. The studio store holds the stack; the
 * prompt, the GPU budget readouts and the Blender compositor preview must all be
 * read off it through `toStackSpec` / `toCompositorSettings`, never re-derived
 * from defaults or a fixed resolution.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

function clone(effects: PPStudioEffect[]): PPStudioEffect[] {
  return effects.map((e) => ({ ...e, params: e.params.map((p) => ({ ...p })) }));
}

function withParam(effects: PPStudioEffect[], id: string, name: string, value: number): PPStudioEffect[] {
  return effects.map((e) =>
    e.id === id ? { ...e, params: e.params.map((p) => (p.name === name ? { ...p, value } : p)) } : e,
  );
}

afterEach(() => {
  cleanup();
  usePostProcessStudioStore.getState().setResolution('1080p');
});

describe('toStackSpec — the one projection of a stack', () => {
  it('carries resolution, budget, live param values and estimator costs; disabled effects are listed apart', () => {
    const effects = withParam(clone(DEFAULT_EFFECTS), 'bloom', 'Intensity', 2.0);
    const spec = toStackSpec(effects, '4K');
    const report = estimateGPUBudget(effects, '4K');

    expect(spec.resolution).toBe('4K');
    expect(spec.budgetMs).toBe(8);
    const bloom = spec.effects.find((e) => e.id === 'bloom');
    expect(bloom?.params.find((p) => p.name === 'Intensity')?.value).toBe(2.0);
    expect(bloom?.estCostMs).toBe(report.effects.find((e) => e.effectId === 'bloom')?.costMs);

    const disabledIds = effects.filter((e) => !e.enabled).map((e) => e.id);
    expect(disabledIds.length).toBeGreaterThan(0);
    expect([...spec.disabled].sort()).toEqual([...disabledIds].sort());
    for (const id of disabledIds) expect(spec.effects.some((e) => e.id === id)).toBe(false);
  });
});

describe('toCompositorSettings — the Blender preview reads the real stack', () => {
  it('maps bloom / color-grading / vignette params instead of hard-coded defaults', () => {
    let effects = clone(DEFAULT_EFFECTS).map((e) =>
      ['bloom', 'color-grading', 'vignette'].includes(e.id) ? { ...e, enabled: true } : e,
    );
    effects = withParam(effects, 'bloom', 'Intensity', 2);
    effects = withParam(effects, 'bloom', 'Threshold', 1.5);
    effects = withParam(effects, 'bloom', 'Size Scale', 8);
    effects = withParam(effects, 'color-grading', 'Saturation', 0.3);
    effects = withParam(effects, 'color-grading', 'Temperature', 4000);
    effects = withParam(effects, 'vignette', 'Intensity', 0.9);

    expect(toCompositorSettings(effects)).toEqual({
      bloom: { intensity: 2, threshold: 1.5, radius: 8 },
      colorGrading: { saturation: 0.3, whiteBalance: 4000 },
      vignette: { intensity: 0.9 },
    });
  });
});

describe('buildPostProcessPrompt(spec) — the budget shapes the output', () => {
  it('names the over-budget total at the chosen resolution and prints resolution-aware per-effect cost', () => {
    const store = usePostProcessStudioStore.getState();
    store.init();
    usePostProcessStudioStore.getState().applyPreset('underwater');
    const effects = usePostProcessStudioStore.getState().effects;
    const spec = toStackSpec(effects, '1440p');
    const prompt = buildPostProcessPrompt(spec, CTX);

    const budgetLine = prompt.split('\n').find((l) => l.includes('GPU budget'));
    expect(budgetLine).toBeDefined();
    expect(budgetLine).toContain('7.07ms');
    expect(budgetLine).toContain('6ms');
    expect(budgetLine).toContain('1440p');
    expect(budgetLine).toContain('OVER');

    for (const e of spec.effects) expect(prompt).toContain(`${e.estCostMs}ms @ 1440p`);
    expect(prompt).not.toContain('ms @ 1080p');
  });
});

describe('PostProcessStackBuilder — one budget per stack', () => {
  it('the budget readout follows the store resolution, not a fixed 1080p', () => {
    usePostProcessStudioStore.getState().init();
    act(() => usePostProcessStudioStore.getState().setResolution('4K'));
    const { getByTestId } = render(
      createElement(PostProcessStackBuilder, { onGenerate: vi.fn(), isGenerating: false }),
    );
    const readout = getByTestId('pp-gpu-budget').textContent ?? '';
    expect(readout).toContain('@ 4K');
    expect(readout).toContain('/ 8ms');
  });
});
