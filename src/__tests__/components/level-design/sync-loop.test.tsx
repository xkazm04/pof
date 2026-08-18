/**
 * The sync loop, end to end: CLI callback → validated route → document → panel.
 *
 * `code-ahead` and `diverged` had full UI and types but no producer — nothing in
 * the app could ever write them, so the panel branches were dead code. This
 * suite drives a real payload through the real route and asserts the panel
 * renders the state it produced, and that a document nobody has ever compared
 * says so instead of claiming it is synced.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/level-design/sync-result/route';
import { createDoc, getDoc } from '@/lib/level-design-db';
import { SyncStatusPanel, resolveSyncPresentation } from '@/components/modules/content/level-design/SyncStatusPanel';
import { adoptCodeValue } from '@/lib/level-design/reconcile';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { LevelDesignDocument, RoomNode, SyncDivergence } from '@/types/level-design';

afterEach(cleanup);

const ROOM: RoomNode = {
  id: 'room-1',
  name: 'Crypt Antechamber',
  type: 'combat',
  description: '',
  encounterDesign: '',
  difficulty: 3,
  pacing: 'rising',
  x: 0,
  y: 0,
  linkedFiles: [],
  spawnEntries: [],
  tags: [],
};

async function reportSync(docId: number, body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest('http://localhost/api/level-design/sync-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, ...body }),
    }),
  );
  return { status: res.status, json: await res.json() };
}

function renderPanel(doc: LevelDesignDocument, handlers: Partial<{ onAdoptCode: (d: SyncDivergence) => void; onReconcile: (d: SyncDivergence) => void }> = {}) {
  return render(
    <SyncStatusPanel
      syncStatus={doc.syncStatus}
      divergences={doc.syncReport}
      lastCodeHash={doc.lastCodeHash}
      onCheckSync={vi.fn()}
      onReconcile={handlers.onReconcile ?? vi.fn()}
      onAdoptCode={handlers.onAdoptCode ?? vi.fn()}
      isChecking={false}
      accentColor={ACCENT_VIOLET}
    />,
  );
}

describe('a divergence payload from the CLI reaches the panel', () => {
  it('renders "Diverged" and the field-level rows the report carried', async () => {
    const doc = createDoc({ name: `loop-diverged-${Math.random()}`, description: '' });
    const { status } = await reportSync(doc.id, {
      status: 'diverged',
      codeHash: 'f00ba12',
      divergences: [
        {
          roomId: 'room-1',
          roomName: 'Crypt Antechamber',
          field: 'difficulty',
          docValue: '3',
          codeValue: '5',
          severity: 'critical',
          suggestion: 'Lower DifficultyTier to 3.',
        },
      ],
    });
    expect(status).toBe(201);

    const { getByTestId } = renderPanel(getDoc(doc.id)!);

    expect(getByTestId('sync-status-badge').textContent).toMatch(/Diverged/);
    const list = getByTestId('sync-adopt-room-1-difficulty').closest('#sync-divergence-list') as HTMLElement;
    expect(list.textContent).toMatch(/Crypt Antechamber/);
    expect(list.textContent).toMatch(/Lower DifficultyTier to 3\./);
    expect(getByTestId('sync-last-checked').textContent).toMatch(/f00ba12/);
    // Both reconcile directions are offered AND named.
    expect(getByTestId('sync-adopt-room-1-difficulty')).toBeTruthy();
    expect(getByTestId('sync-fix-room-1-difficulty')).toBeTruthy();
    const legend = getByTestId('sync-reconcile-legend').textContent ?? '';
    expect(legend).toMatch(/Adopt code/);
    expect(legend).toMatch(/Fix code/);
  });

  it('renders "Code Ahead" for a code-ahead verdict', async () => {
    const doc = createDoc({ name: `loop-code-ahead-${Math.random()}`, description: '' });
    await reportSync(doc.id, {
      status: 'code-ahead',
      codeHash: 'c0de',
      divergences: [
        {
          roomId: 'room-1',
          roomName: 'Crypt Antechamber',
          field: 'encounterDesign',
          docValue: '',
          codeValue: 'A third wave of archers spawns on the balcony.',
          severity: 'info',
          suggestion: 'Write the third wave into the doc.',
        },
      ],
    });

    const { getByTestId } = renderPanel(getDoc(doc.id)!);
    expect(getByTestId('sync-status-badge').textContent).toMatch(/Code Ahead/);
  });

  it('a malformed payload is rejected with a reason and the panel keeps the previous verdict', async () => {
    const doc = createDoc({ name: `loop-reject-${Math.random()}`, description: '' });
    await reportSync(doc.id, { status: 'code-ahead', codeHash: 'good1', divergences: [] });

    const bad = await reportSync(doc.id, { status: 'synced', codeHash: '', divergences: [] });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/codeHash/);

    const { getByTestId } = renderPanel(getDoc(doc.id)!);
    expect(getByTestId('sync-status-badge').textContent).toMatch(/Code Ahead/);
    expect(getByTestId('sync-last-checked').textContent).toMatch(/good1/);
  });
});

describe('never checked is not synced', () => {
  it('a doc whose code was generated but never compared reads "Never checked"', () => {
    // This is exactly what codegen leaves behind: syncStatus synced, no hash.
    const doc = { ...getDoc(createDoc({ name: `never-${Math.random()}`, description: '' }).id)!, syncStatus: 'synced' as const };
    const { getByTestId } = renderPanel(doc);

    expect(getByTestId('sync-status-badge').textContent).toMatch(/Never checked/);
    expect(getByTestId('sync-status-badge').textContent).not.toMatch(/Synced/);
    expect(getByTestId('sync-last-checked').textContent).toMatch(/Never compared/);
    expect(getByTestId('sync-empty-copy').textContent).toMatch(/No comparison has run/);
  });

  it('the same doc reads "Synced" once a comparison has actually recorded a hash', async () => {
    const created = createDoc({ name: `checked-${Math.random()}`, description: '' });
    await reportSync(created.id, { status: 'synced', codeHash: 'aa11bb', divergences: [] });

    const { getByTestId } = renderPanel(getDoc(created.id)!);
    expect(getByTestId('sync-status-badge').textContent).toMatch(/Synced/);
    expect(getByTestId('sync-empty-copy').textContent).toMatch(/in sync/);
  });

  it('resolveSyncPresentation only degrades the reassuring status', () => {
    expect(resolveSyncPresentation('synced', null).label).toBe('Never checked');
    expect(resolveSyncPresentation('synced', 'h').label).toBe('Synced');
    expect(resolveSyncPresentation('doc-ahead', null).label).toBe('Doc Ahead');
    expect(resolveSyncPresentation('unlinked', null).label).toBe('Unlinked');
  });
});

describe('adopt code — the doc-adopts-code direction of reconcile', () => {
  const base: LevelDesignDocument = {
    id: 1,
    name: 'Crypt',
    description: '',
    designNarrative: '',
    rooms: [ROOM],
    connections: [],
    difficultyArc: [],
    pacingNotes: '',
    syncStatus: 'diverged',
    syncReport: [],
    lastGeneratedAt: null,
    lastCodeHash: 'h1',
    createdAt: '',
    updatedAt: '',
  };

  const div = (over: Partial<SyncDivergence> = {}): SyncDivergence => ({
    roomId: 'room-1',
    roomName: 'Crypt Antechamber',
    field: 'difficulty',
    docValue: '3',
    codeValue: '5',
    severity: 'warning',
    suggestion: '',
    ...over,
  });

  it('writes the code value onto the room and drops the row from the report', () => {
    const d = div();
    const doc = { ...base, syncReport: [d, div({ field: 'pacing', docValue: 'rising', codeValue: 'peak' })] };
    const result = adoptCodeValue(doc, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rooms[0].difficulty).toBe(5);
    expect(result.data.syncReport).toHaveLength(1);
    expect(result.data.syncReport[0].field).toBe('pacing');
  });

  it.each([
    ['pacing', 'peak', (r: RoomNode) => r.pacing],
    ['type', 'boss', (r: RoomNode) => r.type],
    ['Room Name', 'Flooded Nave', (r: RoomNode) => r.name],
    ['linkedFiles', 'A.cpp, B.cpp', (r: RoomNode) => r.linkedFiles.join('|')],
  ])('adopts %s', (field, codeValue, read) => {
    const result = adoptCodeValue(base, div({ field, codeValue }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(String(read(result.data.rooms[0]))).toBe(codeValue === 'A.cpp, B.cpp' ? 'A.cpp|B.cpp' : codeValue);
  });

  it('REFUSES a field the document does not have, naming it', () => {
    const result = adoptCodeValue(base, div({ field: 'spawnCount', docValue: '5', codeValue: '3' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no single "spawnCount" field/);
    expect(result.error).toMatch(/Fix code/);
  });

  it('REFUSES an out-of-range value rather than writing nonsense', () => {
    const result = adoptCodeValue(base, div({ codeValue: '11' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/difficulty between 1 and 5/);
  });

  it('REFUSES a room that is no longer in the document', () => {
    const result = adoptCodeValue(base, div({ roomId: 'room-gone', roomName: 'Ghost' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no longer in this design document/);
  });

  it('the panel wires each button to its own direction', () => {
    const onAdoptCode = vi.fn();
    const onReconcile = vi.fn();
    const d = div();
    const { getByTestId } = renderPanel({ ...base, syncReport: [d] }, { onAdoptCode, onReconcile });

    fireEvent.click(getByTestId('sync-adopt-room-1-difficulty'));
    expect(onAdoptCode).toHaveBeenCalledWith(d);
    expect(onReconcile).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('sync-fix-room-1-difficulty'));
    expect(onReconcile).toHaveBeenCalledWith(d);
  });

  it('names the room and field on both buttons (N identical buttons otherwise)', () => {
    const d = div();
    const { getByTestId } = renderPanel({ ...base, syncReport: [d] });
    const list = getByTestId('sync-adopt-room-1-difficulty').closest('#sync-divergence-list')!;
    const adopt = within(list as HTMLElement).getByLabelText(/Adopt the code value for difficulty on Crypt Antechamber/);
    const fix = within(list as HTMLElement).getByLabelText(/Fix the C\+\+ so difficulty on Crypt Antechamber/);
    expect(adopt).toBeTruthy();
    expect(fix).toBeTruthy();
  });
});
