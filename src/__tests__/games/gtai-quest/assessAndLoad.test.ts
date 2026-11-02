// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assessQuest } from '@/lib/games/gtai-quest/assess';
import { loadLedger, loadProposals, loadQuestContext } from '@/lib/games/gtai-quest/loadContext';
import { logger } from '@/lib/logger';
import { CLEAN, ECONOMY, LEDGER_QUEST, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';

describe('assessQuest', () => {
  it('passes the clean fixture through every guard', () => {
    const v = assessQuest('per-my-last-fax', CLEAN, ctx());
    expect(v.guards.map((g) => [g.guard, g.state])).toEqual([['story', 'green'], ['economy', 'green'], ['lines', 'green'], ['uniqueness', 'green']]);
    expect(v.blocked).toBe(false);
  });

  it('blocks on a red guard and stops blocking with a reasoned override', () => {
    const red = mutate((d) => { d.story.writes.push({ var: 'betrayer', value: 'don-fax' }); });
    const v = assessQuest('x', red, ctx());
    expect(v.blocked).toBe(true);
    expect(v.blockedBy).toEqual(['story']);
    const ok = assessQuest('x', red, ctx(), [{ guard: 'story', reason: 'owner resolved the betrayer', at: '2026-11-02' }]);
    expect(ok.blocked).toBe(false);
    const blank = assessQuest('x', red, ctx(), [{ guard: 'story', reason: '  ', at: '2026-11-02' }]);
    expect(blank.blocked).toBe(true);
  });

  it('an unmeasured economy neither blocks nor passes', () => {
    const v = assessQuest('x', CLEAN, ctx({ economy: null }));
    expect(v.guards.find((g) => g.guard === 'economy')?.state).toBe('unmeasured');
    expect(v.blocked).toBe(false);
  });
});

describe('loaders (temp dir)', () => {
  let root: string;
  let run: string;
  beforeAll(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gtai-quest-'));
    const g = (...p: string[]) => path.join(root, 'games', 'gtai', ...p);
    const write = (file: string, body: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
    write(g('quests', LEDGER_QUEST.id, 'quest.json'), JSON.stringify(LEDGER_QUEST));
    write(g('quests', '_draft', 'quest.json'), JSON.stringify({ ...LEDGER_QUEST, id: '_draft' }));
    write(g('quests', 'broken', 'quest.json'), '{ not json');
    write(g('voices', 'don-fax.md'), '# Don Fax');
    write(g('voices', 'rivet.md'), '# Rivet');
    write(g('voices', 'notes.txt'), 'ignored');
    write(g('balance', 'quest-economy.json'), JSON.stringify(ECONOMY));
    run = path.join(root, 'run');
    write(path.join(run, 'proposals.claude.json'), JSON.stringify([{ pathId: 'claude-A' }, { pathId: 'claude-B' }]));
  });
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('loadLedger reads quest packages, skips _ folders and unparseable files without throwing', () => {
    expect(loadLedger(root).map((p) => p.id)).toEqual([LEDGER_QUEST.id]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('loadQuestContext assembles economy, voice bibles, cast and ledger', () => {
    const c = loadQuestContext(root);
    expect(c.economy?.revision).toBe(1);
    expect([...c.voiceBibles].sort()).toEqual(['don-fax', 'rivet']);
    expect(c.cast.has('general-krump')).toBe(true);
    expect(c.cast.has('dust-bunny')).toBe(true);
    expect(c.ledger).toHaveLength(1);
    expect(c.judge).toBeNull();
  });

  it('a missing economy table yields null (unmeasured), and a missing root yields an empty context', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gtai-quest-empty-'));
    try {
      const c = loadQuestContext(empty);
      expect(c.economy).toBeNull();
      expect(c.ledger).toEqual([]);
      expect(c.voiceBibles.size).toBe(0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('loadProposals reads each seat file; a missing seat produced nothing', () => {
    expect(loadProposals(run).map((p) => p.pathId)).toEqual(['claude-A', 'claude-B']);
    expect(loadProposals(path.join(root, 'nope'))).toEqual([]);
  });
});
