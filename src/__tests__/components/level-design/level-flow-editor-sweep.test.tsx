/**
 * level-flow-editor sweep (night 2026-11-08): the document shell and the flow
 * editor, driven through the real LevelDesignView against a fetch spy (the
 * installApi pattern of level-edit-ops.test.tsx).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import type { LevelDesignDocument, RoomNode } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const room = (id: string, x: number, over: Partial<RoomNode> = {}): RoomNode => ({
  id, name: `Room ${id}`, type: 'combat', description: '', encounterDesign: '',
  difficulty: 2, pacing: 'rising', x, y: 100, linkedFiles: [], spawnEntries: [], tags: [],
  ...over,
});

const DOC: LevelDesignDocument = {
  id: 7,
  name: 'Sunken Crypt',
  description: '',
  designNarrative: '',
  rooms: [room('r1', 100), room('r2', 300)],
  connections: [{ id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: true, condition: '' }],
  difficultyArc: ['r1', 'r2'],
  pacingNotes: '',
  syncStatus: 'unlinked',
  syncReport: [],
  lastGeneratedAt: null,
  lastCodeHash: null,
  createdAt: '2026-09-28 10:00:00',
  updatedAt: '2026-09-28 10:00:00',
};

interface Call { method: string; href: string; body: unknown }

function installApi(docs: LevelDesignDocument[] = [DOC], hold?: Promise<void>) {
  const calls: Call[] = [];
  const store = new Map(docs.map((d) => [d.id, structuredClone(d)]));
  let nextId = 100;
  const envelope = (data: unknown) => ({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (href.startsWith('/api/level-design')) {
      calls.push({ method, href, body });
      if (method === 'GET') return envelope({ docs: [...store.values()] });
      if (method === 'POST') {
        if (hold) await hold;
        const doc = { ...DOC, id: nextId++, name: body.name, rooms: [], connections: [], difficultyArc: [] };
        store.set(doc.id, doc);
        return envelope({ doc });
      }
      if (method === 'PUT') {
        const { id, ...patch } = body;
        const next = { ...store.get(id)!, ...patch };
        store.set(id, next);
        return envelope({ doc: next });
      }
      if (method === 'DELETE') {
        const id = Number(new URL(href, 'http://x').searchParams.get('id'));
        store.delete(id);
        return envelope({ ok: true });
      }
    }
    return envelope({});
  }) as unknown as typeof fetch;
  return { calls, deletes: () => calls.filter((c) => c.method === 'DELETE'), posts: () => calls.filter((c) => c.method === 'POST') };
}

async function openDoc(name = 'Sunken Crypt') {
  render(<LevelDesignView />);
  await waitFor(() => screen.getByText(name));
  fireEvent.click(screen.getByText(name));
  await waitFor(() => screen.getByText(/Flow Editor/));
}

describe('deleting a whole design document is confirmed', () => {
  it('one click on the trash button issues 0 DELETEs; the dialog names the doc and what it removes', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Delete document' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(api.deletes()).toHaveLength(0);

    const confirm = await screen.findByRole('button', { name: 'Delete document permanently' });
    const dialog = confirm.closest('[role="dialog"], [role="alertdialog"]');
    expect(dialog?.textContent).toContain('Sunken Crypt');
    expect(dialog?.textContent).toContain('2 rooms');
    expect(dialog?.textContent).toContain('1 link');

    fireEvent.click(confirm);
    await waitFor(() => expect(api.deletes()).toHaveLength(1));
    expect(api.deletes()[0].href).toContain('id=7');
  });

  it('Cancel leaves the document alone', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Delete document' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(api.deletes()).toHaveLength(0);
  });
});

describe('a room type the editor does not know degrades instead of crashing the canvas', () => {
  it("a stored room typed 'treasure' renders as a node (label 'treasure'), next to a known one", async () => {
    const odd = room('r2', 300, { type: 'treasure' as RoomNode['type'] });
    installApi([{ ...DOC, rooms: [room('r1', 100), odd] }]);
    await openDoc();
    const node = await waitFor(() => {
      const el = document.querySelector('[data-room-node="r2"]');
      if (!el) throw new Error('r2 not rendered');
      return el;
    });
    expect(node.getAttribute('aria-label')).toContain('treasure');
    expect(document.querySelector('[data-room-node="r1"]')).not.toBeNull();
  });
});

describe('creating a document is single-flight', () => {
  it('two Enters while the POST is in flight create ONE document', async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const api = installApi([DOC], hold);
    render(<LevelDesignView />);
    const input = await screen.findByPlaceholderText('New level design...');
    fireEvent.change(input, { target: { value: 'Drowned Abbey' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    release();
    await new Promise((r) => setTimeout(r, 30));
    expect(api.posts()).toHaveLength(1);
  });
});

describe('room titles on the canvas use one case', () => {
  it('a name over 14 chars is truncated AND upper-cased like a short one', async () => {
    installApi([{ ...DOC, rooms: [room('r1', 100, { name: 'Flooded Cathedral Nave' }), room('r2', 300, { name: 'Crypt' })] }]);
    await openDoc();
    const texts = await waitFor(() => {
      const t = Array.from(document.querySelectorAll('[data-room-node] text')).map((e) => e.textContent ?? '');
      if (t.length === 0) throw new Error('no nodes');
      return t;
    });
    expect(texts).toContain('CRYPT');
    expect(texts).toContain('FLOODED CATHED...');
  });
});

describe('the narrative tab names its fields', () => {
  it('each textarea is reachable by its visible label', async () => {
    installApi();
    await openDoc();
    fireEvent.click(screen.getByRole('tab', { name: /Narrative/ }));
    for (const name of ['Level Description', 'Design Narrative', 'Pacing Notes']) {
      expect(screen.getByRole('textbox', { name }).tagName).toBe('TEXTAREA');
    }
  });

  it('the icon-only Create button in the sidebar has a name', async () => {
    installApi();
    render(<LevelDesignView />);
    await screen.findByPlaceholderText('New level design...');
    expect(screen.getByRole('button', { name: 'Create level design' })).toBeTruthy();
  });
});

describe('Add Room never reuses a name already on the canvas', () => {
  it("rooms 'Room 1' + 'Room 3' (Room 2 deleted) -> the new room is not a second 'Room 3'", async () => {
    const api = installApi([{ ...DOC, rooms: [room('r1', 100, { name: 'Room 1' }), room('r3', 300, { name: 'Room 3' })] }]);
    await openDoc();
    fireEvent.click(screen.getByRole('button', { name: /Add Room/ }));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = api.calls.find((c) => c.method === 'PUT')!.body as { rooms: RoomNode[] };
    const names = put.rooms.map((r) => r.name);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
  });
});
