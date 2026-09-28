/**
 * Flow-editor gestures are named ops: ONE write per act, the op decides the
 * sync consequence, removals clean up every reference, and the act can be
 * undone — driven through the real LevelDesignView against a fetch spy
 * (the installApi pattern of level-doc-commits.test.tsx).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import type { LevelDesignDocument, RoomNode, SyncDivergence, UpdateDocPayload } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
// Full-view renders: generous under a loaded parallel suite.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const room = (id: string, x: number): RoomNode => ({
  id, name: `Room ${id}`, type: 'combat', description: '', encounterDesign: '',
  difficulty: 2, pacing: 'rising', x, y: 100, linkedFiles: [], spawnEntries: [], tags: [],
});

const row = (roomId: string): SyncDivergence => ({
  roomId, roomName: `Room ${roomId}`, field: 'difficulty', docValue: '2', codeValue: '3',
  severity: 'warning', suggestion: 'align the difficulty',
});

const DOC: LevelDesignDocument = {
  id: 7,
  name: 'Sunken Crypt',
  description: '',
  designNarrative: '',
  rooms: [room('r1', 100), room('r2', 300), room('r3', 500)],
  connections: [{ id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: true, condition: '' }],
  difficultyArc: ['r1', 'r2', 'r3'],
  pacingNotes: '',
  syncStatus: 'synced',
  syncReport: [row('r2'), row('r3')],
  lastGeneratedAt: '2026-09-28 09:00:00',
  lastCodeHash: 'abc',
  createdAt: '2026-09-28 10:00:00',
  updatedAt: '2026-09-28 10:00:00',
};

const OTHER: LevelDesignDocument = { ...DOC, id: 8, name: 'Other Keep', rooms: [room('k1', 100)], connections: [], difficultyArc: [], syncReport: [] };

interface ApiSpy { puts: UpdateDocPayload[]; current: () => LevelDesignDocument }

function installApi(): ApiSpy {
  const puts: UpdateDocPayload[] = [];
  const docs = new Map<number, LevelDesignDocument>([
    [7, structuredClone(DOC)],
    [8, structuredClone(OTHER)],
  ]);
  const envelope = (data: unknown) => ({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (href.startsWith('/api/level-design')) {
      if (method === 'GET') return envelope({ docs: [...docs.values()] });
      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as UpdateDocPayload;
        puts.push(body);
        const { id, ...patch } = body;
        const next = { ...docs.get(id)!, ...patch } as LevelDesignDocument;
        docs.set(id, next);
        return envelope({ doc: next });
      }
    }
    return envelope({});
  }) as unknown as typeof fetch;
  return { puts, current: () => docs.get(7)! };
}

async function openDoc() {
  render(<LevelDesignView />);
  await waitFor(() => screen.getByText('Sunken Crypt'));
  fireEvent.click(screen.getByText('Sunken Crypt'));
  await waitFor(() => screen.getByText(/Flow Editor/));
}

function node(id: string): SVGGElement {
  const el = document.querySelector<SVGGElement>(`[data-room-node="${id}"]`);
  if (!el) throw new Error(`room node ${id} not rendered`);
  return el;
}
const canvas = (): SVGSVGElement => node('r1').ownerSVGElement!;
const undoButton = () => screen.getByRole('button', { name: /^Undo/ }) as HTMLButtonElement;
const redoButton = () => screen.getByRole('button', { name: /^Redo/ }) as HTMLButtonElement;
const nodeX = (id: string) => Number(/translate\(([-\d.]+),/.exec(node(id).getAttribute('transform') ?? '')?.[1] ?? NaN);
const settle = () => new Promise((r) => setTimeout(r, 30));

async function deleteR2(api: ApiSpy) {
  fireEvent.keyDown(node('r2'), { key: 'Delete' });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete room' }));
  await waitFor(() => expect(api.puts).toHaveLength(1));
}

describe('room delete is one op', () => {
  it('writes ONE PUT that prunes links, arc and sync rows and marks the doc ahead', async () => {
    const api = installApi();
    await openDoc();
    await deleteR2(api);
    await settle();
    expect(api.puts).toHaveLength(1);
    const put = api.puts[0];
    expect(put.rooms?.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(put.connections).toEqual([]);
    expect(put.difficultyArc).toEqual(['r1', 'r3']);
    expect(put.syncReport?.map((r) => r.roomId)).toEqual(['r3']);
    expect(put.syncStatus).toBe('doc-ahead');
  });
});

describe('link add carries its own sync consequence', () => {
  it('L on r1 then Enter on r3 on a synced doc -> 1 PUT with syncStatus doc-ahead', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.keyDown(node('r1'), { key: 'l' });
    fireEvent.keyDown(node('r3'), { key: 'Enter' });
    await waitFor(() => expect(api.puts).toHaveLength(1));
    await settle();
    expect(api.puts).toHaveLength(1);
    expect(api.puts[0].syncStatus).toBe('doc-ahead');
    expect(api.puts[0].connections?.some((c) => c.fromId === 'r1' && c.toId === 'r3')).toBe(true);
  });
});

describe('undo / redo', () => {
  it('Ctrl+Z restores the deleted room in 1 PUT, Ctrl+Shift+Z re-deletes, a new edit clears redo', async () => {
    const api = installApi();
    await openDoc();
    await deleteR2(api);

    fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });
    await waitFor(() => expect(api.puts).toHaveLength(2));
    const undo = api.puts[1];
    expect(undo.rooms).toEqual(DOC.rooms);
    expect(undo.connections).toEqual(DOC.connections);
    expect(undo.difficultyArc).toEqual(DOC.difficultyArc);
    expect(undo.syncReport).toEqual(DOC.syncReport);
    expect(undo.syncStatus === undefined || undo.syncStatus === 'doc-ahead').toBe(true);
    expect(api.current().syncStatus).toBe('doc-ahead');

    fireEvent.keyDown(canvas(), { key: 'Z', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(api.puts).toHaveLength(3));
    expect(api.puts[2].rooms?.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(api.puts[2].syncReport?.map((r) => r.roomId)).toEqual(['r3']);

    fireEvent.click(undoButton());
    await waitFor(() => expect(api.puts).toHaveLength(4));
    expect(redoButton().disabled).toBe(false);
    // A new edit after an undo forks history: redo is gone.
    fireEvent.keyDown(node('r1'), { key: 'l' });
    fireEvent.keyDown(node('r3'), { key: 'Enter' });
    await waitFor(() => expect(api.puts).toHaveLength(5));
    expect(redoButton().disabled).toBe(true);
    expect(api.puts.every((p) => p.syncStatus !== 'synced')).toBe(true);
  });
});

describe('gesture coalescing — one history entry per gesture', () => {
  it('a 12-frame drag is 1 entry; undo returns r1 to its pre-drag x/y in 1 PUT', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.mouseDown(node('r1'), { clientX: 140, clientY: 140 });
    for (let i = 1; i <= 12; i++) fireEvent.mouseMove(canvas(), { clientX: 140 + i * 5, clientY: 140 });
    expect(api.puts).toHaveLength(0);
    fireEvent.mouseUp(canvas());
    await waitFor(() => expect(api.puts).toHaveLength(1));
    expect(undoButton().getAttribute('data-undo-depth')).toBe('1');

    fireEvent.click(undoButton());
    await waitFor(() => expect(api.puts).toHaveLength(2));
    expect(api.puts[1].rooms?.find((r) => r.id === 'r1')).toMatchObject({ x: 100, y: 100 });
    expect(nodeX('r1')).toBe(100);
    expect(undoButton().disabled).toBe(true);
  });

  it('20 debounced keystrokes in RoomDetailPanel are 1 entry; undo restores the description in 1 PUT', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.mouseDown(node('r1'), { clientX: 140, clientY: 140 });
    fireEvent.mouseUp(canvas());
    const find = () => screen.getByPlaceholderText('Aesthetics and narrative role...') as HTMLTextAreaElement;
    await waitFor(() => find());
    const text = 'Flooded nave, ambush';
    expect(text).toHaveLength(20);
    for (const ch of text) {
      const el = find();
      fireEvent.change(el, { target: { value: el.value + ch } });
    }
    await waitFor(() => expect(api.puts).toHaveLength(1), { timeout: 3000 });
    expect(api.puts[0].rooms?.[0].description).toBe(text);
    expect(undoButton().getAttribute('data-undo-depth')).toBe('1');

    fireEvent.click(undoButton());
    await waitFor(() => expect(api.puts).toHaveLength(2));
    expect(api.puts[1].rooms?.[0].description).toBe('');
    expect(find().value).toBe('');
    expect(undoButton().disabled).toBe(true);
  });

  it('5 held-arrow nudges on r1 are 1 entry; undo restores the position in 1 PUT', async () => {
    const api = installApi();
    await openDoc();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(node('r1'), { key: 'ArrowRight', shiftKey: true });
    const moved = nodeX('r1');
    expect(moved).toBeGreaterThan(100);
    await waitFor(() => expect(api.puts).toHaveLength(1), { timeout: 3000 });
    expect(api.puts[0].rooms?.[0].x).toBe(moved);
    expect(undoButton().getAttribute('data-undo-depth')).toBe('1');

    fireEvent.click(undoButton());
    await waitFor(() => expect(api.puts).toHaveLength(2));
    expect(api.puts[1].rooms?.[0].x).toBe(100);
    expect(undoButton().disabled).toBe(true);
  });
});

describe('history is per document and bounded', () => {
  it('switching documents empties undo', async () => {
    const api = installApi();
    await openDoc();
    await deleteR2(api);
    expect(undoButton().disabled).toBe(false);
    fireEvent.click(screen.getByText('Other Keep'));
    await waitFor(() => node('k1'));
    expect(undoButton().disabled).toBe(true);
  });

  it('every committed op is one undo step (the 50-step cap itself is proven on the same history in level-edit.test.ts)', async () => {
    const api = installApi();
    await openDoc();
    // link r1-r3, then the two-step unlink, then link again = 3 committed ops.
    fireEvent.keyDown(node('r1'), { key: 'l' });
    fireEvent.keyDown(node('r3'), { key: 'Enter' });
    const link = () => screen.getByRole('button', { name: /^Link Room r1 to Room r3/ });
    fireEvent.click(link());
    fireEvent.click(link());
    fireEvent.keyDown(node('r1'), { key: 'l' });
    fireEvent.keyDown(node('r3'), { key: 'Enter' });
    await waitFor(() => expect(api.puts).toHaveLength(3));
    expect(undoButton().getAttribute('data-undo-depth')).toBe('3');
  });

  it('the delete confirm no longer claims the delete cannot be undone', async () => {
    installApi();
    await openDoc();
    fireEvent.keyDown(node('r2'), { key: 'Delete' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).not.toMatch(/can't be undone/i);
    expect(dialog.textContent).toMatch(/undo/i);
  });
});
