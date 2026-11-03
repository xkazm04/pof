/**
 * The `contracts` row (spark gta-quest-loop, WP2): registration, the four-state gradability, the stub
 * produce, and each step's derivation over fixture quest folders in a temp dir.
 *
 * The guard verdict is INJECTED (`assessQuest` mocked) so these tests hold for WP1's stubs and for real
 * guards alike; `loadQuestContext` / `loadProposals` are mocked for the same reason. Everything else —
 * parsing, the run lookup, art, judge and evidence reads — runs for real against the temp folders.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { QuestVerdict } from '@/lib/games/gtai-quest/types';

const inject = vi.hoisted(() => ({ verdict: null as QuestVerdict | null, proposals: [] as { pathId: string; title: string }[] }));
vi.mock('@/lib/games/gtai-quest/assess', () => ({
  assessQuest: (subject: string) => inject.verdict ?? { subject, guards: [], blockedBy: [], blocked: false },
}));
vi.mock('@/lib/games/gtai-quest/loadContext', () => ({
  loadQuestContext: () => ({ economy: null, voiceBibles: new Set(), cast: new Set(), ledger: [], judge: null }),
  loadProposals: () => inject.proposals,
  loadLedger: () => [],
}));

import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepGradability } from '@/lib/catalog/acceptance/stepGradability';
import { hasRegisteredChecker } from '@/lib/catalog/headless';
import { CONTRACT_STEPS, contractEntityId } from '@/lib/catalog/pipelines/contracts/contractsSnapshot';
import { readQuestSnapshot, listQuestIds } from '@/lib/catalog/pipelines/contracts/contractsRead';
import { ledgerRow, contractEntity } from '@/lib/catalog/pipelines/contracts/contractsSync';
import { parseQuestPackage } from '@/lib/catalog/pipelines/contracts/contractsParse';
import { questPackage, verdict, write, writeQuest } from './contractsFixture';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-contracts-'));
afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));
beforeEach(() => {
  fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true });
  inject.verdict = null;
  inject.proposals = [];
});

const stepOf = (id: string, label: string) => {
  const row = ledgerRow(readQuestSnapshot(ROOT, id));
  return row.steps.find((s) => s.label === label)!.acceptance;
};

describe('contracts pipeline — registration', () => {
  const pipeline = getCatalogPipeline('contracts')!;

  it('registers exactly the five steps, in order, and declares its packaging exemption', () => {
    expect(pipeline.steps.map((s) => s.label)).toEqual(['Council', 'Plan', 'Guards', 'Package', 'In-game']);
    expect(CONTRACT_STEPS.map((s) => s.label)).toEqual(pipeline.steps.map((s) => s.label));
    expect(pipeline.packagingExempt).toMatch(/Godot/);
  });

  it('every step is server-gradable as `registered` — never `unknown`', () => {
    for (const s of pipeline.steps) expect(stepGradability('contracts', s.label, hasRegisteredChecker)).toEqual({ kind: 'registered' });
  });

  it('stub produce on an unsynced entity writes the awaiting-sync marker and defers at L3 with the reason', () => {
    for (const s of pipeline.steps) {
      const out = s.produce({ id: 'contract-awaiting-sync', name: 'Starter', lifecycle: 'planned', data: {} }, 'push it');
      const r = s.accept(out.data!);
      expect(r.status, s.label).toBe('deferred');
      expect(r.tier, s.label).toBe('L3');
      expect(r.reason, s.label).toMatch(/awaiting quest sync/);
    }
  });

  it('stub produce on a synced entity re-projects the mirrored folder read (never invents)', () => {
    writeQuest(ROOT, 'fax-jam', { selftest: 'succeeded', frame: true });
    inject.verdict = verdict('fax-jam');
    const entity = contractEntity(readQuestSnapshot(ROOT, 'fax-jam'));
    expect(entity.id).toBe(contractEntityId('fax-jam'));
    expect(entity.provenance).toMatchObject({ kind: 'authored', canonProfile: 'gtai' });
    const lab = { id: entity.id, name: entity.name, lifecycle: 'planned' as const, data: entity.data };
    const statuses = pipeline.steps.map((s) => s.accept(s.produce(lab).data!).status);
    expect(statuses).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
  });
});

describe('contracts pipeline — derivations over fixture folders', () => {
  it('lists quest folders, never `_council`', () => {
    writeQuest(ROOT, 'fax-jam');
    expect(listQuestIds(ROOT)).toEqual(['fax-jam']);
  });

  it('Council: the inferred run passes with seats; no run fails; two candidate runs are ambiguous (pending)', () => {
    writeQuest(ROOT, 'fax-jam');
    inject.proposals = [{ pathId: 'claude-A', title: 'The Jam' }];
    const ok = stepOf('fax-jam', 'Council');
    expect(ok.status).toBe('pass');
    expect(ok.detail).toMatch(/inferred/);
    expect(ok.detail).toMatch(/grok skipped/);
    write(ROOT, 'games/gtai/quests/_council/other-run/proposals.claude.json', []);
    expect(stepOf('fax-jam', 'Council')).toMatchObject({ status: 'pending' });
    fs.rmSync(path.join(ROOT, 'games/gtai/quests/_council'), { recursive: true });
    expect(stepOf('fax-jam', 'Council')).toMatchObject({ status: 'fail' });
  });

  it('Council: a declared provenance.runId whose folder is missing fails', () => {
    const pkg = questPackage('fax-jam');
    writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, provenance: { ...pkg.provenance, runId: 'gone' } }, runId: null });
    expect(stepOf('fax-jam', 'Council')).toMatchObject({ status: 'fail', reason: expect.stringMatching(/gone does not exist/) });
  });

  it('Plan: parses as gtai.quest/1 with whyNotFiller + ownerNotes; empty notes or a bad package fail', () => {
    writeQuest(ROOT, 'fax-jam');
    expect(stepOf('fax-jam', 'Plan').status).toBe('pass');
    expect(stepOf('fax-jam', 'Plan').detail).toContain('1 autosave point(s)');
    writeQuest(ROOT, 'fax-jam', { pkg: questPackage('fax-jam', { whyNotFiller: ' ' }) });
    expect(stepOf('fax-jam', 'Plan')).toMatchObject({ status: 'fail', reason: expect.stringMatching(/whyNotFiller/) });
    writeQuest(ROOT, 'fax-jam', { pkg: { ...questPackage('fax-jam'), id: 'other' } });
    expect(stepOf('fax-jam', 'Plan')).toMatchObject({ status: 'fail', reason: expect.stringMatching(/folder name/) });
    expect(parseQuestPackage({ ...questPackage('x'), schema: 'gtai.quest/2' }, 'x').ok).toBe(false);
  });

  it('Guards: blocked fails; an overridden red guard passes and shows the reason', () => {
    writeQuest(ROOT, 'fax-jam');
    inject.verdict = verdict('fax-jam', { economy: 'red' });
    expect(stepOf('fax-jam', 'Guards')).toMatchObject({ status: 'fail', reason: expect.stringMatching(/economy/) });
    writeQuest(ROOT, 'fax-jam', { pkg: questPackage('fax-jam', { overrides: [{ guard: 'economy', reason: 'owner: payday act', at: '2026-11-02' }] }) });
    inject.verdict = verdict('fax-jam', { economy: 'red' }, ['economy']);
    const r = stepOf('fax-jam', 'Guards');
    expect(r.status).toBe('pass');
    expect(r.detail).toMatch(/economy overridden: owner: payday act/);
  });

  it('Guards: a red vocabulary guard fails the step and is named; the owner cannot override it away', () => {
    writeQuest(ROOT, 'fax-jam');
    inject.verdict = verdict('fax-jam', { vocabulary: 'red' });
    expect(stepOf('fax-jam', 'Guards')).toMatchObject({ status: 'fail', detail: 'blocked by vocabulary', reason: expect.stringMatching(/vocabulary:FIXTURE_RED/) });
    inject.verdict = verdict('fax-jam', { vocabulary: 'unmeasured' });
    expect(stepOf('fax-jam', 'Guards')).toMatchObject({ status: 'pending', reason: expect.stringContaining('vocabulary (no table)') });
  });

  it('Guards: an unmeasured guard or a missing judge report is "not yet" (pending), never pass', () => {
    writeQuest(ROOT, 'fax-jam');
    inject.verdict = verdict('fax-jam', { economy: 'unmeasured' });
    expect(stepOf('fax-jam', 'Guards')).toMatchObject({ status: 'pending', reason: expect.stringMatching(/unmeasured/) });
    writeQuest(ROOT, 'fax-jam', { judge: false });
    fs.rmSync(path.join(ROOT, 'games/gtai/quests/fax-jam/verdicts'), { recursive: true });
    inject.verdict = verdict('fax-jam');
    expect(stepOf('fax-jam', 'Guards')).toMatchObject({ status: 'pending', reason: expect.stringMatching(/lines\.judge\.json is missing/) });
  });

  it('Package: a new character without art is pending and named; a line without `audio` fails', () => {
    writeQuest(ROOT, 'fax-jam', { art: false });
    expect(stepOf('fax-jam', 'Package')).toMatchObject({ status: 'pending', reason: expect.stringMatching(/clerk-7/) });
    write(ROOT, 'games/gtai/quests/fax-jam/art/clerk-7/torso.png', 'x');
    expect(stepOf('fax-jam', 'Package').status).toBe('pass');
    const pkg = questPackage('fax-jam');
    writeQuest(ROOT, 'fax-jam', { pkg: { ...pkg, lines: [{ id: 'l1', speaker: 'don-fax', purpose: ['funny'], text: 'Jam it.' }] } });
    expect(stepOf('fax-jam', 'Package')).toMatchObject({ status: 'fail', reason: expect.stringMatching(/l1/) });
  });

  it('In-game: no evidence defers with the Godot adapter reason; selftest + PNG passes; failed fails; no frame defers', () => {
    writeQuest(ROOT, 'fax-jam');
    expect(stepOf('fax-jam', 'In-game')).toMatchObject({ status: 'deferred', tier: 'L3', reason: expect.stringMatching(/Godot .*(no Godot adapter yet)/) });
    writeQuest(ROOT, 'fax-jam', { selftest: 'succeeded' });
    expect(stepOf('fax-jam', 'In-game')).toMatchObject({ status: 'deferred', reason: expect.stringMatching(/PNG frame is missing/) });
    write(ROOT, 'games/gtai/quests/fax-jam/evidence/fake.png', 'not a png');
    expect(stepOf('fax-jam', 'In-game').status).toBe('deferred');
    writeQuest(ROOT, 'fax-jam', { selftest: 'succeeded', frame: true });
    expect(stepOf('fax-jam', 'In-game')).toMatchObject({ status: 'pass', tier: 'L3' });
    writeQuest(ROOT, 'fax-jam', { selftest: 'failed', frame: true });
    expect(stepOf('fax-jam', 'In-game')).toMatchObject({ status: 'fail' });
  });

  it('an unparseable package is still a ledger row, with the parse error and nothing passing downstream', () => {
    write(ROOT, 'games/gtai/quests/broken/quest.json', '{ nope');
    const row = ledgerRow(readQuestSnapshot(ROOT, 'broken'));
    expect(row.verdict).toBeNull();
    expect(row.steps.map((s) => s.acceptance.status)).toEqual(['fail', 'fail', 'pending', 'pending', 'deferred']);
  });
});
