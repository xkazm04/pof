/**
 * The calibration bench's label bar — the operator labels the artifact they are LOOKING AT in the
 * /status Evidence modal, bound to its content hash. The judge's band stays hidden until the human
 * has labelled (anchoring), and progress toward the enforcement floor is split by band so a
 * lopsided set is visible before an Opus run is spent.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { CalibrationLabelBar } from '@/components/status/CalibrationLabelBar';
import { EvidenceModal } from '@/components/status/EvidenceModal';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { StepCell } from '@/lib/status/statusModel';
import type { StatusVerdictRead } from '@/components/status/statusVerdictSource';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const DATA = { glbUrl: '/api/asset/items/item-1/sword.glb' };

function bench(cell: Record<string, unknown>, byBand = { fail: 2, placeholder: 2, shippable: 0 }) {
  return {
    targets: [], excluded: [], standing: 'provisional', message: 'PROVISIONAL — …',
    progress: { confirmed: byBand.fail + byBand.placeholder + byBand.shippable, needed: 10, byBand },
    cell: { label: null, issue: null, judge: null, rubric: { cls: '3d-mesh', dimensions: ['silhouette', 'topology'], bands: { shippable: 90, placeholder: 70 } }, ...cell },
  };
}

function stub(reads: unknown[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const data = init?.method === 'POST' ? { ok: true } : reads[Math.min(i++, reads.length - 1)];
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data }) });
  }));
  return calls;
}

const mount = () => render(<CalibrationLabelBar catalogId="items" entityId="item-1" step="3D Mesh" data={DATA} />);

describe('CalibrationLabelBar', () => {
  it('shows progress by band and flags an empty band, with no judge band before labelling', async () => {
    stub([bench({ judge: { band: 'fail', score: 41 } })]);
    mount();
    await waitFor(() => expect(screen.getByTestId('calibration-progress').textContent).toMatch(/4 of 10 confirmed/));
    expect(screen.getByTestId('calibration-progress').textContent).toMatch(/shippable 0/);
    expect(screen.getByText(/no shippable label yet/i)).toBeTruthy();
    expect(screen.queryByTestId('calibration-judge')).toBeNull();
    expect(screen.getByText(/silhouette/)).toBeTruthy();
  });

  it('a click POSTs the band bound to the content the operator is looking at', async () => {
    const labelled = bench({ label: { label: 'shippable' } });
    const calls = stub([bench({}), labelled]);
    mount();
    const btn = await screen.findByRole('button', { name: /shippable/i });
    fireEvent.click(btn);
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true));
    const sent = JSON.parse(String(calls.find((c) => c.init?.method === 'POST')!.init!.body));
    expect(sent).toMatchObject({ catalogId: 'items', entityId: 'item-1', step: '3D Mesh', label: 'shippable', contentHash: stepContentHash(DATA) });
    await waitFor(() => expect(screen.getByRole('button', { name: /shippable/i }).getAttribute('aria-pressed')).toBe('true'));
  });

  it('after labelling shows the last run band and names a disagreement', async () => {
    stub([bench({ label: { label: 'placeholder' }, judge: { band: 'fail', score: 41 } })]);
    mount();
    await waitFor(() => expect(screen.getByTestId('calibration-judge').textContent).toMatch(/fail \(41\).*disagree/i));
  });

  it('says a label is stale when the content moved since it was given', async () => {
    stub([bench({ label: { label: 'placeholder' }, issue: 'content changed since it was labelled' })]);
    mount();
    await waitFor(() => expect(screen.getByText(/stale: content changed since it was labelled/i)).toBeTruthy());
  });
});

describe('EvidenceModal mounts the bar under the stored output', () => {
  it('renders the calibration bar once an artifact is shown', async () => {
    const row = { catalogId: 'items', entityId: 'item-1', step: '3D Mesh', data: { note: 'x' }, ueAssets: [], status: 'pass', tier: 'L1' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ success: true, data: String(url).includes('judge-calibration') ? bench({}) : [row] }),
    })));
    const cell: StepCell = { label: '3D Mesh', engine: 'Tripo', grade: 'trusted', counts: { pass: 1, deferred: 0, fail: 0, pending: 0 } };
    const noVerdicts: StatusVerdictRead = { ok: true, all: [], byCatalog: new Map() };
    render(<EvidenceModal catalogId="items" step={{ label: '3D Mesh', engine: 'Tripo' }} cell={cell}
      rows={[{ catalogId: 'items', entityId: 'item-1', step: '3D Mesh', status: 'pass', tier: 'L1' }]} verdicts={noVerdicts} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('calibration-label-bar')).toBeTruthy());
  });
});
