/**
 * Line guard: owner doctrine "no line is filler" made checkable.
 *
 * Structural checks always run (they need no model). The cross-family judge
 * (`verdicts/lines.judge.json`) adds the "does the line earn its purpose" verdicts when it ran.
 * Shaped by the registry's `line-craft/llm-dialogue-quality-control`:
 *  - the judge comes from ANOTHER family than the author (same seat = JUDGE_SAME_FAMILY, error);
 *  - a ban list is a measurement; an unmeasured list is EDITORIAL and must say so. The tell
 *    patterns below are editorial (a small structural set nobody has measured against a human
 *    reference), so EDITORIAL_TELL is only ever `warn` and its message starts `editorial (unmeasured):`;
 *  - a phrase fresh in one slot is a tell by its fourth appearance: a line whose normalized text
 *    another ledger quest already ships is LINE_REUSED_FROM_LEDGER;
 *  - unmeasured is not a pass: without a judge the basis says "judge unmeasured" and the verdict is
 *    only the structural one. It never claims the lines were judged.
 * Pure.
 */

import { ACT_SOUL } from '@/lib/games/gtai-quest/campaignBaseline';
import { ACT_IDS } from '@/lib/games/gtai-quest/types';
import type { GuardFinding, GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** A quest with fewer lines cannot carry the doctrine. */
export const MIN_LINES = 6;
/** Judge scores are 1-5; below these a line fails (earned) or drifts (voice). */
export const EARNED_FLOOR = 3;
export const VOICE_FIT_FLOOR = 3;

/** EDITORIAL tell patterns (unmeasured; owner taste plus the registry's named generic structures). */
export const EDITORIAL_TELLS: readonly { id: string; re: RegExp; what: string }[] = [
  {
    id: 'not-x-its-y',
    re: /\b(it'?s|this is|that'?s|this isn'?t|it isn'?t)\s+(not\s+)?(just\s+|about\s+)?[^.;!?]{1,40}?[,;:—-]\s*(it'?s|this is|that'?s)\s+/i,
    what: '"it\'s not X, it\'s Y" reversal',
  },
  {
    id: 'self-answered-question',
    re: /\b(why|what|who|how|where)\b[^?]{0,40}\?\s*(because|simple|easy|the answer|answer:|i'?ll tell you)\b/i,
    what: 'rhetorical question answered by the same speaker',
  },
  {
    id: 'closing-aphorism',
    re: /(?:^|[.!?]\s+)(sometimes|in the end|at the end of the day|that'?s (just )?(life|the (game|job|business|way it goes))|some things never change|we all)\b[^.!?]*[.!]?\s*$/i,
    what: 'line ends in a generic summarising aphorism',
  },
];

const normalize = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const actIndex = (a: string): number => ACT_IDS.indexOf(a as (typeof ACT_IDS)[number]);

/** Soul voices speakable in `act`: each from its own act on. */
function soulVoices(act: QuestDesign['act']): Set<string> {
  const out = new Set<string>();
  for (const [a, soul] of Object.entries(ACT_SOUL)) if (soul && actIndex(a) <= actIndex(act)) out.add(soul);
  return out;
}

export function assessLines(design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  const findings: GuardFinding[] = [];
  const chars = new Map(design.characters.map((c) => [c.id, c]));
  const souls = soulVoices(design.act);
  const lineIds = new Set<string>();

  if (design.lines.length < MIN_LINES) {
    findings.push({ code: 'TOO_FEW_LINES', severity: 'error', message: `${design.lines.length} lines; at least ${MIN_LINES} carry the doctrine` });
  }

  const seen = new Set<string>();
  for (const l of design.lines) {
    if (seen.has(l.id)) findings.push({ code: 'DUPLICATE_LINE_ID', severity: 'error', ref: l.id, message: `line id ${l.id} is used twice` });
    seen.add(l.id);
    lineIds.add(l.id);
    if (l.purpose.length === 0) findings.push({ code: 'LINE_NO_PURPOSE', severity: 'error', ref: l.id, message: `${l.id} claims no purpose (funny, character or progression)` });
    if (!chars.has(l.speaker) && l.speaker !== 'rivet' && !souls.has(l.speaker)) {
      findings.push({ code: 'LINE_UNKNOWN_SPEAKER', severity: 'error', ref: l.id, message: `${l.id}: speaker ${l.speaker} is not in the quest's characters, not rivet, and not a soul unlocked by ${design.act}` });
    }
    for (const t of EDITORIAL_TELLS) {
      if (t.re.test(l.text)) findings.push({ code: 'EDITORIAL_TELL', severity: 'warn', ref: l.id, message: `editorial (unmeasured): ${l.id}: ${t.what} [${t.id}]` });
    }
  }

  const inBeat = new Set<string>();
  for (const b of design.beats) {
    for (const id of b.lineIds) {
      inBeat.add(id);
      if (!lineIds.has(id)) findings.push({ code: 'BEAT_UNKNOWN_LINE', severity: 'error', ref: b.id, message: `beat ${b.id} names missing line ${id}` });
    }
  }
  for (const l of design.lines) {
    if (!inBeat.has(l.id) && !(l.when && l.when.length > 0)) {
      findings.push({ code: 'LINE_UNUSED', severity: 'warn', ref: l.id, message: `${l.id} is in no beat and has no when-tag: nothing plays it` });
    }
  }

  // The signature carries no selfId: a package re-scored against a ledger that holds it is
  // recognised by object identity or by its own `id` (a package's runtime shape), never by text.
  const ownId = (design as unknown as { id?: unknown }).id;
  const selfId = typeof ownId === 'string' ? ownId : null;
  const shipped = new Map<string, string>();
  for (const p of ctx.ledger) {
    if ((p as QuestDesign) === design || p.id === selfId) continue;
    for (const l of p.lines) shipped.set(normalize(l.text), p.id);
  }
  for (const l of design.lines) {
    const other = shipped.get(normalize(l.text));
    if (other !== undefined && normalize(l.text).length > 0) {
      findings.push({ code: 'LINE_REUSED_FROM_LEDGER', severity: 'error', ref: l.id, message: `${l.id} repeats a line quest ${other} already ships` });
    }
  }

  const speakers = new Set(design.lines.map((l) => l.speaker));
  for (const s of speakers) {
    if (ctx.voiceBibles.has(s)) continue;
    const c = chars.get(s);
    const isNew = c?.status === 'new';
    findings.push({
      code: 'NO_VOICE_BIBLE', severity: isNew ? 'warn' : 'error', ref: s,
      message: `${s} has no voice bible in games/gtai/voices/${isNew ? ' (new character: write one before the voice pass)' : ''}`,
    });
  }

  const judge = ctx.judge;
  if (judge) {
    if (judge.judgeSeat === judge.authorSeat) {
      findings.push({ code: 'JUDGE_SAME_FAMILY', severity: 'error', message: `judge ${judge.judgeSeat} is the author's own seat: one family cannot judge itself` });
    }
    const byLine = new Map(judge.lines.map((j) => [j.lineId, j]));
    for (const l of design.lines) {
      const j = byLine.get(l.id);
      if (!j) { findings.push({ code: 'LINE_UNJUDGED', severity: 'warn', ref: l.id, message: `${l.id} has no judgement` }); continue; }
      if (j.earned < EARNED_FLOOR) findings.push({ code: 'LINE_NOT_EARNED', severity: 'error', ref: l.id, message: `${l.id} earned ${j.earned}/5 (< ${EARNED_FLOOR}): ${j.note}` });
      if (j.voiceFit < VOICE_FIT_FLOOR) findings.push({ code: 'VOICE_DRIFT', severity: 'warn', ref: l.id, message: `${l.id} voice fit ${j.voiceFit}/5 (< ${VOICE_FIT_FLOOR}): ${j.note}` });
    }
  }

  return {
    guard: 'lines',
    state: findings.some((f) => f.severity === 'error') ? 'red' : 'green',
    basis: judge ? `structural + judge(${judge.judgeSeat})` : 'structural only; judge unmeasured',
    findings,
  };
}
