import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { readJsonFile, writeJsonFile } from '@/lib/harness/state-io';

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
});
