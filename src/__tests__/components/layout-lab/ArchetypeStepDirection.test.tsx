import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { LIVE_PRODUCE_KEY } from '@/components/layout-lab/labProduceMode';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import { readProduceDirection } from '@/lib/catalog/produceDirection';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const entity = { id: 'e1', name: 'Sword', lifecycle: 'planned' as const, data: {} };

/** A direction-SENSITIVE produce body: proves the typed direction reaches produce(), not
 *  merely that it is stamped alongside a constant payload. */
const spec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: (e, direction) => ({ data: { brief: `${e.name} ${direction ?? ''} `.repeat(120) } }),
  accept: minLength('brief', 'Brief ≥ 300 chars', 300),
};

const artifact = () => useLabPipelineStore.getState().byEntity['e1']?.['Concept Brief'];

describe('ArchetypeStep — direction reaches produce', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('persists the typed direction + built prompt on the artifact, verbatim', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.change(screen.getByTestId('cli-produce-direction'), { target: { value: 'grim, wet stone' } });
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    const stamp = readProduceDirection(artifact()?.data);
    expect(stamp?.direction).toBe('grim, wet stone');
    expect(stamp?.prompt).toContain('grim, wet stone');
    // and it actually STEERED the produce body
    expect(String(artifact()?.data.brief)).toContain('grim, wet stone');
  });

  it('writes synchronously in stub mode (the Rule 5 walker depends on it)', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));
    expect(artifact()?.done).toBe(true); // no await needed
  });

  it('dispatches the real one-shot CLI route when live produce is enabled', async () => {
    localStorage.setItem(LIVE_PRODUCE_KEY, '1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { outcome: 'pass', stepName: 'Concept Brief', artifactData: { brief: 'x'.repeat(400) }, ueAssets: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.change(screen.getByTestId('cli-produce-direction'), { target: { value: 'baroque filigree' } });
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    // Find the dispatch by its route, not by call order: entering live mode also issues a
    // read-only GET for the dispatch plan (which model/effort/cost), and which of the two
    // lands first is not part of this contract.
    const oneShotCall = () =>
      (fetchMock.mock.calls as [string, RequestInit][]).find(([u]) => u === '/api/one-shot/step');
    await waitFor(() => expect(oneShotCall()).toBeDefined());
    const [, init] = oneShotCall()!;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.mode).toBe('cli');
    expect(body.direction).toBe('baroque filigree');
    await waitFor(() => expect(artifact()?.data.brief).toBe('x'.repeat(400)));
    vi.unstubAllGlobals();
  });

  it('reports the reason when the live dispatch fails (Rule 4)', async () => {
    localStorage.setItem(LIVE_PRODUCE_KEY, '1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ success: false, error: 'CLI session timed out' }),
    }));

    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    await waitFor(() => expect(screen.getByTestId('cli-produce-result').textContent).toContain('CLI session timed out'));
    expect(artifact()?.done).not.toBe(true);
    vi.unstubAllGlobals();
  });
});
