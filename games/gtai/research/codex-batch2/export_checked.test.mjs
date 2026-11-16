import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportArgs, exportChecked } from './export_checked.mjs';

const OK = { ok: true, expected: 256, missing: [], mismatched: [] };

test('exportArgs is the release export command', () => {
  assert.deepEqual(exportArgs('../build/export/windows/RTAI.exe'), ['--headless', '--path', 'project', '--export-release', 'windows-showcase', '../build/export/windows/RTAI.exe']);
});

test('a baked tree exports', async () => {
  let args = null;
  const r = await exportChecked({ out: 'x.exe', check: () => OK, run: async (a) => { args = a; return 0; } });
  assert.equal(r.ok, true);
  assert.deepEqual(args, exportArgs('x.exe'));
});

test('an unbaked tree refuses and never starts the export', async () => {
  let ran = false;
  const r = await exportChecked({ out: 'x.exe', check: () => ({ ok: false, expected: 2, missing: ['a.bin'], mismatched: [] }), run: async () => { ran = true; return 0; } });
  assert.equal(ran, false);
  assert.equal(r.ok, false);
  assert.match(r.reason, /a\.bin|1 missing|missing/);
});

test('a failing export is not ok and carries its exit code', async () => {
  const r = await exportChecked({ out: 'x.exe', check: () => OK, run: async () => 3 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
});

test('a check that throws refuses instead of exporting', async () => {
  let ran = false;
  const r = await exportChecked({ out: 'x.exe', check: () => { throw new Error('boom'); }, run: async () => { ran = true; return 0; } });
  assert.equal(ran, false);
  assert.equal(r.ok, false);
});
