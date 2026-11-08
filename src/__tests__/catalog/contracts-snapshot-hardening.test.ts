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

  it('a declared single-segment runId whose folder exists passes (control)', () => {
    const pkg = questPackage('fax-jam');
    writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, provenance: { ...pkg.provenance, runId: '20261102-1500-real' } }, runId: '20261102-1500-real' });
    expect(council('fax-jam').status).toBe('pass');
  });
});

/**
 * `readQuestSnapshot` promises it never throws for a malformed package. Before, a folder entry of the
 * wrong KIND threw out of the fs reads (`evidence/frame.png` as a directory → EISDIR; `art` or
 * `evidence` as a plain file → ENOTDIR), and `contractsLedger` maps every quest, so ONE bad folder
 * turned GET /api/games/gtai/quests and the sync into a 500 for every quest.
 */
describe('contracts snapshot — a malformed folder entry is measured, never thrown', () => {
  const step = (id: string, label: string) => ledgerRow(readQuestSnapshot(ROOT, id)).steps.find((s) => s.label === label)!.acceptance;

  it('a directory named *.png under evidence/ is not a frame and does not throw', () => {
    writeQuest(ROOT, 'fax-jam', { selftest: 'succeeded' });
    fs.mkdirSync(path.join(ROOT, 'games/gtai/quests/fax-jam/evidence/frame-000.png'), { recursive: true });
    expect(() => readQuestSnapshot(ROOT, 'fax-jam')).not.toThrow();
    expect(readQuestSnapshot(ROOT, 'fax-jam').inGame.frames).toEqual([]);
    expect(step('fax-jam', 'In-game').status).not.toBe('pass');
  });

  it('`evidence` as a plain file does not throw and nothing passes In-game', () => {
    writeQuest(ROOT, 'fax-jam');
    fs.writeFileSync(path.join(ROOT, 'games/gtai/quests/fax-jam/evidence'), 'oops');
    expect(() => readQuestSnapshot(ROOT, 'fax-jam')).not.toThrow();
    expect(step('fax-jam', 'In-game').status).not.toBe('pass');
  });

  it('`art` as a plain file does not throw and the new character reads as having no art', () => {
    writeQuest(ROOT, 'fax-jam', { art: false });
    fs.writeFileSync(path.join(ROOT, 'games/gtai/quests/fax-jam/art'), 'oops');
    expect(() => readQuestSnapshot(ROOT, 'fax-jam')).not.toThrow();
    expect(readQuestSnapshot(ROOT, 'fax-jam').package.newCharacters[0].art).toEqual([]);
    expect(step('fax-jam', 'Package').status).not.toBe('pass');
  });
});

/** A present-but-corrupt `seats.json` is reported as corrupt — it must not read as never written. */
describe('contracts Council - corrupt seats.json is named, not "unrecorded"', () => {
  const seatsFile = (runId: string) => path.join(ROOT, 'games/gtai/quests/_council', runId, 'seats.json');
  const seed = () => {
    const pkg = questPackage('fax-jam');
    writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, provenance: { ...pkg.provenance, runId: '20261102-1500-real' } }, runId: '20261102-1500-real' });
  };

  it('a truncated seats.json names itself unreadable', () => {
    seed();
    fs.writeFileSync(seatsFile('20261102-1500-real'), '{ nope');
    const snap = readQuestSnapshot(ROOT, 'fax-jam');
    expect(typeof snap.council.seatsError).toBe('string');
    expect(String(council('fax-jam').detail)).toContain('seats.json unreadable');
  });

  it('an absent seats.json still reads as unrecorded and carries no error (control)', () => {
    seed();
    fs.rmSync(seatsFile('20261102-1500-real'));
    const snap = readQuestSnapshot(ROOT, 'fax-jam');
    expect('seatsError' in snap.council).toBe(false);
    expect(String(council('fax-jam').detail)).toContain('seats.json unrecorded');
  });

  it('a healthy seats.json adds no seatsError key (snapshot byte-identity)', () => {
    seed();
    expect('seatsError' in readQuestSnapshot(ROOT, 'fax-jam').council).toBe(false);
  });
});
