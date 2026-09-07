import { describe, it, expect } from 'vitest';
import {
  MODULE_CONTEXTS,
  buildEvalPrompt,
  getEvaluableModuleIds,
  hasModuleContext,
} from '@/lib/evaluator/module-eval-prompts';
import { maxWordsPerEntry } from '@/lib/catalog/acceptance/dataCheckers';

/**
 * Findings from the 2026-09-07 `/research` run on "Dynamic NPC Dialogue in Unity
 * (Local LLM + TTS)" — a local-LLM + local-TTS NPC dialogue package.
 *
 * Three verified gaps, each pinned here:
 *  1. `audio` is a real SUB_MODULE_ID with NO MODULE_CONTEXTS entry, so every
 *     audio evaluation fell through `buildEvalPrompt`'s generic fallback ("check
 *     file organization and class hierarchy") — the module was effectively unjudged.
 *  2. `dialogue-quests` judged dialog STRUCTURE and quest solution coverage but
 *     never whether an NPC's lines are consistent with world state — the exact
 *     failure the video demonstrates live (a shopkeep answers "I'm not sure what
 *     you're talking about" about her own shop, then invents "ruffians from the
 *     north" that contradict the established wolf premise).
 *  3. The dialog-trees VO Script step DECLARES `maxLineLength: 10` in its own
 *     produced data and accepted with `minCount('voLines', 1)` — one line of text
 *     passed a step that declares five SoundCue assets. `maxWordsPerEntry` is the
 *     reusable checker that makes the step enforce the cap it states.
 */

describe('audio module eval context (research finding 1)', () => {
  it('audio has its own eval context — not the generic fallback', () => {
    expect(MODULE_CONTEXTS['audio']).toBeDefined();
  });

  it('REACH: the context is what makes audio evaluable at all', () => {
    // getEvaluableModuleIds() is Object.keys(MODULE_CONTEXTS), and the evaluator's
    // ModuleSelectorPanel offers exactly that list — so before this entry existed
    // `audio` could not even be SELECTED for a deep eval, let alone judged well.
    expect(hasModuleContext('audio')).toBe(true);
    expect(getEvaluableModuleIds()).toContain('audio');
  });

  it('audio eval prompt carries audio-specific checks, not the generic ones', () => {
    const prompt = buildEvalPrompt({
      moduleId: 'audio',
      pass: 'quality',
      projectName: 'PoF',
      moduleName: 'Audio',
      sourcePath: 'Source/PoF',
    });
    // The generic fallback's tell-tale line must be gone.
    expect(prompt).not.toContain('Check UE5 coding conventions (UPROPERTY, UFUNCTION, etc.)');
    expect(prompt.toLowerCase()).toContain('licen');
  });

  it('audio context defines all four check groups', () => {
    const ctx = MODULE_CONTEXTS['audio']!;
    expect(ctx.focus.length).toBeGreaterThan(20);
    expect(ctx.structureChecks.length).toBeGreaterThan(80);
    expect(ctx.qualityChecks.length).toBeGreaterThan(80);
    expect(ctx.performanceChecks.length).toBeGreaterThan(80);
  });

  it('records the two-axis licence rule for generated/cloned speech', () => {
    const ctx = MODULE_CONTEXTS['audio']!;
    const all = `${ctx.structureChecks}\n${ctx.qualityChecks}`.toLowerCase();
    // A cloned voice inherits the reference sample's terms as well as the
    // model weights' licence — the video baked an ElevenLabs-generated sample
    // into an "Apache licensed, distribution is totally fine" stack.
    expect(all).toContain('reference');
    expect(all).toContain('weights');
  });

  it('requires every speaking character to have a bound voice', () => {
    const ctx = MODULE_CONTEXTS['audio']!;
    expect(ctx.structureChecks.toLowerCase()).toContain('speaker');
  });
});

describe('dialogue-quests world-fact grounding (research finding 2)', () => {
  it('quality checks require NPC lines to be consistent with world state', () => {
    const q = MODULE_CONTEXTS['dialogue-quests']!.qualityChecks.toLowerCase();
    expect(q).toContain('world state');
  });

  it('keeps the pre-existing Cain-batch checks intact', () => {
    const q = MODULE_CONTEXTS['dialogue-quests']!.qualityChecks;
    expect(q).toContain('No one-shot dialog solutions');
    expect(q).toContain('Playthrough-build solution coverage');
  });
});

describe('maxWordsPerEntry checker (research finding 3)', () => {
  const label = 'VO lines ≤ 10 words';

  it('passes the REAL produced VO lines from the dialog-trees exemplar', () => {
    // Captured verbatim from dialog-trees.ts produce() — not invented.
    const voLines = [
      'DIALOG_GATEKEEPERGREETING_VAEL_ROOT: "State your business or leave."',
      'DIALOG_GATEKEEPERGREETING_PLAYER_ASK: "I\'m here to learn about the Order."',
      'DIALOG_GATEKEEPERGREETING_PLAYER_THREATEN: "Step aside or I\'ll make you."',
      'DIALOG_GATEKEEPERGREETING_PLAYER_PERSUADE: "I know about the Ember Pact."',
      'DIALOG_GATEKEEPERGREETING_VAEL_ASK_RESP: "The Order doesn\'t recruit. Come back stronger."',
      'DIALOG_GATEKEEPERGREETING_VAEL_THREATEN_WARN: "Last warning."',
      'DIALOG_GATEKEEPERGREETING_VAEL_SKILL_PASS: "You\'ve done your homework. Follow."',
      'DIALOG_GATEKEEPERGREETING_VAEL_SKILL_FAIL: "Words without proof. Go."',
    ];
    const r = maxWordsPerEntry('voLines', label, 10)({ voLines });
    expect(r.status).toBe('pass');
  });

  it('counts only the SPOKEN text, not the loc-key prefix', () => {
    // The key alone is long; the spoken half is 4 words. Counting the whole
    // entry would fail this valid line.
    const voLines = ['DIALOG_A_VERY_LONG_LOCALIZATION_KEY_NAME_HERE: "State your business now."'];
    const r = maxWordsPerEntry('voLines', label, 10)({ voLines });
    expect(r.status).toBe('pass');
  });

  it('fails a line over the cap and names the offending entry', () => {
    const voLines = [
      'DIALOG_X_ROOT: "Short line."',
      'DIALOG_X_LONG: "I have been standing at this gate for eleven long years and I will not move aside."',
    ];
    const r = maxWordsPerEntry('voLines', label, 10)({ voLines });
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('[1]');
  });

  it('is pending — never a false pass — when nothing has been produced', () => {
    expect(maxWordsPerEntry('voLines', label, 10)({}).status).toBe('pending');
    expect(maxWordsPerEntry('voLines', label, 10)({ voLines: [] }).status).toBe('pending');
  });

  it('handles an unquoted entry by counting the whole string', () => {
    const voLines = ['one two three'];
    expect(maxWordsPerEntry('voLines', label, 10)({ voLines }).status).toBe('pass');
    expect(maxWordsPerEntry('voLines', label, 2)({ voLines }).status).toBe('fail');
  });
});
