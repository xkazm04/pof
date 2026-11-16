import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import type { LootFilterRuleset } from '@/lib/loot-filter/types';
import { rulesetToDataTableJson } from '@/lib/loot-filter/export';
import { hashExportJson } from '@/lib/loot-filter/pipeline';

const fetchArtifactsResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  postArtifact: vi.fn(),
  fetchArtifacts: vi.fn(),
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
}));
vi.mock('@/hooks/usePofBridge', () => ({ usePofBridge: () => ({ isConnected: false }) }));
vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }));

import { ExportPanel } from '@/components/modules/core-engine/sub_inventory/loot-filter/ExportPanel';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const RULESET: LootFilterRuleset = {
  id: 'rs', name: 'Test Filter', updatedAt: '2026-01-01T00:00:00.000Z',
  rules: [{ id: 'a', name: 'Hide Commons', enabled: true, action: 'hide', condition: { rarities: ['Common'] }, style: {} }],
};
const EDITED: LootFilterRuleset = { ...RULESET, rules: [{ ...RULESET.rules[0], enabled: false }] };

function verifiedArtifacts(json: string, withHash: boolean) {
  const row = (step: string, data: Record<string, unknown>) => ({ step, status: 'pass', data, ueAssets: [] });
  return [
    row('datatable', withHash ? { json, jsonHash: hashExportJson(json) } : { json }),
    row('wire', {}),
    row('verify', {}),
  ];
}

describe('Loot filter ExportPanel staleness', () => {
  for (const withHash of [true, false]) {
    it(`shows Stale after the ruleset is edited past a Verified export (hash stored: ${withHash})`, async () => {
      fetchArtifactsResult.mockResolvedValue({ ok: true, data: verifiedArtifacts(rulesetToDataTableJson(RULESET), withHash) });
      const { container, rerender } = render(<ExportPanel ruleset={RULESET} accent="var(--text)" />);
      await waitFor(() => expect(container.textContent).toContain('Verified'));
      expect(container.textContent).not.toContain('Stale');

      rerender(<ExportPanel ruleset={EDITED} accent="var(--text)" />);
      await waitFor(() => expect(container.textContent).toContain('Stale'));
      expect(container.textContent).toContain('Verified · Stale');
    });
  }
});
