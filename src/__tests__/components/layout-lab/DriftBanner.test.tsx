import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { DriftBanner } from '@/components/layout-lab/DriftBanner';
import { LIGHT } from '@/components/layout-lab/theme';
import type { StepDrift } from '@/components/layout-lab/hooks/useEntityArtifacts';

afterEach(cleanup);

const drift: StepDrift = { kind: 'status', local: 'pass', server: 'fail' };

describe('DriftBanner', () => {
  it('names both verdicts in words (not hue-only) and offers adoption', () => {
    const { getByTestId } = render(
      <DriftBanner t={LIGHT} step="Economy" drift={drift} hasHistory={false} onAdopt={() => {}} />,
    );
    const banner = getByTestId('drift-banner');
    expect(banner.getAttribute('data-step')).toBe('Economy');
    expect(banner.textContent).toContain('passed');
    expect(banner.textContent).toContain('failed');
    expect(getByTestId('drift-adopt')).toBeTruthy();
  });

  it('adopts server truth preserving history by default (no replace flag)', () => {
    const onAdopt = vi.fn();
    const { getByTestId } = render(
      <DriftBanner t={LIGHT} step="Economy" drift={drift} hasHistory onAdopt={onAdopt} />,
    );
    fireEvent.click(getByTestId('drift-adopt'));
    expect(onAdopt).toHaveBeenCalledWith(undefined); // preserve history
  });

  it('passes replaceHistory:true only after the user checks the confirmation', () => {
    const onAdopt = vi.fn();
    const { getByTestId } = render(
      <DriftBanner t={LIGHT} step="Economy" drift={drift} hasHistory onAdopt={onAdopt} />,
    );
    fireEvent.click(getByTestId('drift-replace-history'));
    fireEvent.click(getByTestId('drift-adopt'));
    expect(onAdopt).toHaveBeenCalledWith({ replaceHistory: true });
  });

  it('says CONTENT (not a verdict contradiction) when only the produced data differs', () => {
    // The verdicts agree here — phrasing it as "local reads X, server has Y" would invent a
    // contradiction that does not exist and hide the real news.
    const content: StepDrift = { kind: 'content', local: 'pass', server: 'pass' };
    const { getByTestId } = render(
      <DriftBanner t={LIGHT} step="Economy" drift={content} hasHistory={false} onAdopt={() => {}} />,
    );
    const banner = getByTestId('drift-banner');
    expect(banner.textContent).toContain('Server CONTENT differs');
    expect(banner.textContent).not.toContain('local reads');
    expect(getByTestId('drift-adopt')).toBeTruthy(); // adoption is still the reconciliation
  });

  it('hides the replace-history control when the step has no candidate archive', () => {
    const { queryByTestId } = render(
      <DriftBanner t={LIGHT} step="Economy" drift={drift} hasHistory={false} onAdopt={() => {}} />,
    );
    expect(queryByTestId('drift-replace-history')).toBeNull();
  });
});
