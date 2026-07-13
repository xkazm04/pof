import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'fx1', name: 'Bramble', lifecycle: 'planned', data: {} };

/** A generic (non-Items) step that FAILS until produced, with a checker reason. */
const failSpec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: () => ({ data: { ok: true } }),
  accept: (data): AcceptanceResult =>
    data.ok
      ? { label: 'Brief present', status: 'pass', tier: 'L0', detail: 'ok' }
      : { label: 'Brief present', status: 'fail', tier: 'L0', detail: 'none', reason: 'no brief authored' },
};

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');

describe('ArchetypeStep generic fix loop', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('renders generic why/suggestion + a Produce-fix button on a failing generic step, and the fix drives it to a terminal pass', async () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={failSpec} />);

    // Non-pass → the plain-language remediation row is present (previously the generic
    // renderer showed none of this) with the checker's own reason surfaced honestly.
    expect(status()).toBe('fail');
    expect(screen.getByTestId('acceptance-explanation').textContent).toContain('no brief authored');
    expect(screen.getByTestId('acceptance-suggestion')).toBeTruthy();

    // The one-click fix dispatches through the step's produce path → terminal pass.
    fireEvent.click(screen.getByTestId('acceptance-produce-fix'));
    await act(async () => {});
    expect(status()).toBe('pass');
    // On pass the banner is clean again (no remediation row).
    expect(screen.queryByTestId('acceptance-explanation')).toBeNull();
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });

  it('a bespoke spec.copy overrides the generic fallback in the banner', () => {
    const withCopy: StepSpec = {
      ...failSpec,
      copy: () => ({ why: 'custom cause', suggestion: 'custom action', fixDirection: 'do the thing' }),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={withCopy} />);
    expect(screen.getByTestId('acceptance-explanation').textContent).toContain('custom cause');
    expect(screen.getByTestId('acceptance-suggestion').textContent).toContain('custom action');
    expect(screen.getByTestId('acceptance-produce-fix')).toBeTruthy();
  });

  it('offers no Produce-fix button on a deferred step (a runtime gate, not locally fixable)', () => {
    const deferredSpec: StepSpec = {
      ...failSpec,
      accept: (): AcceptanceResult => ({ label: 'Runtime gate', status: 'deferred', tier: 'L3', detail: 'awaiting PIE', reason: 'needs live UE' }),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={deferredSpec} />);
    expect(status()).toBe('deferred');
    // The why still explains it (non-pass shows copy) …
    expect(screen.getByTestId('acceptance-explanation').textContent).toContain('deferred to a later gate');
    // … but there is no local produce-fix affordance for a runtime/visual gate.
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });
});
