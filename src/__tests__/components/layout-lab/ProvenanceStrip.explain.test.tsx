import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ProvenanceStrip } from '@/components/layout-lab/steps/shared/ProvenanceStrip';
import { LIGHT } from '@/components/layout-lab/theme';
import { explainAcceptance } from '@/lib/catalog/acceptance/explainAcceptance';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';

/**
 * The chain rides inside the strip's EXISTING "Why this grade?" disclosure — no new panel,
 * no new visual language — and is reconstructed only while that disclosure is open.
 */

const res = (over: Partial<AcceptanceResult> = {}): AcceptanceResult => ({
  label: 'Shape', status: 'pass', tier: 'L0', detail: '', ...over,
});
const checkerOf = (r: AcceptanceResult): Checker => () => r;

afterEach(cleanup);

describe('<ProvenanceStrip /> — explain this verdict', () => {
  it('does not reconstruct the chain until the disclosure is opened', () => {
    const explain = vi.fn(() => explainAcceptance({ step: 'Economy', local: res(), data: {} }));
    const { container } = render(<ProvenanceStrip t={LIGHT} explain={explain} />);

    expect(explain).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="acceptance-chain"]')).toBeNull();

    fireEvent.click(container.querySelector('[data-testid="provenance-why"]') as HTMLElement);
    expect(explain).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="acceptance-chain"]')).not.toBeNull();
  });

  it('renders all three layers in order and marks the one that decided the status', () => {
    const explain = () => explainAcceptance({
      step: 'Test Gate',
      local: res({ status: 'deferred', tier: 'L3' }),
      persisted: { status: 'fail', tier: 'L3', reason: 'gate failed in PIE' },
      data: {},
    });
    const { container } = render(<ProvenanceStrip t={LIGHT} explain={explain} />);
    fireEvent.click(container.querySelector('[data-testid="provenance-why"]') as HTMLElement);

    expect(container.querySelector('[data-testid="chain-layer-checker"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chain-layer-server-overlay"]')?.getAttribute('data-won')).toBe('true');
    expect(container.querySelector('[data-testid="chain-layer-checker"]')?.getAttribute('data-won')).toBeNull();
    expect(container.querySelector('[data-testid="acceptance-chain"]')?.textContent).toContain('decided by server-overlay');
  });

  it('names the allOf member that spoke', () => {
    const composed = allOf(
      checkerOf(res({ label: 'Fields populated' })),
      checkerOf(res({ label: 'Budget within cap', status: 'fail', tier: 'L2', reason: 'price/power 1.43x' })),
    );
    const data = { price: 143 };
    const explain = () => explainAcceptance({ step: 'Economy', local: composed(data), checker: composed, data });

    const { container } = render(<ProvenanceStrip t={LIGHT} explain={explain} />);
    fireEvent.click(container.querySelector('[data-testid="provenance-why"]') as HTMLElement);

    expect(container.querySelector('[data-testid="chain-member-0"]')?.getAttribute('data-spoke')).toBeNull();
    const spoke = container.querySelector('[data-testid="chain-member-1"]') as HTMLElement;
    expect(spoke.getAttribute('data-spoke')).toBe('true');
    expect(spoke.textContent).toContain('Budget within cap');
    expect(spoke.textContent).toContain('price/power 1.43x');
  });

  it('surfaces a verdict whose provenance cannot be confirmed (the honesty chip)', () => {
    const { container } = render(
      <ProvenanceStrip t={LIGHT} judge={{ provenance: 'unknown', verdict: 'fail', score: 41, judge: 'llm', note: 'no content binding' }} />,
    );
    expect(container.textContent).toContain('VERDICT: UNVERIFIED');
  });

  it('a stale verdict reads as STALE, a bound one as CURRENT', () => {
    const { container, rerender } = render(
      <ProvenanceStrip t={LIGHT} judge={{ provenance: 'stale', verdict: 'fail', score: 41, judge: 'llm', note: 'judged older content' }} />,
    );
    expect(container.textContent).toContain('VERDICT: STALE');

    rerender(<ProvenanceStrip t={LIGHT} judge={{ provenance: 'current', verdict: 'fail', score: 41, judge: 'llm', note: 'bound' }} />);
    expect(container.textContent).toContain('VERDICT: CURRENT');
  });

  it('renders no disclosure at all for a bare strip (no fact, no explanation)', () => {
    const { container } = render(<ProvenanceStrip t={LIGHT} />);
    expect(container.querySelector('[data-testid="provenance-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="provenance-strip"]')).not.toBeNull();
  });
});
