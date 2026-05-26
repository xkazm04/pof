import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { STATUS_GLYPH, STATUS_WORD, statusAriaLabel } from '@/components/layout-lab/statusLanguage';
import { PipelineRollup } from '@/components/layout-lab/PipelineRollup';
import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { LIGHT } from '@/components/layout-lab/theme';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const art = (step: string, status: PipelineArtifact['status'], tier?: PipelineArtifact['tier'], reason?: string): PipelineArtifact =>
  ({ catalogId: 'items', entityId: 'e1', step, data: {}, ueAssets: [], status, ...(tier ? { tier } : {}), ...(reason ? { reason } : {}) });

describe('Color-independent status language', () => {
  afterEach(cleanup);

  it('maps every status to a distinct glyph + spoken word (WCAG 1.4.1)', () => {
    // glyphs are unique so status survives grayscale
    const glyphs = Object.values(STATUS_GLYPH);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(STATUS_GLYPH).toEqual({ pass: '✓', fail: '✕', deferred: '⏸', pending: '○' });
    expect(STATUS_WORD.fail).toBe('failed');
    expect(statusAriaLabel('Economy', 'fail', 'L2')).toBe('Economy: failed, tier L2');
    expect(statusAriaLabel('Concept Brief', 'pending')).toBe('Concept Brief: pending');
  });

  it('PipelineRollup chips carry a glyph + aria-label, not color alone', () => {
    const steps = ['Concept Brief', 'Economy', 'Test Gate', 'UE Packaging'];
    const artifacts = [
      art('Concept Brief', 'pass', 'L0'),
      art('Economy', 'fail', 'L2', 'budget overspent by 12 gold'),
      art('Test Gate', 'deferred', 'L3', 'live-UE runner not yet run: FVSGenFireballEffectTest'),
      // 'UE Packaging' intentionally has no artifact → pending
    ];
    render(<PipelineRollup t={LIGHT} steps={steps} artifacts={artifacts} />);

    // Pass / pending chips stay non-interactive (role="img"), so screen readers
    // announce the plain-language label including the tier.
    expect(screen.getByRole('img', { name: 'Concept Brief: passed, tier L0' }).textContent).toContain('✓');
    const pending = screen.getByRole('img', { name: 'UE Packaging: pending' });
    expect(pending.textContent).toContain('○');

    // Failed / deferred chips are *buttons* — they expand to a detail card on
    // click, so they expose the disclosure semantics to AT (aria-expanded).
    const fail = screen.getByRole('button', { name: /Economy: failed, tier L2/ });
    expect(fail.textContent).toContain('✕'); // glyph visible in grayscale
    expect(fail.getAttribute('aria-expanded')).toBe('false');
    const deferred = screen.getByRole('button', { name: /Test Gate: deferred, tier L3/ });
    expect(deferred.textContent).toContain('⏸');
    expect(deferred.getAttribute('aria-expanded')).toBe('false');
  });

  it('failed chip expands to a detail card with the reason, tier, and recovered test name', () => {
    const steps = ['Economy'];
    const artifacts = [art('Economy', 'fail', 'L3', 'FVSEconomyBalanceTest: 2 failed / 5 passed')];
    render(<PipelineRollup t={LIGHT} steps={steps} artifacts={artifacts} />);

    const chip = screen.getByRole('button', { name: /Economy: failed, tier L3/ });
    // The reason starts out hidden — no detail card yet.
    expect(screen.queryByRole('region', { name: /Economy failed details/ })).toBeNull();

    fireEvent.click(chip);

    const region = screen.getByRole('region', { name: /Economy failed details/ });
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(chip.getAttribute('aria-controls')).toBe(region.getAttribute('id'));
    // Reason text surfaced (was previously buried in a native `title` tooltip).
    expect(region.textContent).toContain('FVSEconomyBalanceTest: 2 failed / 5 passed');
    // Test name recovered from the bridge-runner verdict shape.
    expect(within(region).getByText('FVSEconomyBalanceTest')).toBeTruthy();
    // Tier surfaced.
    expect(region.textContent).toContain('L3');

    // Click again to collapse.
    fireEvent.click(chip);
    expect(screen.queryByRole('region', { name: /Economy failed details/ })).toBeNull();
  });

  it('deferred chip expands and recovers the test name from the deferred reason prefix', () => {
    const steps = ['Test Gate'];
    const artifacts = [art('Test Gate', 'deferred', 'L3', 'live-UE runner not yet run: FVSGenFireballEffectTest')];
    render(<PipelineRollup t={LIGHT} steps={steps} artifacts={artifacts} />);

    fireEvent.click(screen.getByRole('button', { name: /Test Gate: deferred, tier L3/ }));
    const region = screen.getByRole('region', { name: /Test Gate deferred details/ });
    expect(within(region).getByText('FVSGenFireballEffectTest')).toBeTruthy();

    // A close button collapses the panel.
    fireEvent.click(within(region).getByRole('button', { name: /close details/i }));
    expect(screen.queryByRole('region', { name: /Test Gate deferred details/ })).toBeNull();
  });

  it('Baseline timeline nodes share the same status language (status in the accessible name)', () => {
    render(<LayoutLab />);
    // The real Items pipeline opens with pending steps; the node button announces the status
    // word so a screen-reader / grayscale user can tell steps apart without relying on color.
    const concept = screen.getByRole('button', { name: /Concept Brief: pending/ });
    expect(concept).toBeTruthy();
    // the ✓ checkmark glyph is reserved for passed nodes — a pending node must not show it
    expect(within(concept).queryByText('✓')).toBeNull();
  });
});
