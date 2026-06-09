import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PostProcessStackBuilder } from '@/components/modules/content/materials/PostProcessStackBuilder';
import { EffectCard, ParamSlider } from '@/components/modules/evaluator/PostProcessStudioView';
import type { PPStudioEffect, PPStudioParam } from '@/types/post-process-studio';
import { ACCENT_VIOLET } from '@/lib/chart-colors';

afterEach(cleanup);

// ── Fixtures for the Studio's internal sub-components ────────────────────────

const PARAM: PPStudioParam = {
  name: 'BloomIntensity',
  description: 'Glow strength',
  type: 'float',
  defaultValue: 0.675,
  value: 0.675,
  min: 0,
  max: 8,
  step: 0.001,
  ueProperty: 'BloomIntensity',
};

function makeEffect(overrides: Partial<PPStudioEffect> = {}): PPStudioEffect {
  return {
    id: 'bloom',
    name: 'Bloom',
    category: 'lighting',
    ueClass: 'FPostProcessSettings::Bloom',
    description: 'Glow around bright areas',
    enabled: true,
    priority: 0,
    params: [PARAM],
    gpuCostMs: 0.5,
    ...overrides,
  };
}

const noop = () => {};

function renderEffectCard(props: Partial<Parameters<typeof EffectCard>[0]> = {}) {
  return render(
    <EffectCard
      effect={makeEffect()}
      isFirst={false}
      isLast={false}
      isExpanded={false}
      explainMode={false}
      onToggle={noop}
      onMoveUp={noop}
      onMoveDown={noop}
      onExpand={noop}
      onParamChange={noop}
      gpuCost={undefined}
      {...props}
    />,
  );
}

/* ── PostProcessStackBuilder — switch toggles ──────────────────────────────── */

describe('PostProcessStackBuilder — effect enable toggles', () => {
  function renderBuilder() {
    return render(<PostProcessStackBuilder onGenerate={vi.fn()} isGenerating={false} />);
  }

  it('exposes each enable toggle as a switch with aria-checked reflecting state', () => {
    const { getByRole } = renderBuilder();
    // Bloom is enabled by default.
    const bloom = getByRole('switch', { name: /Bloom effect enabled/i });
    expect(bloom.getAttribute('aria-checked')).toBe('true');
    // Depth of Field is disabled by default.
    const dof = getByRole('switch', { name: /Depth of Field effect disabled/i });
    expect(dof.getAttribute('aria-checked')).toBe('false');
  });

  it('routes the toggle focus through the shared .focus-ring token', () => {
    const { getByRole } = renderBuilder();
    expect(getByRole('switch', { name: /Bloom effect enabled/i }).className).toContain('focus-ring');
  });

  it('flips aria-checked when the switch is toggled', () => {
    const { getByRole } = renderBuilder();
    const dof = getByRole('switch', { name: /Depth of Field effect disabled/i });
    fireEvent.click(dof);
    expect(getByRole('switch', { name: /Depth of Field effect enabled/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows a non-color ON/OFF text cue for every effect (4 enabled, 3 disabled by default)', () => {
    const { getAllByText } = renderBuilder();
    expect(getAllByText('ON', { exact: true })).toHaveLength(4);
    expect(getAllByText('OFF', { exact: true })).toHaveLength(3);
  });

  it('labels the reorder buttons with the effect name and direction', () => {
    const { getByRole } = renderBuilder();
    expect(getByRole('button', { name: 'Move Bloom up' })).toBeTruthy();
    expect(getByRole('button', { name: 'Move Bloom down' })).toBeTruthy();
  });

  it('disables the up button on the first row and the down button on the last', () => {
    const { getByRole } = renderBuilder();
    // Bloom is first (priority 0); Custom Stencil is last (priority 6).
    expect((getByRole('button', { name: 'Move Bloom up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((getByRole('button', { name: 'Move Custom Stencil down' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks the expand control with aria-expanded and a descriptive label', () => {
    const { getByRole } = renderBuilder();
    const expand = getByRole('button', { name: /Expand Bloom parameters/i });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(expand);
    expect(getByRole('button', { name: /Collapse Bloom parameters/i }).getAttribute('aria-expanded')).toBe('true');
  });
});

/* ── PostProcessStudioView — EffectCard switch + reorder ───────────────────── */

describe('PostProcessStudioView EffectCard — switch + reorder a11y', () => {
  it('exposes the enable toggle as a switch with aria-checked + focus-ring', () => {
    const { getByRole } = renderEffectCard({ effect: makeEffect({ enabled: true }) });
    const sw = getByRole('switch', { name: /Bloom effect enabled/i });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.className).toContain('focus-ring');
  });

  it('reflects a disabled effect with aria-checked=false and a disabled label', () => {
    const { getByRole } = renderEffectCard({ effect: makeEffect({ enabled: false }) });
    expect(getByRole('switch', { name: /Bloom effect disabled/i }).getAttribute('aria-checked')).toBe('false');
  });

  it('shows a non-color ON/OFF text cue mirroring the enabled state', () => {
    const on = renderEffectCard({ effect: makeEffect({ enabled: true }) });
    expect(on.getByText('ON', { exact: true })).toBeTruthy();
    cleanup();
    const off = renderEffectCard({ effect: makeEffect({ enabled: false }) });
    expect(off.getByText('OFF', { exact: true })).toBeTruthy();
  });

  it('labels the reorder buttons with the effect name and direction', () => {
    const { getByRole } = renderEffectCard();
    expect(getByRole('button', { name: 'Move Bloom up' })).toBeTruthy();
    expect(getByRole('button', { name: 'Move Bloom down' })).toBeTruthy();
  });

  it('fires the reorder callbacks on click', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const { getByRole } = renderEffectCard({ onMoveUp, onMoveDown });
    fireEvent.click(getByRole('button', { name: 'Move Bloom up' }));
    fireEvent.click(getByRole('button', { name: 'Move Bloom down' }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });
});

/* ── PostProcessStudioView — ParamSlider focus + label ─────────────────────── */

describe('PostProcessStudioView ParamSlider — slider a11y', () => {
  function renderSlider(props: Partial<Parameters<typeof ParamSlider>[0]> = {}) {
    return render(
      <ParamSlider
        param={PARAM}
        color={ACCENT_VIOLET}
        explainMode={false}
        onChange={noop}
        {...props}
      />,
    );
  }

  it('gives the hidden range input an accessible name', () => {
    const { getByRole } = renderSlider();
    expect(getByRole('slider', { name: 'BloomIntensity' })).toBeTruthy();
  });

  it('shows a focus ring on the custom thumb while the slider is focused, via --focus-accent', () => {
    const { getByRole, getByTestId } = renderSlider();
    const input = getByRole('slider', { name: 'BloomIntensity' });
    const thumb = getByTestId('pp-param-thumb');

    expect(thumb.style.boxShadow).toBe('');
    fireEvent.focus(input);
    expect(thumb.style.boxShadow).toContain('--focus-accent');
    fireEvent.blur(input);
    expect(thumb.style.boxShadow).toBe('');
  });
});
