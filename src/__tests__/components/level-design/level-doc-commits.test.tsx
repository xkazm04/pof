/**
 * Level-design editing writes COMMITS, not keystrokes.
 *
 * Before this suite's fix every edit event was a PUT followed by a full re-GET
 * (`useDesignDocument.update` → `fetchAll`), and `fetchAll` raised `isLoading`,
 * which unmounted the whole editor. So a node drag wrote once per mouse-move, a
 * typed sentence wrote once per character, each write blanked the view, and the
 * controlled textarea was re-fed a value one round trip behind the cursor.
 *
 * Each test here measures the two numbers that matter separately: how many EDIT
 * EVENTS the UI received (the old write count) and how many WRITES actually
 * reached the server.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import type { LevelDesignDocument, RoomNode, UpdateDocPayload } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

// jsdom has no ResizeObserver; the tab bar's overflow watcher needs one to mount.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const ROOM: RoomNode = {
  id: 'r1',
  name: 'Entry Hall',
  type: 'combat',
  description: '',
  encounterDesign: '',
  difficulty: 2,
  pacing: 'rising',
  x: 100,
  y: 100,
  linkedFiles: [],
  spawnEntries: [],
  tags: [],
};

const DOC: LevelDesignDocument = {
  id: 7,
  name: 'Sunken Crypt',
  description: '',
  designNarrative: '',
  rooms: [ROOM],
  connections: [],
  difficultyArc: [],
  pacingNotes: '',
  syncStatus: 'synced',
  syncReport: [],
  lastGeneratedAt: null,
  lastCodeHash: null,
  createdAt: '2026-08-18 10:00:00',
  updatedAt: '2026-08-18 10:00:00',
};

interface ApiSpy {
  gets: number;
  puts: UpdateDocPayload[];
}

/**
 * A level-design API whose PUT is slow and/or broken on demand — the delay is
 * what exposes an editor that renders server echoes instead of local state.
 */
function installApi(opts: { putDelayMs?: number; putFails?: boolean } = {}): ApiSpy {
  const spy: ApiSpy = { gets: 0, puts: [] };
  let current: LevelDesignDocument = { ...DOC, rooms: [{ ...ROOM }] };

  const envelope = (data: unknown, ok = true) => ({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(ok ? { success: true, data } : { success: false, error: 'server unavailable' }),
    text: () => Promise.resolve(''),
  });

  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (href.startsWith('/api/level-design')) {
      if (method === 'GET') {
        spy.gets++;
        return envelope({ docs: [current] });
      }
      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as UpdateDocPayload;
        spy.puts.push(body);
        if (opts.putDelayMs) await new Promise((r) => setTimeout(r, opts.putDelayMs));
        if (opts.putFails) return envelope(null, false);
        const { id: _id, ...patch } = body;
        current = { ...current, ...patch } as LevelDesignDocument;
        return envelope({ doc: current });
      }
    }
    // Anything else the module shell touches is irrelevant here.
    return envelope({});
  }) as unknown as typeof fetch;

  return spy;
}

async function openDoc() {
  render(<LevelDesignView />);
  await waitFor(() => screen.getByText('Sunken Crypt'));
  fireEvent.click(screen.getByText('Sunken Crypt'));
  await waitFor(() => screen.getByText(/Flow Editor/));
}

function roomNode(): SVGGElement {
  const node = document.querySelector<SVGGElement>('[data-room-node="r1"]');
  if (!node) throw new Error('room node not rendered');
  return node;
}

function canvas(): SVGSVGElement {
  const svg = roomNode().ownerSVGElement;
  if (!svg) throw new Error('svg canvas not rendered');
  return svg;
}

/** Current on-screen position of the node, read from its SVG transform. */
function nodeX(): number {
  const t = roomNode().getAttribute('transform') ?? '';
  return Number(/translate\(([-\d.]+),/.exec(t)?.[1] ?? NaN);
}

describe('node drag', () => {
  it('performs zero writes until mouseup, then exactly one', async () => {
    const api = installApi();
    await openDoc();
    const getsAfterLoad = api.gets;

    const MOVES = 12;
    fireEvent.mouseDown(roomNode(), { clientX: 140, clientY: 140 });
    for (let i = 1; i <= MOVES; i++) {
      fireEvent.mouseMove(canvas(), { clientX: 140 + i * 5, clientY: 140 });
    }

    // Every move landed on screen — the drag is fully responsive…
    expect(nodeX()).toBe(100 + MOVES * 5);
    // …and not one of those MOVES edit events reached the server.
    expect(api.puts).toHaveLength(0);

    fireEvent.mouseUp(canvas());
    await waitFor(() => expect(api.puts).toHaveLength(1));

    // One write, carrying the drag's final position.
    expect(api.puts[0].rooms?.[0].x).toBe(100 + MOVES * 5);
    // And no re-GET storm: the list was fetched once, on mount.
    expect(api.gets).toBe(getsAfterLoad);
  });

  it('flips syncStatus to doc-ahead once per committed drag, not once per event', async () => {
    const api = installApi();
    await openDoc();

    fireEvent.mouseDown(roomNode(), { clientX: 140, clientY: 140 });
    for (let i = 1; i <= 8; i++) fireEvent.mouseMove(canvas(), { clientX: 140 + i * 4, clientY: 140 });
    fireEvent.mouseUp(canvas());
    await waitFor(() => expect(api.puts).toHaveLength(1));

    const flips = api.puts.filter((p) => p.syncStatus === 'doc-ahead');
    expect(flips).toHaveLength(1);

    // A second drag on a doc that is ALREADY doc-ahead must not re-assert it.
    fireEvent.mouseDown(roomNode(), { clientX: 200, clientY: 140 });
    fireEvent.mouseMove(canvas(), { clientX: 220, clientY: 140 });
    fireEvent.mouseUp(canvas());
    await waitFor(() => expect(api.puts).toHaveLength(2));
    expect(api.puts[1].syncStatus).toBeUndefined();
  });

  it('a click that never moves the node writes nothing', async () => {
    const api = installApi();
    await openDoc();

    fireEvent.mouseDown(roomNode(), { clientX: 140, clientY: 140 });
    fireEvent.mouseUp(canvas());

    await new Promise((r) => setTimeout(r, 50));
    expect(api.puts).toHaveLength(0);
  });
});

describe('narrative typing', () => {
  const SENTENCE = 'The corridor opens into a grand hall.';

  async function openNarrative() {
    await openDoc();
    fireEvent.click(screen.getByText('Narrative'));
    await waitFor(() => screen.getByPlaceholderText(/^Example:/));
  }

  /** Type like a keyboard does: append to whatever is currently in the box. */
  function typeInto(find: () => HTMLTextAreaElement, text: string) {
    for (const ch of text) {
      const el = find();
      fireEvent.change(el, { target: { value: el.value + ch } });
    }
  }

  it('loses no characters and keeps focus against a slow server, and writes once', async () => {
    const api = installApi({ putDelayMs: 40 });
    await openNarrative();
    const getsAfterLoad = api.gets;

    const find = () => screen.getByPlaceholderText(/^Example:/) as HTMLTextAreaElement;
    find().focus();
    typeInto(find, SENTENCE);

    // SENTENCE.length edit events; the old code wrote (and re-fetched) once each.
    expect(api.puts).toHaveLength(0);
    expect(find().value).toBe(SENTENCE);
    expect(document.activeElement).toBe(find());

    await waitFor(() => expect(api.puts).toHaveLength(1), { timeout: 3000 });
    expect(api.puts[0].designNarrative).toBe(SENTENCE);
    // The textarea was never unmounted by a background refresh.
    expect(find().value).toBe(SENTENCE);
    expect(document.activeElement).toBe(find());
    // The write did not drag a full re-GET of every document behind it.
    expect(api.gets).toBe(getsAfterLoad);
  });

  it('blur commits immediately instead of waiting out the debounce', async () => {
    const api = installApi();
    await openNarrative();

    const find = () => screen.getByPlaceholderText(/^Example:/) as HTMLTextAreaElement;
    typeInto(find, 'Rest beat before the boss.');
    expect(api.puts).toHaveLength(0);

    fireEvent.blur(find());
    await waitFor(() => expect(api.puts).toHaveLength(1));
    expect(api.puts[0].designNarrative).toBe('Rest beat before the boss.');
  });
});

describe('failed save', () => {
  it('is visible with retry, and the buffered edit survives it', async () => {
    const api = installApi({ putFails: true });
    await openDoc();
    fireEvent.click(screen.getByText('Narrative'));
    await waitFor(() => screen.getByPlaceholderText(/^Example:/));

    const find = () => screen.getByPlaceholderText(/^Example:/) as HTMLTextAreaElement;
    const text = 'A lift shaft drops into the flooded nave.';
    for (const ch of text) {
      const el = find();
      fireEvent.change(el, { target: { value: el.value + ch } });
    }

    // The failure surfaces — it is not swallowed into a console log.
    const banner = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(banner.textContent).toMatch(/Save failed/);
    expect(api.puts).toHaveLength(1);

    // The user's work is still on screen and still editable.
    expect(find().value).toBe(text);

    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(api.puts).toHaveLength(2));
    // Retry re-sends exactly the buffered edit.
    expect(api.puts[1].designNarrative).toBe(text);
    expect(find().value).toBe(text);
  });
});
