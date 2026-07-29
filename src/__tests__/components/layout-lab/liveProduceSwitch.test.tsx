import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { isLiveProduceEnabled, setLiveProduceEnabled } from '@/components/layout-lab/labProduceMode';
import { minLength, selected } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const entity = { id: 'e1', name: 'Sword', lifecycle: 'planned' as const, data: {} };

/** A CLI-eligible (`brief`) step — the archetype class the live seam can actually author. */
const brief: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: (e) => ({ data: { brief: `${e.name} `.repeat(120) } }),
  accept: minLength('brief', 'Brief ≥ 300 chars', 300),
};

/** A NON-eligible step: live mode would not change its dispatch, so it offers no switch. */
const gallery: StepSpec = {
  archetype: 'gallery', label: 'Icon 2D Art',
  view: { kind: 'gallery', field: 'icon', candidates: 4 },
  produce: () => ({ data: {} }),
  accept: selected('icon', 'Icon chosen'),
};

const artifact = () => useLabPipelineStore.getState().byEntity['e1']?.['Concept Brief'];

describe('live produce switch', () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('defaults to stub, says so at the point of produce, and writes SYNCHRONOUSLY', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={brief} catalogId="items" />);

    expect(screen.getByTestId('cli-produce-mode').getAttribute('data-mode')).toBe('stub');
    expect(screen.getByTestId('cli-produce-mode-toggle').textContent).toContain('Stub');
    expect(screen.getByTestId('cli-produce-run').textContent).not.toContain('LIVE');

    fireEvent.click(screen.getByTestId('cli-produce-run'));
    // No await: the stub write happens inside the click (Rule 5 walker depends on it).
    expect(artifact()?.done).toBe(true);
    // (the panel's judge-verdict read may fire; the CLI seam must not)
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/one-shot/step'))).toBe(false);
  });

  it('the switch turns live produce on, persists it, and is readable', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={brief} catalogId="items" />);
    expect(isLiveProduceEnabled()).toBe(false);

    fireEvent.click(screen.getByTestId('cli-produce-mode-toggle-input'));

    expect(isLiveProduceEnabled()).toBe(true);
    expect(screen.getByTestId('cli-produce-mode').getAttribute('data-mode')).toBe('live');
    // …and the consequence is legible without leaving the panel
    expect(screen.getByTestId('cli-produce-run').textContent).toContain('LIVE');
    expect(screen.getByTestId('cli-produce-mode-toggle').textContent).toContain('spends model budget');

    fireEvent.click(screen.getByTestId('cli-produce-mode-toggle-input'));
    expect(isLiveProduceEnabled()).toBe(false);
  });

  it('a persisted ON mode is reflected by a freshly mounted panel', () => {
    setLiveProduceEnabled(true);
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={brief} catalogId="items" />);
    expect(screen.getByTestId('cli-produce-mode').getAttribute('data-mode')).toBe('live');
  });

  it('producing with the switch ON dispatches the real route and adopts the server artifact', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { outcome: 'pass', stepName: 'Concept Brief', artifactData: { brief: 'server'.repeat(80) }, ueAssets: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={brief} catalogId="items" />);

    fireEvent.click(screen.getByTestId('cli-produce-mode-toggle-input'));
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[0] === '/api/one-shot/step')).toBe(true));
    await waitFor(() => expect(artifact()?.data.brief).toBe('server'.repeat(80)));
  });

  it('offers no switch on a step live mode would not change', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Icon 2D Art" spec={gallery} catalogId="items" />);
    expect(screen.queryByTestId('cli-produce-mode')).toBeNull();
  });
});
