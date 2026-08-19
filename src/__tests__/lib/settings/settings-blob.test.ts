// Contract for the shared settings-blob helper itself — the four stores' tests
// cover what each subsystem must do; these cover what the helper guarantees to
// any store that adopts it next.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
testDb.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    getDb: () => testDb,
    getSetting: (key: string) => {
      const row = testDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    setSetting: (key: string, value: string) => {
      testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },
    __esModule: true,
    default: actual,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

import {
  expectArray, expectRecord, isQuarantineKey, listQuarantined, quarantineKeyFor,
  readSettingsBlob, SettingsBlobCorruptError, updateSettingsBlob, writeSettingsBlob,
  QUARANTINE_SEP, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';

interface Cfg { enabled: boolean; url: string }

const SPEC: SettingsBlobSpec<Cfg> = {
  key: 'demo_key',
  absent: () => ({ enabled: true, url: 'absent' }),
  corrupt: () => ({ enabled: false, url: 'corrupt' }),
  hydrate: (parsed) => ({ enabled: true, url: '', ...(expectRecord(parsed, 'demo') as Partial<Cfg>) }),
};

function put(key: string, value: string) {
  testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}
function read(key: string): string | null {
  const row = testDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  testDb.exec('DELETE FROM settings');
});

describe('readSettingsBlob', () => {
  it('separates absent from corrupt — the whole point', () => {
    const absent = readSettingsBlob(SPEC);
    expect(absent.status).toBe('absent');
    expect(absent.corrupt).toBe(false);
    expect(absent.value.url).toBe('absent');
    expect(absent.reason).toBeNull();

    put('demo_key', '{oops');
    const corrupt = readSettingsBlob(SPEC);
    expect(corrupt.status).toBe('corrupt');
    expect(corrupt.corrupt).toBe(true);
    expect(corrupt.value.url).toBe('corrupt');
    expect(corrupt.reason).toContain('not "unconfigured"');
    expect(corrupt.rawBytes).toBe(5);
    expect(corrupt.raw).toBe('{oops');
  });

  it('hydrates a good value and keeps no raw bytes around', () => {
    put('demo_key', JSON.stringify({ enabled: false, url: 'https://x' }));
    const ok = readSettingsBlob(SPEC);
    expect(ok.status).toBe('ok');
    expect(ok.value).toEqual({ enabled: false, url: 'https://x' });
    expect(ok.raw).toBeNull();
  });

  it('treats a value that PARSED but is the wrong shape as corrupt', () => {
    for (const wrong of ['"a string"', '[1,2,3]', 'null', '42']) {
      put('demo_key', wrong);
      expect(readSettingsBlob(SPEC).status).toBe('corrupt');
    }
  });
});

describe('write policies', () => {
  it('refuses by default and leaves the stored bytes untouched', () => {
    put('demo_key', '{oops');
    expect(() => updateSettingsBlob(SPEC, (c) => ({ ...c, enabled: true }))).toThrow(SettingsBlobCorruptError);
    expect(read('demo_key')).toBe('{oops');
  });

  it('preserves the original bytes before refusing, and names the key', () => {
    put('demo_key', '{oops');
    let err: SettingsBlobCorruptError | null = null;
    try {
      updateSettingsBlob(SPEC, (c) => c);
    } catch (e) {
      err = e as SettingsBlobCorruptError;
    }
    expect(err).toBeInstanceOf(SettingsBlobCorruptError);
    expect(err!.rawBytes).toBe(5);
    expect(err!.quarantineKey).not.toBeNull();
    expect(err!.message).toContain(err!.quarantineKey!);
    expect(read(err!.quarantineKey!)).toBe('{oops');
  });

  it('preserve-and-continue writes, keeping the original recoverable', () => {
    put('demo_key', '{oops');
    const result = updateSettingsBlob(SPEC, (c) => ({ ...c, url: 'new' }), { onCorrupt: 'preserve-and-continue' });
    expect(result.priorStatus).toBe('corrupt');
    expect(read('demo_key')).toBe(JSON.stringify({ enabled: false, url: 'new' }));
    expect(read(result.quarantineKey!)).toBe('{oops');
  });

  it('never quarantines when the read was trustworthy', () => {
    put('demo_key', JSON.stringify({ enabled: true, url: 'a' }));
    const result = updateSettingsBlob(SPEC, (c) => ({ ...c, url: 'b' }));
    expect(result.quarantineKey).toBeNull();
    expect(result.priorStatus).toBe('ok');
    expect(listQuarantined('demo_key')).toEqual([]);
  });

  it('writeSettingsBlob replaces outright and defaults to preserve-and-continue', () => {
    put('demo_key', '{oops');
    writeSettingsBlob(SPEC, { enabled: true, url: 'fresh' });
    expect(read('demo_key')).toBe(JSON.stringify({ enabled: true, url: 'fresh' }));
    expect(listQuarantined('demo_key').map((q) => q.value)).toEqual(['{oops']);
  });

  it('does not clobber an earlier quarantine holding different bytes', () => {
    const at = new Date('2026-08-19T00:00:00.000Z');
    put(quarantineKeyFor('demo_key', at), 'FIRST');
    vi.setSystemTime(at);
    put('demo_key', 'SECOND-and-unreadable');
    writeSettingsBlob(SPEC, { enabled: true, url: 'x' });
    vi.useRealTimers();

    const values = listQuarantined('demo_key').map((q) => q.value).sort();
    expect(values).toEqual(['FIRST', 'SECOND-and-unreadable']);
  });
});

describe('quarantine keys', () => {
  it('does not treat `_` in a key as a SQL wildcard', () => {
    // `build_profiles` contains `_`, a LIKE single-char wildcard. Unescaped, a
    // listing for one key reports a DIFFERENT key's preserved bytes as its own.
    put(`buildXprofiles${QUARANTINE_SEP}2026-08-19T00:00:00.000Z`, 'FOREIGN');
    put(`build_profiles${QUARANTINE_SEP}2026-08-19T00:00:00.000Z`, 'MINE');
    expect(listQuarantined('build_profiles').map((q) => q.value)).toEqual(['MINE']);
  });

  it('never reports the live key as its own quarantine', () => {
    put('demo_key', '{oops');
    updateSettingsBlob(SPEC, (c) => c, { onCorrupt: 'preserve-and-continue' });
    const keys = listQuarantined('demo_key').map((q) => q.key);
    expect(keys).not.toContain('demo_key');
    expect(keys.every(isQuarantineKey)).toBe(true);
  });

  it('orders newest first', () => {
    put(quarantineKeyFor('demo_key', new Date('2026-01-01T00:00:00.000Z')), 'old');
    put(quarantineKeyFor('demo_key', new Date('2026-08-19T00:00:00.000Z')), 'new');
    expect(listQuarantined('demo_key').map((q) => q.value)).toEqual(['new', 'old']);
  });
});

describe('shape guards', () => {
  it('expectRecord accepts only a plain object', () => {
    expect(expectRecord({ a: 1 }, 'x')).toEqual({ a: 1 });
    for (const bad of [null, [1], 'str', 7, true]) {
      expect(() => expectRecord(bad, 'x')).toThrow(TypeError);
    }
  });

  it('expectArray accepts only an array', () => {
    expect(expectArray([1], 'x')).toEqual([1]);
    for (const bad of [null, { a: 1 }, 'str', 7]) {
      expect(() => expectArray(bad, 'x')).toThrow(TypeError);
    }
  });

  it('names the actual shape it rejected', () => {
    expect(() => expectArray({ a: 1 }, 'build profiles')).toThrow(/build profiles.*object/);
  });
});
