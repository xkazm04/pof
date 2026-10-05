/**
 * Links are editable on the canvas: a click opens the LinkInspector (never a
 * write, never a delete), and one Apply lands direction + required keys + the
 * granting room as ONE write that marks the doc ahead and undoes as one step.
 * Driven through the real LevelDesignView against a fetch spy (the installApi
 * pattern of level-edit-ops.test.tsx).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import { LinkInspector } from '@/components/modules/content/level-design/LevelFlowEditor/LinkInspector';
import type { LevelDesignDocument, RoomNode, UpdateDocPayload } from '@/types/level-design';

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

const room = (id: string, x: number): RoomNode => ({
  id, name: `Room ${id}`, type: 'combat', description: '', encounterDesign: '',
  difficulty: 2, pacing: 'rising', x, y: 100, linkedFiles: [], spawnEntries: [], tags: [],
});

const DOC: LevelDesignDocument = {
  id: 7, name: 'Sunken Crypt', description: '', designNarrative: '',
  rooms: [room('r1', 100), room('r2', 300), room('r3', 500)],
  connections: [
    { id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: true, condition: '' },
    { id: 'c2', fromId: 'r2', toId: 'r3', bidirectional: false, condition: 'Collect the brass key' },
  ],
  difficultyArc: ['r1', 'r2', 'r3'], pacingNotes: '', syncStatus: 'synced', syncReport: [],
  lastGeneratedAt: '2026-09-28 09:00:00', lastCodeHash: 'abc',
  createdAt: '2026-09-28 10:00:00', updatedAt: '2026-09-28 10:00:00',
};

function installApi(): { puts: UpdateDocPayload[] } {
  const puts: UpdateDocPayload[] = [];
  const docs = new Map<number, LevelDesignDocument>([[7, structuredClone(DOC)]]);
  const envelope = (data: unknown) => ({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (String(url).startsWith('/api/level-design')) {
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
  return { puts };
}

async function openDoc() {
  render(<LevelDesignView />);
  await waitFor(() => screen.getByText('Sunken Crypt'));
  fireEvent.click(screen.getByText('Sunken Crypt'));
  await waitFor(() => screen.getByText(/Flow Editor/));
}

const hit = (from: string, to: string) => screen.getByRole('button', { name: new RegExp(`^Link Room ${from} to Room ${to}`) });
const arrowOf = (id: string) => document.querySelector(`[data-link-id="${id}"] [marker-end]`);
const settle = () => new Promise((r) => setTimeout(r, 30));

describe('case 7 — the link inspector', () => {
  it('[guard] a click opens the inspector and writes nothing; a second click never deletes', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.click(hit('r1', 'r2'));
    expect(await screen.findByRole('dialog', { name: 'Link Room r1 to Room r2' })).toBeTruthy();
    fireEvent.click(hit('r1', 'r2'));
    await settle();
    expect(api.puts).toHaveLength(0);
    // Delete stays two-step on the keyboard …
    fireEvent.keyDown(hit('r1', 'r2'), { key: 'Delete' });
    await settle();
    expect(api.puts).toHaveLength(0);
    fireEvent.keyDown(hit('r1', 'r2'), { key: 'Delete' });
    await waitFor(() => expect(api.puts).toHaveLength(1));
    expect(api.puts[0].connections?.map((c) => c.id)).toEqual(['c2']);
  });

  it('[guard] … and inside the inspector', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.click(hit('r1', 'r2'));
    const dialog = await screen.findByRole('dialog', { name: 'Link Room r1 to Room r2' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete link' }));
    await settle();
    expect(api.puts).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(api.puts).toHaveLength(1));
    expect(api.puts[0].connections?.map((c) => c.id)).toEqual(['c2']);
  });

  it('one-way + requires brass-key + grant from r1 -> Apply is exactly 1 PUT; the link draws its direction; undo is 1 PUT', async () => {
    const api = installApi();
    await openDoc();
    expect(arrowOf('c1')).toBeNull();
    expect(arrowOf('c2')).not.toBeNull();

    fireEvent.click(hit('r1', 'r2'));
    const dialog = await screen.findByRole('dialog', { name: 'Link Room r1 to Room r2' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'One-way' }));
    const key = within(dialog).getByLabelText('Add required key');
    fireEvent.change(key, { target: { value: 'Brass Key' } });
    fireEvent.keyDown(key, { key: 'Enter' });
    expect(within(dialog).getByText('brass-key')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Grant keys from'), { target: { value: 'r1' } });
    await settle();
    expect(api.puts).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(api.puts).toHaveLength(1));
    await settle();
    expect(api.puts).toHaveLength(1);
    const put = api.puts[0];
    expect(put.connections?.find((c) => c.id === 'c1')).toMatchObject({ bidirectional: false, requires: ['brass-key'] });
    expect(put.rooms?.find((r) => r.id === 'r1')?.grants).toEqual(['brass-key']);
    expect(put.syncStatus).toBe('doc-ahead');
    expect(arrowOf('c1')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    await waitFor(() => expect(api.puts).toHaveLength(2));
    expect(api.puts[1].connections).toEqual(DOC.connections);
    expect(api.puts[1].rooms).toEqual(DOC.rooms);
  });

  it('Declare gate turns the prose condition into a key and grants it from a picked room in 1 PUT', async () => {
    const api = installApi();
    await openDoc();
    fireEvent.click(hit('r2', 'r3'));
    const dialog = await screen.findByRole('dialog', { name: 'Link Room r2 to Room r3' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Declare gate' }));
    expect(within(dialog).getByText('collect-the-brass-key')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Grant from Room r3' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Grant from Room r2' }));
    await waitFor(() => expect(api.puts).toHaveLength(1));
    expect(api.puts[0].connections?.find((c) => c.id === 'c2')?.requires).toEqual(['collect-the-brass-key']);
    expect(api.puts[0].rooms?.find((r) => r.id === 'r2')?.grants).toEqual(['collect-the-brass-key']);
  });
});

describe('case 6 — the inspector names an orphan key', () => {
  it('renders a required key no room grants as "granted by no room"', () => {
    const graph = {
      rooms: [room('r1', 0), room('r2', 0)],
      connections: [{ id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: false, condition: '', requires: ['ghost-key'] }],
      difficultyArc: ['r1', 'r2'],
    };
    render(
      <LinkInspector
        connection={graph.connections[0]}
        graph={graph}
        getRoomName={(id) => `Room ${id}`}
        onEdit={() => true}
        onClose={() => {}}
      />,
    );
    const chip = screen.getByText('ghost-key').closest('li');
    expect(chip?.textContent).toMatch(/granted by no room/);
  });
});
