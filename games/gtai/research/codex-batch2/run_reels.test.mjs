import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reelArgs, runReels } from './run_reels.mjs';

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reels-'));
const good = (n = 2) => Array.from({ length: n }, (_, i) => `[INFO] showcase: director chapter c${i}: 2/2 down`).join('\n');

test('reelArgs is the gate command with a weapon', () => {
  assert.deepEqual(reelArgs('combo'), ['--headless', '--path', 'project', '--quit-after', '40000', 'res://dev/arena/arena.tscn', '--', '--rigs', '--bot=reel', '--reel=director', '--view=combo', '--loadout=pistol']);
});

test('every view passing is ok', async () => {
  const out = dir();
  const r = await runReels({ views: ['top', 'combo'], expect: 2, outDir: out, run: async (view, log) => { fs.writeFileSync(log, good()); return 0; } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.views.map((v) => v.view), ['top', 'combo']);
  assert.ok(r.views.every((v) => v.ok && v.problems.length === 0));
});

test('a logs a file per view under outDir', async () => {
  const out = dir();
  const seen = [];
  await runReels({ views: ['top', 'tilt70'], expect: 2, outDir: out, run: async (view, log) => { seen.push(log); fs.writeFileSync(log, good()); return 0; } });
  assert.equal(new Set(seen).size, 2);
  for (const log of seen) assert.equal(path.resolve(path.dirname(log)), path.resolve(out));
});

test('a nonzero exit fails its view even with a clean log, and is named', async () => {
  const r = await runReels({ views: ['top'], expect: 2, outDir: dir(), run: async (view, log) => { fs.writeFileSync(log, good()); return 139; } });
  assert.equal(r.ok, false);
  assert.match(r.views[0].problems.join(' '), /139/);
});

test('a bad view does not stop the others', async () => {
  const ran = [];
  const r = await runReels({ views: ['top', 'combo'], expect: 2, outDir: dir(), run: async (view, log) => { ran.push(view); fs.writeFileSync(log, view === 'top' ? good(1) : good()); return 0; } });
  assert.deepEqual(ran, ['top', 'combo']);
  assert.equal(r.ok, false);
  assert.equal(r.views[1].ok, true);
});

test('a missing log fails rather than throwing', async () => {
  const r = await runReels({ views: ['top'], expect: 2, outDir: dir(), run: async () => 0 });
  assert.equal(r.ok, false);
  assert.equal(r.views[0].ok, false);
});

test('no views is not ok: nothing was checked', async () => {
  assert.equal((await runReels({ views: [], expect: 2, outDir: dir(), run: async () => 0 })).ok, false);
});
