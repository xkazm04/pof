import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import { MaterialParameterConfigurator } from '@/components/modules/content/materials/MaterialParameterConfigurator';

afterEach(cleanup);

describe('MaterialParameterConfigurator — Explain Mode', () => {
  it('starts in technical mode and shows the raw description for the selected surface', () => {
    const { container } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    expect(container.textContent).toContain('PBR metallic'); // metal description
    expect(container.textContent).not.toContain('shiny, reflective surface'); // plain copy hidden
  });

  it('Explain toggle swaps surface copy to plain English', () => {
    const { container, getByTestId } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(getByTestId('material-explain-toggle'));
    expect(container.textContent).toContain('shiny, reflective surface');
  });

  it('Explain toggle replaces parameter labels with their plain equivalents and renders a ParamCue', () => {
    const { container, getByTestId } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(getByTestId('material-explain-toggle'));
    // Roughness param's plain label is "Polish"; its cue kind is 'level'.
    expect(container.textContent).toContain('Polish');
    const cues = container.querySelectorAll('[data-cue]');
    expect(cues.length).toBeGreaterThan(0);
    // At least one cue must use the canonical 'level' kind.
    const kinds = Array.from(cues).map((c) => c.getAttribute('data-cue'));
    expect(kinds).toContain('level');
  });

  it('Glossary toggle opens a panel listing PBR/IOR/SSS terms in plain English', () => {
    const { container, getByTestId } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(getByTestId('material-glossary-toggle'));
    const region = container.querySelector('[role="region"][aria-label="Glossary"]')!;
    const text = region.textContent ?? '';
    expect(text).toContain('PBR');
    expect(text).toContain('IOR');
    expect(text).toContain('SSS');
  });

  it('Explain mode rewrites slider bounds with the plain low/high labels', () => {
    const { container, getByTestId } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(getByTestId('material-explain-toggle'));
    // Roughness plain low/high are "Mirror"/"Sandpaper".
    expect(container.textContent).toContain('Mirror');
    expect(container.textContent).toContain('Sandpaper');
  });

  it('feature buttons render their plain label + explanation in Explain mode', () => {
    const { container, getByTestId } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(getByTestId('material-explain-toggle'));
    // Parallax plain.label is "Fake depth in cracks"
    expect(container.textContent).toContain('Fake depth in cracks');
  });
});

describe('MaterialBudgetBar — rendered inside the configurator', () => {
  it('mounts a budget section with sampler + instruction meters', () => {
    const { container } = render(<MaterialParameterConfigurator onGenerate={vi.fn()} isGenerating={false} />);
    const budget = container.querySelector('[aria-label="Material cost"]')!;
    expect(budget).toBeTruthy();
    expect(within(budget as HTMLElement).queryByText(/Samplers/i)).toBeTruthy();
    expect(within(budget as HTMLElement).queryByText(/Instructions/i)).toBeTruthy();
  });
});
