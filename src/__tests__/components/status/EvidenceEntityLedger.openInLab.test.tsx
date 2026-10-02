/**
 * scan-sweep --challenge lab-shell-and-navigation/B — a /status ledger row opens its entity AT
 * its step in the lab. Before: the row held catalog, step and entity, yet its only action was
 * Item Focus inside /status, and the only way back into the lab was a bare `/layout` link to
 * wherever the lab was last left (five blind acts to reach the step being read).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EvidenceEntityLedger } from '@/components/status/EvidenceEntityLedger';
import { cellLedger } from '@/lib/status/cellLedger';
import { labHref } from '@/lib/shell/labRoute';
import { ok } from '@/types/result';
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';

afterEach(cleanup);

const row = (entityId: string): ArtifactVerdictRow => ({
  catalogId: 'items', entityId, step: 'Economy', status: 'pass', tier: 'L0', updatedAt: '2026-09-01T00:00:00Z',
});

describe('EvidenceEntityLedger — Open in lab', () => {
  it('each row links to its entity at the ledger step, through the lab address', () => {
    const ledger = cellLedger({
      catalogId: 'items', step: { label: 'Economy', engine: 'Claude' },
      rows: [row('item-a'), row('item b')], verdicts: ok([]), headless: () => undefined,
    });
    expect(ledger.rows.length).toBe(2);
    render(<EvidenceEntityLedger ledger={ledger} selected={null} onSelect={vi.fn()} />);
    for (const r of ledger.rows) {
      const link = screen.getByRole('link', { name: `Open ${r.entityId} at ${ledger.step} in the lab` });
      expect(link.getAttribute('href')).toBe(labHref({ catalogId: ledger.catalogId, entityId: r.entityId, step: ledger.step, view: 'catalogs' }));
    }
  });
});
