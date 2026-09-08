/**
 * GEMINI — a metered eye, and the only one in the roster with a real three-step effort dial.
 *
 * VENDOR FACTS, probed live on 2026-09-08 against the project's own key (source: the models
 * list + a `generateContent` probe; recorded here rather than in a document because this is
 * where the next person stands when they reach for a level):
 *
 *   · `thinkingLevel` accepts exactly `low` | `medium` | `high`. `none`, `minimal`, `max`
 *     and `unspecified` are all rejected — `Invalid value at
 *     generation_config.thinking_config.thinking_level`.
 *   · Thought spend scales monotonically with the level. On one fixed arithmetic task:
 *     low 48, medium 115, high 176 thought tokens (`usageMetadata.thoughtsTokenCount`),
 *     for identical 3-token answers. So effort is a real cost axis, and `thoughtsTokenCount`
 *     is the honest per-call measure of what it bought.
 *   · `thinkingBudget` (an integer cap) is ALSO accepted, but on the same probe it produced
 *     zero thought tokens where `thinkingLevel` produced 77 — a cap is not an instruction.
 *     We use the level, which is the instruction.
 *   · `gemini-3.8-flash` exists and supports thinking (1M in / 65k out). The app's standing
 *     pin is `gemini-2.5-flash`, several generations older; moving the RUNTIME pin is an
 *     arena decision, not a probe decision, so this adapter keeps the app's pin as its
 *     default and lets a caller name a newer model explicitly.
 */
import { makeGeminiVisionAttributed } from '@/lib/anim-critique/gemini';
import type { VisionEffort, VisionProvider, VisionRequest } from '../types';

/** The model the PROMPT-AUTHORING role uses — always the newest Flash (operator, 2026-09-08). */
export const GEMINI_LATEST_FLASH = 'gemini-3.8-flash';

/** Translate the shared effort vocabulary into Gemini's thinkingConfig. Pure. */
export function geminiThinkingConfig(effort: VisionEffort | undefined): { thinkingLevel: VisionEffort } | undefined {
  return effort ? { thinkingLevel: effort } : undefined;
}

export interface GeminiProviderOptions {
  model?: string;
}

/**
 * WHICH EFFORT TO ASK FOR — measured 2026-09-08, `gemini-3.8-flash`, temperature 0, on a real
 * captured UE frame (`Saved/Observations/arena_jedi/frame_00.png`: a dark colosseum arena, the
 * genuinely ambiguous "dim but lit" vs "black, unlit failure" case). Harness:
 * `scripts/vision-arena/effort-probe.ts`, re-runnable unchanged.
 *
 * THE ANSWER DEPENDS ENTIRELY ON THE SHAPE OF THE TASK, and the two halves point opposite ways.
 *
 * 1. VERDICT tasks (this route's checks — a handful of booleans + pass/fail): effort is INERT.
 *    18 calls, two modes x three levels x three repeats:
 *
 *      mode       level   verdict                                     stable  thoughtTok  ms
 *      character  low     humanoidVisible=T tPosed=F distinct=T       yes         70     3086
 *      character  medium  (identical)                                 yes        197     3549
 *      character  high    (identical)                                 yes        436     4626
 *      lighting   low     lit=T shadowed=T verdict=pass               yes         95     3578
 *      lighting   medium  (identical)                                 yes        211     4584
 *      lighting   high    (identical)                                 yes        338     3421
 *
 *    Every level agreed with every other, every arm was deterministic across its repeats, and
 *    latency did not even rise monotonically. High costs 4.4-6.2x the thought tokens to reach
 *    the same answer. So: DO NOT pay for thinking on a closed-vocabulary verdict. This is the
 *    registry's `effort-calibration` in the field — "under a hard output cap, effort buys
 *    nothing at all" — and a verdict of four booleans is effectively output-capped.
 *
 * 2. AUTHORING tasks (writing the prompt a gate will use — open-ended): effort PAYS.
 *    `scripts/vision-arena/author-prompt.ts`, same frame, one goal, one run per level:
 *
 *      level   thoughtTok  prompt   what the extra thinking actually bought
 *      low          0       342 ch  generic "check for missing indirect light"
 *      medium     555       884 ch  adds "beneath an illuminated sky"
 *      high      1106       783 ch  names the concrete discriminator (#000000 flat black),
 *                                   tests it RELATIVE to adjacent surfaces rather than by an
 *                                   absolute darkness threshold, adds a location field so a
 *                                   FAIL is actionable, states both branches of the decision
 *                                   rule inside the prompt, and carves out black materials
 *                                   that still hold specular highlights
 *
 *    Sample size is one goal x one frame x one run per level — INDICATIVE, not settled, and
 *    deliberately labelled as such. The verdict-inertness above rests on 18 calls; this rests
 *    on 3. Re-run before treating it as a rule for a new use case.
 *
 * The operational split that follows, and it is the cheap direction: think HARD once at design
 * time (a few calls per use case, authoring the prompt), think LOW at runtime (a call per asset,
 * forever). Buying the rare call to avoid the frequent one is the whole trade.
 */
export function geminiProvider(opts: GeminiProviderOptions = {}): VisionProvider {
  return {
    id: 'gemini',
    capabilities: ['recognize'],
    // All three, and only these three — see the probe above.
    effortLevels: ['low', 'medium', 'high'],
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY),
    recognize: (req: VisionRequest) => {
      // Built per request because effort varies per request; the factory is a closure, not
      // a client, so this costs nothing.
      const call = makeGeminiVisionAttributed({
        ...(opts.model ? { model: opts.model } : {}),
        ...(req.effort ? { effort: req.effort } : {}),
      });
      return call(req.images, req.prompt);
    },
  };
}
