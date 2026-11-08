// @vitest-environment node
/**
 * The bootstrap asks for WAL, but `PRAGMA journal_mode = WAL` is a REQUEST: the engine
 * answers with the mode it actually applied and silently keeps another one when WAL
 * cannot be honoured (an in-memory store, some network filesystems). The recorded
 * embedded-db deviation (journal-and-durability-modes: "assert the contract at boot")
 * was that the answer was discarded. A fallback must now be said out loud.
 *
 * `:memory:` is the deterministic fallback: SQLite reports `memory` for it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.POF_DB_PATH = ':memory:';
});

import { logger } from '@/lib/logger';

afterEach(() => vi.restoreAllMocks());

describe('db bootstrap asserts the journal mode it was given', () => {
  it('warns, naming the effective mode, when WAL is not applied', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    expect(db.pragma('journal_mode', { simple: true })).toBe('memory');
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => /journal_mode/i.test(m) && /memory/.test(m) && /wal/i.test(m))).toBe(true);
  });

  it('stays quiet when a file-backed store really is in WAL', async () => {
    vi.resetModules();
    const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
    process.env.POF_DB_PATH = `${dir}/pof-test-journal-mode-${process.pid}-${Date.now()}.db`;
    const { logger: freshLogger } = await import('@/lib/logger');
    const warn = vi.spyOn(freshLogger, 'warn');
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => /journal_mode/i.test(m))).toEqual([]);
    db.close();
  });
});
