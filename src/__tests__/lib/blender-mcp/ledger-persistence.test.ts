/**
 * The generation ledger survives a server restart: a paid Hyper3D / Hunyuan3D job is
 * written to a local file, rehydrated lazily, and a recorded import stays idempotent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ledger,
  resetLedgerForTest,
  setLedgerFileForTest,
  simulateRestartForTest,
  flushLedgerForTest,
} from '@/lib/blender-mcp/generation-ledger';
import { ledgerFileWriteCount } from '@/lib/blender-mcp/ledger-file';

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-ledger-'));
  file = path.join(dir, 'nested', 'ledger.json');
  setLedgerFileForTest(file);
  resetLedgerForTest();
});
afterEach(() => {
  setLedgerFileForTest(null);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ledger persistence', () => {
  it('keeps a recorded job and its epoch across a restart', () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    const epoch = ledger.ownerEpoch;
    simulateRestartForTest();
    const list = ledger.listResumable();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ jobId: 'j1', state: 'generating', prompt: 'orc' });
    expect(ledger.ownerEpoch).toBe(epoch);
    expect(ledger.restored).toBe(true);
  });

  it('answers a repeat import from disk after a restart without calling doImport', async () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    ledger.markImported('j1', 'hyper3d', 'Orc.001');
    simulateRestartForTest();
    let called = 0;
    const res = await ledger.importOnce('j1', 'hyper3d', async () => {
      called++;
      return { ok: true, data: { objectName: 'X' } };
    });
    expect(called).toBe(0);
    expect(res).toEqual({ ok: true, data: { objectName: 'Orc.001', alreadyImported: true } });
  });

  it('missing file: empty list, fresh epoch, not restored', () => {
    simulateRestartForTest();
    expect(ledger.listResumable()).toEqual([]);
    expect(ledger.ownerEpoch.length).toBeGreaterThan(0);
    expect(ledger.restored).toBe(false);
  });

  it('corrupt or truncated file: empty list, new epoch, replaced on next write, never throws', () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    const oldEpoch = ledger.ownerEpoch;
    flushLedgerForTest();
    fs.writeFileSync(file, '{"epoch":"abc","entries":[{"jobId":');
    simulateRestartForTest();
    expect(ledger.listResumable()).toEqual([]);
    expect(ledger.ownerEpoch).not.toBe(oldEpoch);
    expect(ledger.restored).toBe(false);
    ledger.record({ jobId: 'j2', provider: 'hunyuan3d', prompt: 'elf' });
    flushLedgerForTest();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed.entries.map((e: { jobId: string }) => e.jobId)).toEqual(['j2']);
  });

  it('drops unfinished entries older than 24h on load; caps terminal entries at 200', () => {
    const now = Date.now();
    const entries = [
      { jobId: 'old', provider: 'hyper3d', prompt: '', createdAt: now - 25 * 3600_000, state: 'generating' },
      { jobId: 'fresh', provider: 'hyper3d', prompt: '', createdAt: now - 1000, state: 'generating' },
      ...Array.from({ length: 205 }, (_, i) => ({
        jobId: `t${i}`, provider: 'hyper3d', prompt: '', createdAt: now - 5000 + i, state: 'imported', objectName: `O${i}`,
      })),
    ];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ epoch: 'e1', entries }));
    simulateRestartForTest();
    expect(ledger.ownerEpoch).toBe('e1');
    expect(ledger.get('old')).toBeUndefined();
    expect(ledger.get('fresh')).toBeDefined();
    ledger.markState('fresh', 'completed');
    flushLedgerForTest();
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(saved.entries.length).toBeLessThanOrEqual(200);
  });

  it('writes atomically and coalesces 50 markState calls in one tick to at most 2 writes', async () => {
    ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
    flushLedgerForTest();
    const before = ledgerFileWriteCount();
    for (let i = 0; i < 50; i++) ledger.markState('j1', i % 2 ? 'completed' : 'generating');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(ledgerFileWriteCount() - before).toBeLessThanOrEqual(2);
    expect(fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).entries[0].state).toBe('completed');
  });

  it('degrades silently when the file cannot be written', () => {
    fs.writeFileSync(path.join(dir, 'blocker'), 'x');
    setLedgerFileForTest(path.join(dir, 'blocker', 'sub', 'ledger.json'));
    resetLedgerForTest();
    expect(() => {
      ledger.record({ jobId: 'j1', provider: 'hyper3d', prompt: 'orc' });
      flushLedgerForTest();
    }).not.toThrow();
    expect(ledger.listResumable()).toHaveLength(1);
  });
});
