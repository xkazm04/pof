import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { LootFilterRuleset } from '@/lib/loot-filter/types';

const postArtifact = vi.fn();
const fetchArtifacts = vi.fn();
const fetchArtifactsResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  postArtifact: (...a: unknown[]) => postArtifact(...a),
  fetchArtifacts: (...a: unknown[]) => fetchArtifacts(...a),
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

function wireButton(container: HTMLElement): HTMLButtonElement {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Wire to UE'))! as HTMLButtonElement;
}

describe('Loot filter ExportPanel generate step', () => {
  it('reports a rejected pipeline write and does not advance the lifecycle', async () => {
    fetchArtifacts.mockResolvedValue([]);
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [] });
    postArtifact.mockResolvedValue({ ok: false, error: 'disk full' });
    const { container, getByText } = render(<ExportPanel ruleset={RULESET} accent="var(--text)" />);
    fireEvent.click(getByText(/generate datatable/i));
    await waitFor(() => expect(container.textContent).toContain('disk full'));
    expect(container.textContent).not.toMatch(/Generated \d+ rows/);
    expect(wireButton(container).disabled).toBe(true);
  });

  it('says the pipeline state is unknown when hydration fails, instead of reading it as Planned', async () => {
    fetchArtifacts.mockResolvedValue([]);
    fetchArtifactsResult.mockResolvedValue({ ok: false, error: 'db locked' });
    const { container } = render(<ExportPanel ruleset={RULESET} accent="var(--text)" />);
    await waitFor(() => expect(container.textContent).toContain('db locked'));
  });

  it('advances to generated when the write is recorded', async () => {
    fetchArtifacts.mockResolvedValue([]);
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [] });
    postArtifact.mockResolvedValue({ ok: true, data: {} });
    const { container, getByText } = render(<ExportPanel ruleset={RULESET} accent="var(--text)" />);
    fireEvent.click(getByText(/generate datatable/i));
    await waitFor(() => expect(container.textContent).toMatch(/Generated \d+ rows/));
    expect(wireButton(container).disabled).toBe(false);
  });
});
