/**
 * `prioritySystems` was collected by the form, typed "from feature matrix", and
 * hardcoded `[]`. This asserts it is now seeded from the matrix — scoped to the
 * active project — shown with the reason, editable, and persisted on the
 * session that gets created.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { NewSessionPanel } from '@/components/modules/game-director/NewSessionPanel';
import { useProjectStore } from '@/stores/projectStore';
import type { CreateSessionPayload, PlaytestSession } from '@/types/game-director';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AGGREGATES = {
  success: true,
  data: {
    modules: [
      { moduleId: 'arpg-combat', total: 10, missing: 3, avgQuality: 41 },
      { moduleId: 'audio', total: 8, missing: 0, avgQuality: 92 },
      { moduleId: 'materials', total: 4, missing: 1, avgQuality: 55 },
      { moduleId: 'arpg-save', total: 0, missing: 0, avgQuality: null },
    ],
  },
};

function stubFetch(payload: unknown, ok = true) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    new Response(JSON.stringify(payload), { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPanel() {
  const created: CreateSessionPayload[] = [];
  const createSession = vi.fn(async (payload: CreateSessionPayload) => {
    created.push(payload);
    return { id: 'gd-1' } as unknown as PlaytestSession;
  });
  render(<NewSessionPanel onCreated={() => {}} createSession={createSession} />);
  return { created };
}

describe('New Session form seeds priority systems from the feature matrix', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectPath: 'C:/Users/kazda/proj' });
  });

  it('pre-fills the weakest modules with their reason, and skips a module with no rows', async () => {
    const fetchMock = stubFetch(AGGREGATES);
    renderPanel();

    await screen.findByText('arpg-combat');
    expect(screen.getByText('3 missing, avg quality 41')).toBeTruthy();
    expect(screen.getByText('materials')).toBeTruthy();
    // avg quality 92 with nothing missing is not a priority; a module with no
    // rows at all is unreviewed, not weak.
    expect(screen.queryByText('audio')).toBeNull();
    expect(screen.queryByText('arpg-save')).toBeNull();

    // The read is ALWAYS scoped to the project.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/feature-matrix/aggregate');
    expect(url).toContain(`projectId=${encodeURIComponent('C:/Users/kazda/proj')}`);
  });

  it('persists the seeded systems (and the project) on the created session', async () => {
    stubFetch(AGGREGATES);
    const { created } = renderPanel();

    await screen.findByText('arpg-combat');
    (screen.getByText('Create Playtest Session').closest('button') as HTMLButtonElement).click();

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].config.prioritySystems).toEqual(['arpg-combat', 'materials']);
    expect(created[0].config.projectId).toBe('C:/Users/kazda/proj');
  });

  it('is editable — deselecting a chip drops it from the created session', async () => {
    stubFetch(AGGREGATES);
    const { created } = renderPanel();

    const chip = (await screen.findByText('arpg-combat')).closest('button') as HTMLButtonElement;
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.click();

    await waitFor(() => expect(chip.getAttribute('aria-pressed')).toBe('false'));
    (screen.getByText('Create Playtest Session').closest('button') as HTMLButtonElement).click();

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].config.prioritySystems).toEqual(['materials']);
  });

  it('says why nothing was pre-filled when there is no active project', async () => {
    useProjectStore.setState({ projectPath: '' });
    stubFetch(AGGREGATES);
    renderPanel();

    expect(screen.getByText(/No active project/)).toBeTruthy();
    expect(screen.queryByText('arpg-combat')).toBeNull();
  });
});
