/**
 * The Evidence modal is the operator's proof surface: it answers "how was this made?".
 * For the 805-of-817 rows measured on 2026-09-04 whose stamp reads `engine:'unknown'`, it
 * printed "produced by: unknown" — a placeholder rendered in the exact slot a producer name
 * goes, which reads as an answer. An absence of measurement must read as an absence.
 *
 * Standard: catalog-pipeline-authoring / absence-must-never-read-as-exemption.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { EvidenceModal } from '@/components/status/EvidenceModal';
import type { StepCell } from '@/lib/status/statusModel';

// This suite has no auto-cleanup (see src/__tests__/setup.ts).
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const cell: StepCell = {
  label: 'Economy',
  engine: 'Code',
  grade: 'trusted',
  counts: { pass: 1, deferred: 0, fail: 0, pending: 0 },
};

function stubArtifact(provenance: Record<string, unknown> | undefined) {
  const row = {
    catalogId: 'items', entityId: 'e1', step: 'Economy',
    data: { brief: 'x', ...(provenance ? { _provenance: provenance } : {}) },
    ueAssets: [], status: 'pass', tier: 'L0', updatedAt: '2026-09-04T00:00:00Z',
  };
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ success: true, data: String(url).includes('judge-verdicts') ? [] : [row] }),
    })));
}

const open = () => render(<EvidenceModal catalogId="items" step="Economy" cell={cell} onClose={vi.fn()} />);

describe('EvidenceModal — the producer line', () => {
  it('renders a legacy unknown engine as an explicit "not recorded"', async () => {
    stubArtifact({ engine: 'unknown', promptVersion: 'q1' });
    open();
    await waitFor(() => expect(screen.getByTestId('evidence-producer')).toBeTruthy());
    const text = screen.getByTestId('evidence-producer').textContent ?? '';
    expect(text).toMatch(/not recorded/i);
    // …and it must not read as a producer NAME.
    expect(text).not.toMatch(/produced by: unknown/i);
  });

  it('says not recorded when the artifact carries no stamp at all', async () => {
    stubArtifact(undefined);
    open();
    await waitFor(() => expect(screen.getByTestId('evidence-producer')).toBeTruthy());
    expect(screen.getByTestId('evidence-producer').textContent ?? '').toMatch(/not recorded/i);
  });

  it('names a real producer when one was recorded', async () => {
    stubArtifact({ engine: 'Claude', model: 'sonnet', effort: 'medium', promptVersion: 'q2' });
    open();
    await waitFor(() => expect(screen.getByTestId('evidence-producer')).toBeTruthy());
    const text = screen.getByTestId('evidence-producer').textContent ?? '';
    expect(text).toMatch(/produced by/i);
    expect(text).toMatch(/Claude/);
    expect(text).toMatch(/sonnet/);
    expect(text).not.toMatch(/not recorded/i);
  });
});
