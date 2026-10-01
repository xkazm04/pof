import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, renderHook, act, within } from '@testing-library/react';

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import {
  MaterialParameterConfigurator, type MaterialConfiguratorConfig,
} from '@/components/modules/content/materials/MaterialParameterConfigurator';
import { useMaterialParameterConfigurator } from '@/components/modules/content/materials/MaterialParameterConfigurator/useMaterialParameterConfigurator';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

/**
 * The Configure tab dispatches what its own surface spec says (scan-sweep
 * --challenge, material-configurator/A): the first Generate ships a real metal,
 * a forbidden combination cannot dispatch, and cloth names UE's Cloth model on
 * the budget bar and on the prompt it sends.
 */

function generateButton(container: HTMLElement): HTMLButtonElement {
  return within(container).getByRole('button', { name: /^Generate / }) as HTMLButtonElement;
}

describe('MaterialParameterConfigurator — dispatches its own surface spec', () => {
  it('Generate without touching anything ships the metal defaults selectSurface sets', () => {
    const onGenerate = vi.fn();
    const { container } = render(<MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(generateButton(container));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    expect(cfg.surfaceType).toBe('metal');
    expect(cfg.params.Metallic.defaultValue).toBe(1);
    expect(cfg.params.Roughness.defaultValue).toBe(0.2);
  });

  it('stone + tessellation + parallax: the hook refuses and onGenerate is never called', () => {
    const onGenerate = vi.fn();
    const { result } = renderHook(() => useMaterialParameterConfigurator(onGenerate));
    act(() => result.current.selectSurface('stone'));
    act(() => result.current.toggleFeature('tessellation'));
    expect(result.current.features).toEqual(expect.arrayContaining(['tessellation', 'parallax']));
    expect(result.current.refusal).toMatch(/Tessellation/);
    expect(result.current.refusal).toMatch(/Parallax/);
    act(() => result.current.handleGenerate());
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('the Generate button is disabled and shows the refusal reason', () => {
    const onGenerate = vi.fn();
    const { container, getByRole } = render(<MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(getByRole('button', { name: /Stone/ }));
    fireEvent.click(getByRole('button', { name: /^Tess/ }));
    const button = generateButton(container);
    expect(button.disabled).toBe(true);
    const reasonId = button.getAttribute('aria-describedby');
    expect(reasonId).toBeTruthy();
    const reason = container.querySelector(`#${reasonId}`);
    expect(reason?.textContent).toMatch(/Tessellation/);
    expect(reason?.textContent).toMatch(/Parallax/);
    fireEvent.click(button);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("cloth: the budget bar and the dispatched prompt both name UE's Cloth model", () => {
    const onGenerate = vi.fn();
    const { container, getByRole } = render(<MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(getByRole('button', { name: /Cloth/ }));
    const budget = container.querySelector('[aria-label="Material cost"]') as HTMLElement;
    expect(within(budget).getByText('Cloth')).toBeTruthy();
    fireEvent.click(generateButton(container));
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    const prompt = buildMaterialConfiguratorPrompt(cfg, { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' });
    expect(prompt).toMatch(/Shading model: \*\*Cloth \(/);
  });
});
