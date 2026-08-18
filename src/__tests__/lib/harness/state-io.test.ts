import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  readJsonFile,
  readJsonFileState,
  readJsonFileStrict,
  writeJsonFile,
  StateFileCorruptError,
} from '@/lib/harness/state-io';

let root: string;
beforeEach(async () => { root = await fsp.mkdtemp(path.join(os.tmpdir(), 'pof-state-io-')); });
afterEach(async () => { await fsp.rm(root, { recursive: true, force: true }); });

describe('writeJsonFile + readJsonFile round-trip', () => {
  it('writes pretty-printed JSON and reads it back', () => {
    const file = path.join(root, 'data.json');
    const data = { a: 1, b: ['x', 'y'], nested: { ok: true } };
    writeJsonFile(file, data);

    // Pretty-printed with 2-space indent (the persistence contract).
    expect(fs.readFileSync(file, 'utf-8')).toBe(JSON.stringify(data, null, 2));
    expect(readJsonFile(file, null)).toEqual(data);
  });
});

describe('readJsonFile fallback behavior', () => {
  it('returns the fallback when the file does not exist', () => {
    const fallback = { sentinel: true };
    expect(readJsonFile(path.join(root, 'missing.json'), fallback)).toBe(fallback);
  });

  it('returns the fallback when the file contains invalid JSON', () => {
    const file = path.join(root, 'corrupt.json');
    fs.writeFileSync(file, '{ not valid json ');
    expect(readJsonFile(file, [])).toEqual([]);
  });

  it('never throws — degrades a missing/corrupt state file to the fallback', () => {
    expect(() => readJsonFile(path.join(root, 'nope.json'), null)).not.toThrow();
  });
});

describe('writeJsonFile error contract', () => {
  it('throws when the target directory does not exist', () => {
    const file = path.join(root, 'no-such-dir', 'data.json');
    expect(() => writeJsonFile(file, { a: 1 })).toThrow();
  });

  it('leaves no temp residue behind after a failed write', () => {
    const file = path.join(root, 'no-such-dir', 'data.json');
    expect(() => writeJsonFile(file, { a: 1 })).toThrow();
    expect(fs.readdirSync(root)).toEqual([]);
  });
});

// ── atomicity: a reader can never observe a partial state file ───────────────

describe('writeJsonFile is atomic', () => {
  it('leaves no temp files behind on the happy path', () => {
    const file = path.join(root, 'plan.json');
    writeJsonFile(file, { areas: [1, 2, 3] });
    expect(fs.readdirSync(root)).toEqual(['plan.json']);
  });

  it('PUBLISHES by rename — the target is replaced whole, never truncated in place', () => {
    const file = path.join(root, 'plan.json');
    writeJsonFile(file, { iteration: 1 });
    const before = fs.statSync(file).ino;

    writeJsonFile(file, { iteration: 2 });
    const after = fs.statSync(file).ino;

    // A rename-publish swaps in a DIFFERENT file (new inode / NTFS file index);
    // an in-place `writeFileSync` reuses the same one — and it is that in-place
    // path that can leave a reader looking at a truncated plan.
    expect(after).not.toBe(before);
    // Control: an in-place write keeps the identity, proving the assertion above
    // is actually discriminating on this filesystem rather than always true.
    fs.writeFileSync(file, JSON.stringify({ iteration: 3 }));
    expect(fs.statSync(file).ino).toBe(after);

    expect(readJsonFile(path.join(root, 'plan.json'), null)).toEqual({ iteration: 3 });
    expect(fs.readdirSync(root)).toEqual(['plan.json']);
  });

  it('a value that cannot be serialized leaves the existing state file intact', () => {
    const file = path.join(root, 'plan.json');
    writeJsonFile(file, { iteration: 7 });

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeJsonFile(file, circular)).toThrow();

    // The old plan survived — serialization happens before the target is touched.
    expect(readJsonFile(file, null)).toEqual({ iteration: 7 });
    expect(fs.readdirSync(root)).toEqual(['plan.json']);
  });
});

// ── corruption is never silent ───────────────────────────────────────────────

describe('readJsonFileState distinguishes missing from corrupt', () => {
  it('reports `missing` for a file that does not exist (first run is legitimate)', () => {
    const read = readJsonFileState(path.join(root, 'nope.json'), null);
    expect(read.state).toBe('missing');
    expect(read.value).toBeNull();
  });

  it('reports `ok` with the parsed value', () => {
    const file = path.join(root, 'ok.json');
    writeJsonFile(file, { a: 1 });
    expect(readJsonFileState(file, null)).toEqual({ state: 'ok', value: { a: 1 } });
  });

  it('reports `corrupt` — NOT missing — for a truncated file', () => {
    const file = path.join(root, 'plan.json');
    // Exactly the crash-mid-write shape: a prefix of a real plan.
    fs.writeFileSync(file, '{\n  "game": "PoF",\n  "areas": [{ "id": "a"');
    const read = readJsonFileState(file, null);
    expect(read.state).toBe('corrupt');
    expect(read.error).toBeTruthy();
    expect(read.value).toBeNull(); // fallback still supplied, but LABELLED
  });
});

describe('readJsonFileStrict', () => {
  it('returns the fallback for a missing file (first run still works)', () => {
    expect(readJsonFileStrict(path.join(root, 'nope.json'), { seeded: true })).toEqual({ seeded: true });
  });

  it('throws StateFileCorruptError for a truncated file', () => {
    const file = path.join(root, 'plan.json');
    fs.writeFileSync(file, '{"areas": [');
    expect(() => readJsonFileStrict(file, null)).toThrow(StateFileCorruptError);
    expect(() => readJsonFileStrict(file, null)).toThrow(/CORRUPT/);
  });

  it('returns the parsed value when the file is fine', () => {
    const file = path.join(root, 'ok.json');
    writeJsonFile(file, { a: 1 });
    expect(readJsonFileStrict(file, null)).toEqual({ a: 1 });
  });
});
