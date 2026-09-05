/**
 * A LIVE produce must report the SERVER's verdict, not the fact that the call returned 200.
 *
 * The one produce path that spends real money discarded `outcome`/`status`/`reason` from
 * `POST /api/one-shot/step` and called `produce(...)` unconditionally, so a server-graded
 * `fail` — or a `deferred` the client type could not even name — rendered as `✓ Recorded`.
 * That is precisely "absence must never read as exemption"
 * (ai-registry game-production/catalog-pipeline-authoring): a step nobody accepted looked
 * accepted, at the exact moment the operator had just paid for a model session.
 *
 * Second contract here: "Retry with same prompt" is a TRANSPORT affordance. A verdict is
 * not a failed dispatch — the session already ran and was billed, and the identical prompt
 * would be graded identically — so a graded non-pass offers no retry button.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { LIVE_PRODUCE_KEY, describeProduceOutcome, type OneShotStepResult } from '@/components/layout-lab/labProduceMode';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'e1', name: 'Sword', lifecycle: 'planned', data: {} };

/** A CLI-eligible (`brief`) step — the archetype class the live seam can actually author. */
const spec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: (e) => ({ data: { brief: `${e.name} `.repeat(120) } }),
  accept: minLength('brief', 'Brief ≥ 300 chars', 300),
};

/** Stub the one-shot route with a given server response body. */
function stubOneShot(data: Partial<OneShotStepResult>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: { stepName: 'Concept Brief', artifactData: { brief: 'short' }, ueAssets: [], ...data },
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('describeProduceOutcome (pure projection of the server verdict)', () => {
  const base = { stepName: 'Concept Brief', artifactData: {}, ueAssets: [] };

  it('a pass is recorded', () => {
    expect(describeProduceOutcome({ ...base, outcome: 'pass' }).ok).toBe(true);
  });

  it('a fail carries the server reason and is NOT retryable', () => {
    const out = describeProduceOutcome({ ...base, outcome: 'fail', status: 'fail', tier: 'L2', reason: 'brief 41 / 300 chars' });
    expect(out.ok).toBe(false);
    expect(out.msg).toContain('brief 41 / 300 chars');
    expect(out.msg).toContain('L2');
    expect(out.retryable).toBe(false);
  });

  it('a deferred says deferred — not "failed"', () => {
    const out = describeProduceOutcome({ ...base, outcome: 'deferred', status: 'deferred', tier: 'L3', reason: 'needs a live UE run' });
    expect(out.ok).toBe(false);
    expect(out.msg).toContain('deferred');
    expect(out.msg).toContain('needs a live UE run');
  });

  it('never leaves the reason blank — silence would read as "no problem found"', () => {
    const out = describeProduceOutcome({ ...base, outcome: 'fail' });
    expect(out.msg).toMatch(/no reason/i);
  });
});

describe('ArchetypeStep — live produce surfaces the server verdict', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); localStorage.setItem(LIVE_PRODUCE_KEY, '1'); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

  it('renders the server reason instead of "✓ Recorded" for a graded fail', async () => {
    stubOneShot({ outcome: 'fail', status: 'fail', tier: 'L2', reason: 'brief 41 / 300 chars' });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    const line = await screen.findByTestId('cli-produce-result');
    await waitFor(() => expect(line.textContent).toContain('brief 41 / 300 chars'));
    expect(line.textContent).not.toContain('Recorded');
    expect(line.textContent?.startsWith('✗')).toBe(true);
  });

  it('does the same for a deferred — a Rule-5-legal terminal state, still not a success', async () => {
    stubOneShot({ outcome: 'deferred', status: 'deferred', tier: 'L3', reason: 'runtime gate not run' });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    const line = await screen.findByTestId('cli-produce-result');
    await waitFor(() => expect(line.textContent).toContain('runtime gate not run'));
    expect(line.textContent).not.toContain('Recorded');
  });

  it('offers NO "Retry with same prompt" on a verdict — a retry is a second billed session', async () => {
    stubOneShot({ outcome: 'fail', status: 'fail', tier: 'L2', reason: 'brief too short' });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    await waitFor(() => expect(screen.getByTestId('cli-produce-result').textContent).toContain('brief too short'));
    expect(screen.queryByTestId('cli-produce-retry')).toBeNull();
  });

  it('still offers retry when the DISPATCH itself failed (transport, not verdict)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ success: false, error: 'CLI session timed out' }),
    }));
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    await waitFor(() => expect(screen.getByTestId('cli-produce-result').textContent).toContain('CLI session timed out'));
    expect(screen.getByTestId('cli-produce-retry')).toBeTruthy();
  });

  it('a pass still reads as recorded (the off-state is unchanged)', async () => {
    stubOneShot({ outcome: 'pass', status: 'pass', tier: 'L0', artifactData: { brief: 'x'.repeat(400) } });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    const line = await screen.findByTestId('cli-produce-result');
    await waitFor(() => expect(line.textContent?.startsWith('✓')).toBe(true));
    expect(useLabPipelineStore.getState().byEntity['e1']?.['Concept Brief']?.data.brief).toBe('x'.repeat(400));
  });

  it('adopts what the server persisted even on a fail — the row exists, hiding it would be a second lie', async () => {
    stubOneShot({ outcome: 'fail', status: 'fail', tier: 'L2', reason: 'too short', artifactData: { brief: 'short' } });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} catalogId="items" />);
    fireEvent.click(screen.getByTestId('cli-produce-run'));

    await waitFor(() => expect(useLabPipelineStore.getState().byEntity['e1']?.['Concept Brief']?.data.brief).toBe('short'));
  });
});
