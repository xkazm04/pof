import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_MEDIA_BYTES, readDecisionsBoard, resolveMedia } from '@/lib/games/decisions/readDecisions';
import { writeAnswer } from '@/lib/games/decisions/writeAnswer';
import { decisionsRootFor } from '@/lib/games/decisions/decisionsConfig';
import { makeDecisionsFixture, type Fixture } from './decisionsFixture';

let fx: Fixture;
afterEach(() => fx?.cleanup());
const API = '/api/games/gtai/decisions';
const answersOf = (root: string) => JSON.parse(fs.readFileSync(path.join(root, 'answers.json'), 'utf8')) as { answers: Array<Record<string, unknown>> };

describe('readDecisionsBoard', () => {
  it('lists open asks newest first, marks defaults, and reports media it cannot serve', () => {
    fx = makeDecisionsFixture();
    const b = readDecisionsBoard(fx.root, 'gtai', API);
    expect(b.open.map((d) => d.id)).toEqual(['gunplay-2', 'arena-1']);
    const arena = b.open[1];
    expect(arena.default).toBe('pistol');
    expect(b.open[0].default).toBeUndefined();
    const pistol = arena.options[0].media;
    expect(pistol.map((m) => m.kind)).toEqual(['image', 'video']);
    expect(pistol[0].url).toBe(`${API}/media?ask=arena-1&opt=pistol&n=0`);
    const shotgun = arena.options[1].media;
    expect(shotgun[0]).toMatchObject({ name: 'missing.png', unservable: 'file not found' });
    expect(shotgun[1]).toMatchObject({ unservable: 'unsupported file type' });
    expect(shotgun[1].url).toBeUndefined();
    expect(b.problems).toEqual([{ file: 'broken-3.json', reason: expect.stringContaining('id is missing') }]);
  });

  it('moves an answered ask below, with its answer', () => {
    fx = makeDecisionsFixture({ answers: JSON.stringify({ answers: [{ id: 'arena-1', choice: 'shotgun', note: 'go', at: '2026-11-03T19:30:00Z' }] }) });
    const b = readDecisionsBoard(fx.root, 'gtai', API);
    expect(b.open.map((d) => d.id)).toEqual(['gunplay-2']);
    expect(b.answered[0]).toMatchObject({ id: 'arena-1', answer: { choice: 'shotgun', note: 'go' } });
  });

  it('says so when answers.json is unusable', () => {
    fx = makeDecisionsFixture({ answers: '{ nope' });
    const b = readDecisionsBoard(fx.root, 'gtai', API);
    expect(b.problems.some((p) => p.file === 'answers.json')).toBe(true);
  });

  it('an empty / missing folder is an empty board, not an error', () => {
    fx = makeDecisionsFixture({ answers: null });
    fs.rmSync(path.join(fx.root, 'asks'), { recursive: true });
    const b = readDecisionsBoard(fx.root, 'gtai', API);
    expect(b.open).toEqual([]);
    expect(b.answered).toEqual([]);
  });
});

describe('resolveMedia (the media door)', () => {
  it('serves only a path an ask lists, by option key and index', () => {
    fx = makeDecisionsFixture();
    expect(resolveMedia(fx.root, 'arena-1', 'pistol', 0)).toMatchObject({ ok: true, mime: 'image/png' });
    expect(resolveMedia(fx.root, 'arena-1', 'pistol', 1)).toMatchObject({ ok: true, mime: 'video/mp4' });
  });
  it('lists a clip beyond the size cap as unservable and the door refuses it', () => {
    fx = makeDecisionsFixture();
    const big = path.join(fx.media, 'big.mp4');
    fs.writeFileSync(big, '');
    fs.truncateSync(big, MAX_MEDIA_BYTES + 1);
    const ask = JSON.parse(fs.readFileSync(path.join(fx.root, 'asks', 'gunplay-2.json'), 'utf8'));
    ask.options[0].frames = [big];
    fs.writeFileSync(path.join(fx.root, 'asks', 'gunplay-2.json'), JSON.stringify(ask));
    const m = readDecisionsBoard(fx.root, 'gtai', API).open[0].options[0].media[0];
    expect(m).toMatchObject({ unservable: expect.stringContaining('larger than') });
    expect(resolveMedia(fx.root, 'gunplay-2', 'low', 0)).toMatchObject({ ok: false, status: 404 });
  });
  it('refuses a listed non-media file, a missing file, an unknown ask/option/index and a bad id', () => {
    fx = makeDecisionsFixture();
    expect(resolveMedia(fx.root, 'arena-1', 'shotgun', 1)).toMatchObject({ ok: false, status: 404, reason: 'unsupported file type' });
    expect(resolveMedia(fx.root, 'arena-1', 'shotgun', 0)).toMatchObject({ ok: false, status: 404 });
    expect(resolveMedia(fx.root, 'arena-1', 'nope', 0)).toMatchObject({ ok: false, status: 404 });
    expect(resolveMedia(fx.root, 'arena-1', 'pistol', 9)).toMatchObject({ ok: false, status: 404 });
    expect(resolveMedia(fx.root, '../asks/arena-1', 'pistol', 0)).toMatchObject({ ok: false, status: 400 });
    expect(resolveMedia(fx.root, 'arena-1', 'pistol', -1)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('writeAnswer', () => {
  it('appends, keeps earlier answers and unknown fields, and leaves no temp file', async () => {
    fx = makeDecisionsFixture();
    const r = await writeAnswer(fx.root, { id: 'arena-1', choice: 'pistol', note: '  fine  ' }, new Date('2026-11-03T19:40:00Z'));
    expect(r).toMatchObject({ ok: true, replaced: false });
    const doc = answersOf(fx.root);
    expect(doc.answers).toEqual([
      { id: 'old-0', choice: 'a', note: 'kept', at: '2026-11-03T18:00:00Z', extra: 1 },
      { id: 'arena-1', choice: 'pistol', note: 'fine', at: '2026-11-03T19:40:00.000Z' },
    ]);
    expect(fs.readdirSync(fx.root).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('creates answers.json when absent', async () => {
    fx = makeDecisionsFixture({ answers: null });
    expect(await writeAnswer(fx.root, { id: 'gunplay-2', choice: 'low' })).toMatchObject({ ok: true });
    expect(answersOf(fx.root).answers).toHaveLength(1);
  });

  it('a changed mind replaces that id and keeps the old entry in the history file', async () => {
    fx = makeDecisionsFixture();
    await writeAnswer(fx.root, { id: 'arena-1', choice: 'pistol', note: 'first' });
    const r = await writeAnswer(fx.root, { id: 'arena-1', choice: 'shotgun', note: 'second' });
    expect(r).toMatchObject({ ok: true, replaced: true });
    const mine = answersOf(fx.root).answers.filter((a) => a.id === 'arena-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].choice).toBe('shotgun');
    const hist = fs.readFileSync(path.join(fx.root, 'answers.history.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(hist[0].was).toMatchObject({ id: 'arena-1', choice: 'pistol', note: 'first' });
  });

  it('refuses an unknown ask, an unknown choice, and an unreadable answers.json (never overwrites it)', async () => {
    fx = makeDecisionsFixture();
    expect(await writeAnswer(fx.root, { id: 'nope', choice: 'x' })).toMatchObject({ ok: false, status: 404 });
    expect(await writeAnswer(fx.root, { id: 'arena-1', choice: 'bazooka' })).toMatchObject({ ok: false, status: 400 });
    fx.cleanup();
    fx = makeDecisionsFixture({ answers: '{ nope' });
    expect(await writeAnswer(fx.root, { id: 'arena-1', choice: 'pistol' })).toMatchObject({ ok: false, status: 409 });
    expect(fs.readFileSync(path.join(fx.root, 'answers.json'), 'utf8')).toBe('{ nope');
  });

  it('never touches an ask file, and serialises concurrent writes without losing one', async () => {
    fx = makeDecisionsFixture();
    const before = fs.readFileSync(path.join(fx.root, 'asks', 'arena-1.json'), 'utf8');
    await Promise.all([
      writeAnswer(fx.root, { id: 'arena-1', choice: 'pistol' }),
      writeAnswer(fx.root, { id: 'gunplay-2', choice: 'high' }),
    ]);
    expect(answersOf(fx.root).answers.map((a) => a.id).sort()).toEqual(['arena-1', 'gunplay-2', 'old-0']);
    expect(fs.readFileSync(path.join(fx.root, 'asks', 'arena-1.json'), 'utf8')).toBe(before);
  });
});

describe('writeAnswer with concurrent readers', () => {
  it('a lane re-reading answers.json during many writes always sees a complete document, and no answer is lost', async () => {
    fx = makeDecisionsFixture({ answers: null });
    const file = path.join(fx.root, 'answers.json');
    let torn = 0;
    let reads = 0;
    let done = false;
    const reader = (async () => {
      while (!done) {
        try { JSON.parse(fs.readFileSync(file, 'utf8')); reads++; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT' && (e as NodeJS.ErrnoException).code !== 'EBUSY' && (e as NodeJS.ErrnoException).code !== 'EPERM') torn++; }
        await new Promise((r) => setImmediate(r));
      }
    })();
    const ids = ['arena-1', 'gunplay-2'];
    for (let i = 0; i < 40; i++) {
      await writeAnswer(fx.root, { id: ids[i % 2], choice: i % 2 ? 'low' : 'pistol', note: `n${i}` });
      await new Promise((r) => setImmediate(r)); // let the reader run between writes
    }
    done = true;
    await reader;
    expect(torn).toBe(0);
    expect(reads).toBeGreaterThan(0);
    expect(answersOf(fx.root).answers.map((a) => a.id).sort()).toEqual(ids);
  });
});

describe('decisionsRootFor', () => {
  it('reads the manifest and lets the env override', () => {
    expect(decisionsRootFor('gtai', { env: {}, repoRoot: path.resolve('/r/pof') })).toBe(path.resolve('/r/gtai-eve/decisions'));
    expect(decisionsRootFor('gtai', { env: { POF_GAME_DECISIONS_GTAI: '/x/d' }, repoRoot: '/r/pof' })).toBe(path.resolve('/x/d'));
    expect(decisionsRootFor('pof', { env: {} })).toBeNull();
  });
});
