import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assessQuest } from '@/lib/games/gtai-quest/assess';
import { loadQuestContext, loadQuestRules } from '@/lib/games/gtai-quest/loadContext';
import { parseQuestRules } from '@/lib/games/gtai-quest/questRules';
import { assessVocabulary, matchFailRule, whyTagUnplayable } from '@/lib/games/gtai-quest/vocabGuard';
import { CLEAN, RULES, RULES_RAW, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign } from '@/lib/games/gtai-quest/types';

const run = (d: QuestDesign) => assessVocabulary(d, ctx());
const codes = (d: QuestDesign) => run(d).findings.map((f) => `${f.code}@${f.ref}`);

describe('parseQuestRules', () => {
  it('projects the runtime table', () => {
    expect(RULES.verbs.find((v) => v.id === 'escort')).toEqual({ id: 'escort', needsTarget: true, needsLocation: true, needsEncounter: false, targetIsVehicle: false });
    expect(RULES.eventTags).toContain('wave-start');
  });
  it.each([
    ['another schema', { ...RULES_RAW, schema: 'gtai.quest-rules/1' }],
    ['a verb with no id', { ...RULES_RAW, verbs: [{ doc: 'x' }] }],
    ['a condition with neither values nor pattern', { ...RULES_RAW, conditions: [{ id: 'soul' }] }],
    ['fail groups that are not string arrays', { ...RULES_RAW, fail_rules: [{ id: 'x', groups: [[1]] }] }],
    ['not an object', []],
  ])('refuses %s', (_n, raw) => {
    expect(parseQuestRules(raw).ok).toBe(false);
  });
});

describe('assessVocabulary', () => {
  it('the clean fixture is green with no findings', () => {
    const v = run(CLEAN);
    expect(v.state).toBe('green');
    expect(v.findings).toEqual([]);
  });

  it('is unmeasured (never green) without a table', () => {
    expect(assessVocabulary(CLEAN, ctx({ rules: null })).state).toBe('unmeasured');
  });

  it('names a planted bad verb and the beat that uses it', () => {
    const d = mutate((x) => { x.beats[1].objective.verb = 'smuggle'; });
    const v = run(d);
    expect(v.state).toBe('red');
    expect(v.findings).toHaveLength(1);
    expect(v.findings[0]).toMatchObject({ code: 'VOCAB_UNKNOWN_VERB', severity: 'error', ref: 'the-run' });
    expect(v.findings[0].message).toContain('"smuggle"');
  });

  it('flags a missing target or location the verb needs', () => {
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'kill' }; }))).toEqual(['VOCAB_MISSING_TARGET@the-call']);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'meet' }; }))).toEqual(['VOCAB_MISSING_LOCATION@the-call']);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'escort', target: ' ' }; }))).toEqual(['VOCAB_MISSING_TARGET@the-call', 'VOCAB_MISSING_LOCATION@the-call']);
  });

  it('names each offending bark tag on its line', () => {
    const d = mutate((x) => {
      x.lines[0].when = ['boss-roar'];
      x.lines[1].when = ['mood:grim'];
      x.lines[2].when = ['soul:ghost', 'heat:high'];
      x.lines[3].when = ['quest:smuggle_done'];
    });
    expect(codes(d)).toEqual([
      'VOCAB_UNKNOWN_EVENT_TAG@fax-intro-1',
      'VOCAB_UNKNOWN_CONDITION@fax-intro-2',
      'VOCAB_UNKNOWN_CONDITION_VALUE@fax-brief-1',
      'VOCAB_UNKNOWN_CONDITION_VALUE@fax-brief-1',
      'VOCAB_UNKNOWN_EVENT_TAG@gearbox-1',
    ]);
    const msgs = run(d).findings.map((f) => f.message).join('\n');
    for (const bad of ['boss-roar', 'mood', 'ghost', 'heat:high', 'quest:smuggle_done']) expect(msgs).toContain(bad);
  });

  it('accepts every playable tag form', () => {
    for (const tag of ['kill', 'static-whisper-burst', 'quest:sabotage_done', 'soul:gearbox', 'madness:choir', 'weapon:none', 'heat:>=3', 'heat:2', 'heat:<=1']) {
      expect(whyTagUnplayable(tag, RULES), tag).toBeNull();
    }
  });

  it('a pattern that is not a valid regex matches nothing instead of throwing', () => {
    const rules = { ...RULES, conditions: [{ id: 'heat', pattern: '([' }] };
    expect(whyTagUnplayable('heat:2', rules)?.code).toBe('VOCAB_UNKNOWN_CONDITION_VALUE');
  });

  it('warns (not errors) on a fail state no fail rule detects', () => {
    const v = run(mutate((x) => { x.difficulty.failStates = ['the toner runs dry']; }));
    expect(v.state).toBe('green');
    expect(v.findings).toEqual([expect.objectContaining({ code: 'VOCAB_FAIL_STATE_UNDETECTABLE', severity: 'warn', ref: 'the toner runs dry' })]);
  });
});

describe('matchFailRule', () => {
  it('matches on whole words with multi-word keywords', () => {
    expect(matchFailRule('Rivet is destroyed: respawn at the Toner Room', RULES)).toBe('rivet_wasted');
    expect(matchFailRule('the van is wrecked', RULES)).toBe('car_destroyed');
    expect(matchFailRule('the target gets away', RULES)).toBe('target_escapes');
    expect(matchFailRule('cartridge destroyed', RULES)).toBeNull();
  });
});

describe('assessQuest wiring', () => {
  it('a planted verb blocks the quest and an owner override cannot waive it', () => {
    const d = mutate((x) => { x.beats[1].objective.verb = 'smuggle'; });
    expect(assessQuest('q', d, ctx()).blockedBy).toEqual(['vocabulary']);
    const waived = assessQuest('q', d, ctx(), [{ guard: 'vocabulary', reason: 'owner says so', at: '2026-11-03' }]);
    expect(waived.blocked).toBe(true);
  });
  it('the clean fixture stays unblocked across all six guards', () => {
    const v = assessQuest('q', CLEAN, ctx());
    expect(v.guards.map((g) => g.guard)).toEqual(['story', 'economy', 'lines', 'uniqueness', 'vocabulary', 'autosave']);
    expect(v.guards.find((g) => g.guard === 'vocabulary')?.state).toBe('green');
  });
});

describe('loadQuestRules / loadQuestContext', () => {
  const dirs: string[] = [];
  const gameRootWith = (body: string | null): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-vocab-'));
    dirs.push(d);
    if (body !== null) {
      fs.mkdirSync(path.join(d, 'project', 'data', 'tables'), { recursive: true });
      fs.writeFileSync(path.join(d, 'project', 'data', 'tables', 'quest_rules.json'), body);
    }
    return d;
  };
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

  it('reads the table from the game root', () => {
    expect(loadQuestRules(gameRootWith(JSON.stringify(RULES_RAW)))?.verbs.map((v) => v.id)).toContain('sabotage');
  });
  it('is null (so the guard is unmeasured) for no root, no file, bad JSON or another schema', () => {
    expect(loadQuestRules(null)).toBeNull();
    expect(loadQuestRules(gameRootWith(null))).toBeNull();
    expect(loadQuestRules(gameRootWith('{nope'))).toBeNull();
    expect(loadQuestRules(gameRootWith(JSON.stringify({ ...RULES_RAW, schema: 'x/9' })))).toBeNull();
  });
  it('loadQuestContext takes an explicit game root; null leaves the guard unmeasured', () => {
    const tmp = gameRootWith(null);
    expect(loadQuestContext(tmp, null, gameRootWith(JSON.stringify(RULES_RAW))).rules).not.toBeNull();
    expect(loadQuestContext(tmp, null, null).rules).toBeNull();
  });
});
