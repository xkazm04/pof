/**
 * Hardening of the `contracts` row's folder read (`contracts/contractsRead.ts`, `contractsReadCouncil.ts`).
 *
 * - A DECLARED `provenance.runId` must name one run folder UNDER `games/gtai/quests/_council/`. Before,
 *   `..` / `.` / `../<anything>` was path-joined as-is, the joined folder existed, and Council passed with
 *   no council run on record — the step criterion says the run folder exists under `_council/`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/games/gtai-quest/assess', () => ({
  assessQuest: (subject: string) => ({ subject, guards: [], blockedBy: [], blocked: false }),
}));
vi.mock('@/lib/games/gtai-quest/loadContext', () => ({
  loadQuestContext: () => ({ economy: null, voiceBibles: new Set(), cast: new Set(), ledger: [], judge: null }),
  loadProposals: () => [],
  loadLedger: () => [],
}));

import { readQuestSnapshot } from '@/lib/catalog/pipelines/contracts/contractsRead';
import { ledgerRow } from '@/lib/catalog/pipelines/contracts/contractsSync';
import { questPackage, writeQuest } from './contractsFixture';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-contracts-hard-'));
afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));
beforeEach(() => fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true }));

const council = (id: string) => ledgerRow(readQuestSnapshot(ROOT, id)).steps.find((s) => s.label === 'Council')!.acceptance;

describe('contracts Council — a declared runId stays inside _council/', () => {
  for (const runId of ['..', '.', '../fax-jam', '../../gtai', 'a/../..', 'x\\..\\..']) {
    it(`declared runId ${JSON.stringify(runId)} does not pass Council`, () => {
      const pkg = questPackage('fax-jam');
      writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, provenance: { ...pkg.provenance, runId } }, runId: '20261102-1500-real' });
      const snap = readQuestSnapshot(ROOT, 'fax-jam');
      expect(snap.council.runDirExists).toBe(false);
      expect(council('fax-jam').status).not.toBe('pass');
    });
  }

  it('a declared single-segment runId whose folder exists still passes (control)', () => {
    const pkg = questPackage('fax-jam');
    writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, provenance: { ...pkg.provenance, runId: '20261102-1500-real' } }, runId: '20261102-1500-real' });
    expect(council('fax-jam').status).toBe('pass');
  });
});
