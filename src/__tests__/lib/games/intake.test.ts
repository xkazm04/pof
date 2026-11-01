/**
 * Pitch intake, the pure half (spark gtai-uprising-project, WP3): the callback parser refuses the
 * whole body on the first bad proposal with a reason naming it, the prompt names the profile / id
 * prefix / usable-vs-planned catalogs and ends in one callback block, and the versioned files are
 * read leniently and written atomically, sorted and only under a POF_GAMES_ROOT override.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_INTAKE_PROPOSALS, parseIntakeCallback, type IntakeParseContext } from '@/lib/games/intake/parse';
import { buildIntakePrompt, intakeCallbackDescriptor, intakeCallbackId } from '@/lib/games/intake/prompt';
import {
  PITCH_PLACEHOLDER_MARKER, gameDesignDir, readGameCanon, readPitch, upsertGameEntityFile, upsertGameRuleFile,
} from '@/lib/games/intake/files';
import { GAMES } from '@/lib/games/registry';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const CTX: IntakeParseContext = { gameId: 'gtai', authoringProfile: 'gtai', manifestCatalogs: ['bestiary', 'quests'] };

const ruleP = (over: Record<string, unknown> = {}, ruleOver: Record<string, unknown> = {}) => ({
  id: 'p1', kind: 'rule', sourceSection: '## Tone',
  rule: { id: 'gtai-tone', category: 'game', title: 'Dark comedy', body: 'Every contract has one absurd beat.', profile: 'gtai', ...ruleOver },
  ...over,
});
const entityP = (over: Record<string, unknown> = {}, entOver: Record<string, unknown> = {}) => ({
  id: 'p2', kind: 'entity', sourceSection: '## Cast',
  entity: { catalogId: 'bestiary', entityId: 'gtai-beat-cop', name: 'Beat Cop', tags: ['police'], ...entOver },
  ...over,
});
const parse = (proposals: unknown[], runId: unknown = 'run-1') => parseIntakeCallback({ runId, proposals }, CTX);
const errorOf = (r: ReturnType<typeof parse>) => (r.ok ? '' : r.error);

describe('parseIntakeCallback', () => {
  it('accepts a rule and an entity, defaulting scope, tags-less data and trimming', () => {
    const r = parse([ruleP(), entityP({ sourceSection: '  ## Cast  ' }, { tags: undefined, name: ' Beat Cop ' })], ' run-1 ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.runId).toBe('run-1');
    expect(r.data.proposals[0]).toMatchObject({ kind: 'rule', rule: { id: 'gtai-tone', scope: 'global', profile: 'gtai' } });
    expect(r.data.proposals[1]).toEqual({
      id: 'p2', kind: 'entity', sourceSection: '## Cast',
      entity: { catalogId: 'bestiary', entityId: 'gtai-beat-cop', name: 'Beat Cop', tags: [], data: {} },
    });
  });

  it('accepts a rule scoped to a manifest catalog and refuses one scoped elsewhere', () => {
    expect(parse([ruleP({}, { scope: 'quests' })]).ok).toBe(true);
    expect(errorOf(parse([ruleP({}, { scope: 'affixes' })]))).toMatch(/proposals\[0\].*Unknown scope "affixes"/);
  });

  it('refuses a rule whose profile is absent or another world', () => {
    expect(errorOf(parse([ruleP({}, { profile: undefined })]))).toMatch(/profile is absent \(reads as "pof"\).*"gtai"/);
    expect(errorOf(parse([ruleP({}, { profile: 'pof' })]))).toMatch(/profile is "pof"/);
  });

  it('refuses a rule missing a required field, naming the field', () => {
    expect(errorOf(parse([ruleP({}, { body: '  ' })]))).toBe('proposals[0]: rule is missing "body"');
    expect(errorOf(parse([{ id: 'p1', kind: 'rule', sourceSection: 'x' }]))).toMatch(/needs a "rule" object/);
  });

  it('refuses an entity without the game prefix, or with only the prefix', () => {
    expect(errorOf(parse([entityP({}, { entityId: 'beat-cop' })]))).toMatch(/must start with "gtai-"/);
    expect(errorOf(parse([entityP({}, { entityId: 'gtai-' })]))).toMatch(/must start with "gtai-"/);
  });

  it('refuses an entity in a catalog outside the manifest, listing the usable ones', () => {
    expect(errorOf(parse([entityP({}, { catalogId: 'vehicles' })]))).toMatch(/"vehicles" is not a registered pipeline.*\(bestiary, quests\)/);
    const empty = parseIntakeCallback({ runId: 'r', proposals: [entityP()] }, { ...CTX, manifestCatalogs: [] });
    expect(empty.ok ? '' : empty.error).toMatch(/the manifest is empty/);
  });

  it('refuses non-string tags and a missing name', () => {
    expect(errorOf(parse([entityP({}, { tags: ['ok', 3] })]))).toMatch(/tags must be string\[\]/);
    expect(errorOf(parse([entityP({}, { name: '' })]))).toMatch(/missing "name"/);
  });

  it('refuses duplicate proposal, rule and entity ids', () => {
    expect(errorOf(parse([ruleP(), ruleP()]))).toMatch(/proposals\[1\]: duplicate proposal id "p1"/);
    expect(errorOf(parse([ruleP(), ruleP({ id: 'p9' })]))).toMatch(/duplicate rule id "gtai-tone"/);
    expect(errorOf(parse([entityP(), entityP({ id: 'p9' })]))).toMatch(/duplicate entity id "bestiary\/gtai-beat-cop"/);
  });

  it('refuses the whole body on the first bad proposal, and a bad envelope', () => {
    expect(errorOf(parse([ruleP(), { id: 'p3', kind: 'lore', sourceSection: 'x' }]))).toBe('proposals[1]: kind must be "rule" or "entity", got "lore"');
    expect(errorOf(parse([ruleP({ sourceSection: '' })]))).toMatch(/missing "sourceSection"/);
    expect(errorOf(parse([ruleP()], ''))).toMatch(/runId is required/);
    expect(errorOf(parse([ruleP()], 'x'.repeat(121)))).toMatch(/runId is required/);
    expect(parseIntakeCallback(null, CTX).ok).toBe(false);
    expect(parseIntakeCallback({ runId: 'r', proposals: {} }, CTX).ok).toBe(false);
    const many = Array.from({ length: MAX_INTAKE_PROPOSALS + 1 }, (_, i) => ruleP({ id: `p${i}` }, { id: `gtai-r${i}` }));
    expect(errorOf(parse(many))).toMatch(/too many proposals/);
  });
});

describe('buildIntakePrompt', () => {
  const registered = ['bestiary', 'quests', 'items'];
  const prompt = buildIntakePrompt({ game: GAMES.gtai, authoringProfile: 'gtai', pitch: '\n# GTAI\nA robot takes contracts.\n', registered, runId: 'run-abc' });

  it('names the authoring profile, the id prefix and the pitch verbatim', () => {
    expect(prompt).toContain('"profile": "gtai"');
    expect(prompt).toContain('Rule ids start with `gtai-`');
    expect(prompt).toContain('```markdown\n\n# GTAI\nA robot takes contracts.\n\n```');
  });

  it('lists only manifest ∩ registered as usable and planned pipelines apart', () => {
    const usable = prompt.split('## Usable manifest catalogs')[1].split('## Planned')[0];
    expect(usable).toContain('`bestiary` (reskin)');
    expect(usable).toContain('`quests` (reskin)');
    expect(usable).not.toContain('`items`'); // registered but omitted from the GTAI manifest
    expect(usable).not.toContain('`vfx`'); // in the manifest but not registered here
    expect(prompt).toContain('## Planned pipelines (not built — propose NO entities for these)');
    expect(prompt).toContain('`vehicles` (planned)');
  });

  it('says rules only when no manifest catalog is registered', () => {
    const bare = buildIntakePrompt({ game: GAMES.gtai, authoringProfile: 'gtai', pitch: 'p', registered: [], runId: 'r' });
    expect(bare).toContain('propose rules only');
  });

  it('ends in exactly one callback block whose runId is a static field', () => {
    const cb = intakeCallbackDescriptor('gtai', 'run-abc');
    expect(cb).toMatchObject({ url: '/api/games/gtai/intake', method: 'POST', staticFields: { runId: 'run-abc' } });
    expect(prompt.match(/@@CALLBACK:/g)).toHaveLength(1);
    expect(prompt).toContain(`@@CALLBACK:${cb.id}`);
    expect(prompt.trimEnd().endsWith('@@END_CALLBACK')).toBe(true);
    expect(intakeCallbackId('GTAI', 'Run #7 / x')).toBe('intake-gtai-run-7-x');
    expect(intakeCallbackId('gtai', '!!!')).toBe('intake-gtai-run');
  });
});

describe('versioned design files', () => {
  let root: string;
  const prevRoot = process.env.POF_GAMES_ROOT;
  const rule = (id: string, body = 'b'): ProjectRule => ({ id, category: 'game', scope: 'global', title: id, body, profile: 'gtai' });
  const entity = (catalogId: string, id: string): StoredCatalogEntity => ({ id, catalogId, name: id, categoryPath: [], tags: [], lifecycle: 'planned', data: {} } as StoredCatalogEntity);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-intake-files-'));
    process.env.POF_GAMES_ROOT = root;
  });
  afterEach(() => {
    if (prevRoot === undefined) delete process.env.POF_GAMES_ROOT; else process.env.POF_GAMES_ROOT = prevRoot;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reads a missing or marked pitch as a placeholder and real text as a pitch', () => {
    expect(readPitch('gtai', root)).toEqual({ placeholder: true, text: '' });
    fs.mkdirSync(path.join(root, 'games/gtai'), { recursive: true });
    const file = path.join(root, 'games/gtai/pitch.md');
    fs.writeFileSync(file, `﻿${PITCH_PLACEHOLDER_MARKER}\r\n# Pitch\n`);
    expect(readPitch('gtai', root).placeholder).toBe(true);
    fs.writeFileSync(file, '   \n');
    expect(readPitch('gtai', root).placeholder).toBe(true);
    fs.writeFileSync(file, '# GTAI\nRobots.\n');
    expect(readPitch('gtai', root)).toEqual({ placeholder: false, text: '# GTAI\nRobots.\n' });
  });

  it('gives PoF no design dir: an empty read and a refused write', () => {
    expect(gameDesignDir('pof', root)).toBeNull();
    expect(readGameCanon('pof', root)).toEqual({ ok: true, data: [] });
    expect(readPitch('pof', root).placeholder).toBe(true);
    expect(() => upsertGameRuleFile('pof', rule('pof-x'), root)).toThrow(/no designDir/);
  });

  it('writes sorted, two-space JSON with a trailing newline, replacing by key', () => {
    upsertGameRuleFile('gtai', rule('gtai-b'), root);
    upsertGameRuleFile('gtai', rule('gtai-a'), root);
    const out = upsertGameRuleFile('gtai', rule('gtai-b', 'changed'), root);
    expect(out.ok && out.data.map((r) => r.id)).toEqual(['gtai-a', 'gtai-b']);
    const text = fs.readFileSync(path.join(root, 'games/gtai/canon.json'), 'utf8');
    expect(text).toBe(`${JSON.stringify([rule('gtai-a'), rule('gtai-b', 'changed')], null, 2)}\n`);
    expect(fs.readdirSync(path.join(root, 'games/gtai')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('keys entities by catalogId/id, so the same id in two catalogs is two rows', () => {
    upsertGameEntityFile('gtai', entity('quests', 'gtai-x'), root);
    const out = upsertGameEntityFile('gtai', entity('bestiary', 'gtai-x'), root);
    expect(out.ok && out.data.map((e) => `${e.catalogId}/${e.id}`)).toEqual(['bestiary/gtai-x', 'quests/gtai-x']);
  });

  it('refuses to rewrite a file it cannot read, leaving it untouched', () => {
    fs.mkdirSync(path.join(root, 'games/gtai'), { recursive: true });
    const file = path.join(root, 'games/gtai/canon.json');
    fs.writeFileSync(file, '{ not json');
    const out = upsertGameRuleFile('gtai', rule('gtai-a'), root);
    expect(out.ok).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not json');
    fs.writeFileSync(file, '{"a":1}');
    expect(readGameCanon('gtai', root)).toMatchObject({ ok: false, error: expect.stringMatching(/expected a JSON array/) });
  });

  it('refuses a write under vitest without POF_GAMES_ROOT', () => {
    delete process.env.POF_GAMES_ROOT;
    expect(() => upsertGameRuleFile('gtai', rule('gtai-a'), root)).toThrow(/without POF_GAMES_ROOT/);
    expect(fs.existsSync(path.join(root, 'games'))).toBe(false);
  });
});
