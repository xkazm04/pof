import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import type { MaterialEntry } from '@/types/pof-bridge';

/**
 * A live parent's scalar with no numeric manifest default dispatches nothing
 * until it is moved, so its row must read "not overridden" - never its minimum
 * as if that value would be used.
 */

const LAVA: MaterialEntry = {
  path: '/Game/M/M_Lava', parentMaterial: null, domain: 'Surface', blendMode: 'Opaque', shadingModel: 'DefaultLit',
  parameters: [
    { name: 'Roughness', type: 'ScalarParameter', defaultValue: 0.3, min: 0, max: 1 },
    { name: 'Wetness', type: 'ScalarParameter', defaultValue: 'curve:Wet' },
  ],
  materialInstances: [], textureReferences: [], crossReferences: [], contentHash: 'l',
};

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: { materials: [LAVA] }, isConnected: true }),
}));

import {
  MaterialParameterConfigurator, type MaterialConfiguratorConfig,
} from '@/components/modules/content/materials/MaterialParameterConfigurator';

afterEach(cleanup);

function adopt(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => /M_Lava/.test(b.textContent ?? ''));
  expect(btn).toBeTruthy();
  fireEvent.click(btn!);
}

function wetnessRow(container: HTMLElement): HTMLElement {
  const input = container.querySelector('input[aria-label*="Wetness"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input.parentElement as HTMLElement;
}

describe('an unset parent scalar reads as unset', () => {
  it('shows "not overridden" (not its minimum) until moved, and dispatches nothing for it', () => {
    const onGenerate = vi.fn();
    const { container } = render(<MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />);
    adopt(container);
    const row = wetnessRow(container);
    expect(row.textContent).toContain('not overridden');
    expect(row.querySelector('input')!.getAttribute('aria-valuetext')).toBe('not overridden');
    expect(within(container).getAllByRole('button', { name: /^Generate / })).toBeTruthy();
    fireEvent.click(within(container).getByRole('button', { name: /^Generate / }));
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    expect(cfg.params.Wetness).toBeUndefined();
  });

  it('reads a number once the slider is moved, and the numeric-default row never reads unset', () => {
    const { container } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    adopt(container);
    const input = wetnessRow(container).querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(wetnessRow(container).textContent).not.toContain('not overridden');
    const rough = container.querySelector('input[aria-label*="Roughness"]')!.parentElement as HTMLElement;
    expect(rough.textContent).not.toContain('not overridden');
  });
});
