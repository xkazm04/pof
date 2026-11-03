import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLEAN } from '@/__tests__/games/gtai-quest/fixtures';

type Json = Record<string, unknown>;
const proposal = (over: Json = {}): Json => ({ ...structuredClone(CLEAN), schema: 'gtai.questProposal/1', seat: 'claude', variant: 'A', pathId: 'claude-A', ...over });

/** council.mjs carries a shebang vite cannot parse, so its validator runs in a plain Node process. */
const COUNCIL = pathToFileURL(path.join(process.cwd(), 'games', 'gtai', 'quest', 'council.mjs')).href;
const SCRIPT = `const { validateDelivery } = await import(process.argv[1]); const p = JSON.parse(process.argv[2]);
console.log(JSON.stringify(validateDelivery([p], { seat: 'claude', act: 'act1', variants: 1, lines: [1, 20] })));`;
const autosaveErrors = (p: Json): string[] =>
  (JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT, COUNCIL, JSON.stringify(p)], { encoding: 'utf8' })) as string[]).filter((e) => e.includes('autosave'));

describe('council seat delivery: autosavePoints', () => {
  it('a design with valid points raises no autosave error', () => {
    expect(autosaveErrors(proposal())).toEqual([]);
  });

  it('a design without the field is refused by name', () => {
    const p = proposal();
    delete p.autosavePoints;
    expect(autosaveErrors(p)).toEqual(['[0]: missing required "autosavePoints"']);
  });

  it('an empty list, an unknown beat and a duplicate id are refused', () => {
    expect(autosaveErrors(proposal({ autosavePoints: [] })).join(' ')).toContain('needs at least 1 item');
    const pt = { id: 'as-x', beat: 'the-moon', at: 'start', why: 'because' };
    expect(autosaveErrors(proposal({ autosavePoints: [pt] }))).toEqual([expect.stringContaining('"as-x"].beat "the-moon" is not a beat id')]);
    const ok = { ...pt, beat: 'the-run' };
    expect(autosaveErrors(proposal({ autosavePoints: [ok, ok] }))).toEqual([expect.stringContaining('duplicate id "as-x"')]);
  });

  it('a bad "at" and an empty why are schema errors', () => {
    const bad = { id: 'as-x', beat: 'the-run', at: 'middle', why: '' };
    const errs = autosaveErrors(proposal({ autosavePoints: [bad] }));
    expect(errs.join(' ')).toMatch(/at: must be one of "start", "end"/);
    expect(errs.join(' ')).toMatch(/why: must not be empty/);
  });
});
