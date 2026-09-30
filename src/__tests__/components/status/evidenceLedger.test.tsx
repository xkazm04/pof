/**
 * The evidence modal as an ENTITY LEDGER: it opens on the entity holding the step down, keeps
 * that entity's verdict paired with that entity's proof, reads only that entity's artifacts,
 * and hands off to Item Focus in one click.
 *
 * Before: `useState(0)` opened every multi-entity cell (83 of 91 produced steps) on whatever
 * entity the API returned first, under the CELL-level verdict picked across all entities, after
 * a catalog-wide full-blob GET.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { EvidenceModal } from '@/components/status/EvidenceModal';
import { buildSwimlane, type StepMeta } from '@/lib/status/statusModel';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { StatusVerdictRead } from '@/components/status/statusVerdictSource';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
// StatusDashboard's other tabs are not under test here; stub them so the shell mounts light.
vi.mock('@/components/status/CapabilityView', () => ({ CapabilityView: () => null }));
vi.mock('@/components/status/CategoryView', () => ({ CategoryView: () => null }));
vi.mock('@/components/status/ItemFocusView', () => ({ ItemFocusView: () => null }));
vi.mock('@/components/status/ModelsView', () => ({ ModelsView: () => null }));
// PipelinesView stands in for the modal's hand-off: it forwards exactly what a ledger row does.
vi.mock('@/components/status/PipelinesView', () => ({
  PipelinesView: ({ onFocusEntity }: { onFocusEntity?: (c: string, e: string) => void }) => (
    <button type="button" onClick={() => onFocusEntity?.('cat', 'b')}>ledger focus b</button>
  ),
}));

// This suite has no auto-cleanup (see src/__tests__/setup.ts).
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const STEP: StepMeta = { label: 'Stats', engine: 'Claude' };
const hashOf = (id: string) => stepContentHash({ stats: id });
const row = (entityId: string): ArtifactVerdictRow => ({
  catalogId: 'cat', entityId, step: 'Stats', status: 'pass', tier: 'L0',
  updatedAt: '2026-09-01T00:00:00Z', contentHash: hashOf(entityId),
});
const ROWS = [row('a'), row('b'), row('c')];
const B_FAIL: JudgeVerdict = {
  catalogId: 'cat', entityId: 'b', step: 'Stats', judge: 'llm-panel', verdict: 'fail', score: 41,
  findings: 'canon clash', model: 'sonnet-fixture', rubricVersion: RUBRIC_VERSION, contentHash: hashOf('b'),
};
const A_PASS: JudgeVerdict = { ...B_FAIL, entityId: 'a', verdict: 'pass', score: 88, findings: 'clean', contentHash: hashOf('a') };
const VERDICTS: StatusVerdictRead = { ok: true, all: [B_FAIL, A_PASS], byCatalog: new Map([['cat', [B_FAIL, A_PASS]]]) };
const CELL = buildSwimlane('cat', 'cat', [STEP], ROWS, [B_FAIL, A_PASS]).cells[0];

/** Full rows per entity, served only by the per-entity GET. */
function stubFetch() {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    urls.push(String(url));
    const entity = new URL(String(url), 'http://x').searchParams.get('entityId') ?? '';
    const data = [{ ...row(entity || 'a'), data: { stats: `output of ${entity}` }, ueAssets: [] }];
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data }) });
  }));
  return urls;
}

const open = (onFocusEntity = vi.fn()) =>
  render(<EvidenceModal catalogId="cat" step={STEP} cell={CELL} rows={ROWS} verdicts={VERDICTS} onClose={vi.fn()} onFocusEntity={onFocusEntity} />);

describe('EvidenceModal — entity ledger', () => {
  it('opens on the entity holding the step down, with its own verdict, reading only its artifacts', async () => {
    expect(CELL.grade).toBe('attention');
    const urls = stubFetch();
    open();
    await waitFor(() => expect(screen.getByRole('region', { name: /stored text/i }).textContent).toContain('output of b'));
    expect(screen.getByTestId('ledger-select-b').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('ledger-select-a').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('evidence-verdict').textContent).toContain('41/100');
    expect(screen.getByTestId('evidence-verdict').textContent).toContain('canon clash');
    const artifactGets = urls.filter((u) => u.startsWith('/api/pipeline-artifacts'));
    expect(artifactGets).toEqual(['/api/pipeline-artifacts?catalogId=cat&entityId=b']);
    // The verdicts come from the shared /status read — the modal issues no verdict GET.
    expect(urls.some((u) => u.startsWith('/api/judge-verdicts'))).toBe(false);

    // Selecting another entity swaps verdict AND proof together.
    fireEvent.click(screen.getByTestId('ledger-select-a'));
    await waitFor(() => expect(screen.getByRole('region', { name: /stored text/i }).textContent).toContain('output of a'));
    expect(screen.getByTestId('evidence-verdict').textContent).toContain('88/100');
    expect(screen.getByTestId('evidence-verdict').textContent).not.toContain('canon clash');
  });

  it("'Focus entity' on a ledger row hands the entity to Item Focus", async () => {
    stubFetch();
    const onFocusEntity = vi.fn();
    open(onFocusEntity);
    fireEvent.click(await screen.findByRole('button', { name: 'Focus entity b' }));
    expect(onFocusEntity).toHaveBeenCalledWith('cat', 'b');
  });

  it('StatusDashboard routes the hand-off to /status?entity=cat:b', async () => {
    const { StatusDashboard } = await import('@/components/status/StatusDashboard');
    window.history.pushState(null, '', '/status?tab=pipelines');
    render(<StatusDashboard />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'ledger focus b' })); });
    expect(window.location.search).toBe('?entity=cat:b');
  });
});
