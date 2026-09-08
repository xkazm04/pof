/* eslint-disable no-console -- this is a CLI harness; stdout is its interface. */
/**
 * PROMPT AUTHORING — stage 0 of a new recognition use case.
 *
 * The operator's method (2026-09-08): image-recognition results often depend on the PROMPT
 * more than on the eye's recognition ability, so before benchmarking eyes, have a current
 * Gemini Flash author the prompt — hand it the real frame and the goal, and ask for the
 * method rather than the answer. The registry measured the strongest form of this
 * (`extraction-model-bake-off`, 2026-08-25): the same corrective words moved a field sharply
 * in the main prompt and were ignored entirely in schema descriptions, cutting definitional
 * contradictions by 68%. Before concluding an eye CANNOT do something, confirm it was asked
 * properly.
 *
 * Note the role split this depends on, because it is what makes the method cheap: Flash is
 * used here as a DESIGN-TIME author — a handful of calls, once per use case — not as the
 * runtime judge that would bill per asset forever.
 *
 * Output is a candidate prompt per thinking level, printed for a human to read and choose.
 * It writes nothing and pins nothing: the chosen prompt is pasted into
 * `src/lib/vision/check-prompts.ts` by a person, becomes a versioned artifact there, and only
 * then does `effort-probe.ts` grade eyes on it. One prompt, every candidate — an arm handed
 * a different question measures prompt luck.
 *
 *   npx tsx scripts/vision-arena/author-prompt.ts --frame <png> --goal "..." [--levels low,high]
 */
import { readFileSync } from 'node:fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { EFFORT_ORDER, type VisionEffort } from '@/lib/vision/types';

const LEVELS: Record<VisionEffort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** The authoring brief. Asks for the METHOD, and says what the prompt must survive. */
function brief(goal: string): string {
  return [
    'You are designing an automated visual-inspection gate for a game build pipeline.',
    '',
    `THE GOAL OF THE GATE: ${goal}`,
    '',
    'The attached image is a REAL captured frame this gate will have to judge. Study it, then',
    'write the PROMPT that a vision model should be given to perform this check reliably —',
    'not the answer for this frame.',
    '',
    'The prompt you write must:',
    '- force a strict JSON object with a fixed schema and no prose, no markdown fences;',
    '- state its decision rule explicitly, including where the boundary sits for the case that',
    '  is genuinely ambiguous in frames like this one;',
    '- be robust to frames that differ from this one (brighter, emptier, different camera);',
    '- avoid asking for anything a vision model cannot actually see in a single still.',
    '',
    'Name the hardest failure case this gate must not miss, and the most likely FALSE alarm.',
    '',
    'Respond as JSON: {"prompt": "<the prompt text>", "schema": <the JSON shape it demands>,',
    '"decisionRule": "<one sentence>", "hardestMiss": "<...>", "likelyFalseAlarm": "<...>"}',
  ].join('\n');
}

async function main(): Promise<number> {
  const framePath = arg('frame');
  const goal = arg('goal');
  const model = arg('model', 'gemini-3.8-flash');
  const levels = (arg('levels', EFFORT_ORDER.join(',')).split(',') as VisionEffort[]).filter((l) => LEVELS[l]);
  if (!framePath || !goal) { console.error('--frame <png> and --goal "..." are required'); return 2; }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) { console.error('GEMINI_API_KEY not set'); return 2; }

  console.log(`PROMPT AUTHORING — ${model}, levels: ${levels.join(', ')} (${levels.length} billed calls)`);
  console.log(`  frame ${framePath}`);
  console.log(`  goal  ${goal}\n`);

  const client = new GoogleGenAI({ apiKey });
  const b64 = readFileSync(framePath).toString('base64');

  for (const level of levels) {
    const t0 = Date.now();
    try {
      const res = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: 'image/png', data: b64 } },
          { text: brief(goal) },
        ] }],
        config: {
          temperature: 0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: LEVELS[level] },
        },
      });
      const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
      const u = res.usageMetadata ?? {};
      let p: Record<string, unknown> = {};
      try { p = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()); } catch { /* raw below */ }
      console.log(`${'='.repeat(78)}\nLEVEL ${level.toUpperCase()}  · thoughtTok=${u.thoughtsTokenCount ?? 0} outTok=${u.candidatesTokenCount ?? 0} ms=${Date.now() - t0}`);
      console.log(`  decisionRule     : ${p.decisionRule ?? '(none)'}`);
      console.log(`  hardestMiss      : ${p.hardestMiss ?? '(none)'}`);
      console.log(`  likelyFalseAlarm : ${p.likelyFalseAlarm ?? '(none)'}`);
      const prompt = String(p.prompt ?? text);
      console.log(`  --- authored prompt (${prompt.length} chars) ---\n${prompt}`);
      if (p.schema) console.log(`  --- schema ---\n${JSON.stringify(p.schema)}`);
    } catch (e) {
      console.log(`LEVEL ${level}: FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n${'='.repeat(78)}\nNothing was written. Choose a prompt, paste it into src/lib/vision/check-prompts.ts,\nthen grade eyes on it with effort-probe.ts — one prompt, every candidate.`);
  return 0;
}

main().then((c) => process.exit(c));
