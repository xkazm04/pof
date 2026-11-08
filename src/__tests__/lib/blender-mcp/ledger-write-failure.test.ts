/**
 * A ledger write that fails must leave a trace: one logger.warn per failure streak, naming
 * the file and the error, and nothing on success. The in-memory ledger keeps working either way.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ledger,
  resetLedgerForTest,
  setLedgerFileForTest,
  flushLedgerForTest,
} from '@/lib/blender-mcp/generation-ledger';
import { logger } from '@/lib/logger';

let dir: string;
let warn: MockInstance<(...args: unknown[]) => void>;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-ledger-fail-'));
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  setLedgerFileForTest(null);
  warn.mockRestore();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A path whose parent is a regular file, so mkdir/write cannot succeed. */
function unwritablePath(): string {
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'x');
  return path.join(blocker, 'ledger.json');
}

function ledgerWarns(): string[] {
  return warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('ledger'));
}

describe('ledger write failures', () => {
  it('warns once, naming the file and the error, then keeps the job in memory', () => {
    const file = unwritablePath();
    setLedgerFileForTest(file);
    resetLedgerForTest();
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    flushLedgerForTest();
    const warns = ledgerWarns();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain(file);
    expect(warns[0]).toMatch(/ENOTDIR|EEXIST|ENOENT|EPERM|EACCES/);
    expect(ledger.listResumable()).toHaveLength(1);
  });

  it('does not repeat the warning for the same failure streak', () => {
    setLedgerFileForTest(unwritablePath());
    resetLedgerForTest();
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    flushLedgerForTest();
    ledger.record({ jobId: 'j2', provider: 'hyper3d', prompt: 'elf' });
    flushLedgerForTest();
    expect(ledgerWarns()).toHaveLength(1);
  });

  it('is silent when the write succeeds', () => {
    setLedgerFileForTest(path.join(dir, 'ok', 'ledger.json'));
    resetLedgerForTest();
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    flushLedgerForTest();
    expect(ledgerWarns()).toHaveLength(0);
  });
});
