/**
 * Vocabulary guard: a quest may use only what the game runtime plays.
 *
 * The council's contract (`types.ts`) allows free verbs, bark tags and fail-state words; the Godot runtime
 * plays only what its `quest_rules.json` (`gtai.quest-rules/2`) declares, and refuses a package that uses
 * anything else at load (the owner-approved `collect-call` failed with 18 errors before the table grew).
 * This guard reads that table (`ctx.rules`) and names every offending verb, condition and tag.
 *
 * What it checks (rules table is the whole authority):
 *  - `VOCAB_UNKNOWN_VERB`: a beat's objective verb is not a `verbs[].id`;
 *  - `VOCAB_MISSING_TARGET` / `VOCAB_MISSING_LOCATION`: the verb row needs a target / location and the beat names none;
 *  - `VOCAB_UNKNOWN_EVENT_TAG`: a bare `when` tag is neither an `event_tags[].id` nor `quest:<verb>_done`;
 *  - `VOCAB_UNKNOWN_CONDITION`: a `<kind>:<value>` tag whose kind is no `conditions[].id`;
 *  - `VOCAB_UNKNOWN_CONDITION_VALUE`: a known kind with a value outside its `values` / `pattern`;
 *  - `VOCAB_FAIL_STATE_UNDETECTABLE` (warn): a fail-state phrase matches no `fail_rules` row (the runtime
 *    cannot detect that way to lose).
 *  - `VOCAB_UNKNOWN_PLACE` / `VOCAB_UNKNOWN_TARGET` / `VOCAB_NO_ENCOUNTER`: when the game has staged this quest's
 *    places table (`gtai.questMarkers/1`, `ctx.places`), a beat's location, target or encounter it does not hold
 *    (see `questPlaces.ts`). A quest with no table yet is not place-checked.
 * No table => `unmeasured`, never green. Pure.
 */
import { placeFindings } from '@/lib/games/gtai-quest/questPlaces';
import type {
  GuardFinding, GuardVerdict, QuestDesign, QuestGuardContext, QuestRules,
} from '@/lib/games/gtai-quest/types';

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** True when `keyword` (one or more words) occurs in `phrase` as a whole-word sequence. */
function hasKeyword(phraseWords: readonly string[], keyword: string): boolean {
  const k = words(keyword);
  if (k.length === 0) return false;
  for (let i = 0; i + k.length <= phraseWords.length; i++) if (k.every((w, j) => phraseWords[i + j] === w)) return true;
  return false;
}

/** The first fail rule whose every keyword group has a whole-word hit in `phrase`, or null (the runtime's rule). */
export function matchFailRule(phrase: string, rules: QuestRules): string | null {
  const pw = words(phrase);
  const hit = rules.failRules.find((r) => r.groups.length > 0 && r.groups.every((g) => g.some((kw) => hasKeyword(pw, kw))));
  return hit ? hit.id : null;
}

/** A table pattern that is not a valid regex matches nothing (the guard never throws on its input). */
function patternMatches(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

/** Why `tag` is not playable, or null when it is. `tag` is one entry of a line's `when`. */
export function whyTagUnplayable(tag: string, rules: QuestRules): { code: string; why: string } | null {
  const i = tag.indexOf(':');
  if (i < 0) {
    return rules.eventTags.includes(tag) ? null : { code: 'VOCAB_UNKNOWN_EVENT_TAG', why: `event tag "${tag}" is not declared (event tags: ${rules.eventTags.join(', ')}; or quest:<verb>_done)` };
  }
  const kind = tag.slice(0, i);
  const value = tag.slice(i + 1);
  if (kind === 'quest') {
    const m = /^(.+)_done$/.exec(value);
    return m && rules.verbs.some((v) => v.id === m[1])
      ? null
      : { code: 'VOCAB_UNKNOWN_EVENT_TAG', why: `"${tag}" is not quest:<verb>_done for a declared verb (${rules.verbs.map((v) => v.id).join(', ')})` };
  }
  const cond = rules.conditions.find((c) => c.id === kind);
  if (!cond) return { code: 'VOCAB_UNKNOWN_CONDITION', why: `condition kind "${kind}" is not declared (kinds: ${rules.conditions.map((c) => c.id).join(', ')})` };
  if (cond.values) {
    return cond.values.includes(value) ? null : { code: 'VOCAB_UNKNOWN_CONDITION_VALUE', why: `"${value}" is not a ${kind} value (${cond.values.join(', ')})` };
  }
  return cond.pattern && patternMatches(cond.pattern, value) ? null : { code: 'VOCAB_UNKNOWN_CONDITION_VALUE', why: `"${value}" does not match the ${kind} pattern ${cond.pattern ?? '(none)'}` };
}

export function assessVocabulary(design: QuestDesign, ctx: QuestGuardContext, questId?: string): GuardVerdict {
  const rules = ctx.rules;
  if (rules === null) return { guard: 'vocabulary', state: 'unmeasured', basis: 'no quest_rules.json (game root not resolved)', findings: [] };
  const findings: GuardFinding[] = [];
  const err = (code: string, message: string, ref: string) => findings.push({ code, severity: 'error', message, ref });

  for (const beat of design.beats) {
    const { verb, target, location } = beat.objective;
    const row = rules.verbs.find((v) => v.id === verb);
    if (!row) {
      err('VOCAB_UNKNOWN_VERB', `verb "${verb}" is not played by the runtime (verbs: ${rules.verbs.map((v) => v.id).join(', ')})`, beat.id);
      continue;
    }
    if (row.needsTarget && !target?.trim()) err('VOCAB_MISSING_TARGET', `verb "${verb}" needs an objective.target`, beat.id);
    if (row.needsLocation && !location?.trim()) err('VOCAB_MISSING_LOCATION', `verb "${verb}" needs an objective.location`, beat.id);
  }
  const places = questId === undefined ? undefined : ctx.places?.get(questId);
  if (places) findings.push(...placeFindings(design, rules, places));
  for (const line of design.lines) {
    for (const tag of line.when ?? []) {
      const bad = whyTagUnplayable(tag, rules);
      if (bad) err(bad.code, `line tag "${tag}": ${bad.why}`, line.id);
    }
  }
  for (const phrase of design.difficulty.failStates) {
    if (matchFailRule(phrase, rules) === null) {
      findings.push({
        code: 'VOCAB_FAIL_STATE_UNDETECTABLE', severity: 'warn', ref: phrase,
        message: `fail state "${phrase}" matches no fail rule (${rules.failRules.map((r) => r.id).join(', ')}): the runtime cannot detect it`,
      });
    }
  }
  return {
    guard: 'vocabulary',
    state: findings.some((f) => f.severity === 'error') ? 'red' : 'green',
    basis: `quest_rules.json (${rules.schema}): ${rules.verbs.length} verbs, ${rules.conditions.length} condition kinds, ${rules.eventTags.length} event tags; ${places ? `places checked against ${places.markers.length} markers` : 'no places table staged for this quest'}`,
    findings,
  };
}
