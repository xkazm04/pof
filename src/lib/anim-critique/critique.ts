/**
 * Animation aesthetic critique — the orchestrator. Reads a filmstrip of frames,
 * sends them to a vision model (injectable seam — default Gemini, see gemini.ts),
 * and assembles a scored, dimensional, actionable card. Same shape as
 * visual-gen/mesh-critique: pure cores (prompt/parse/score) + one injectable model seam.
 */
import { readFileSync } from 'node:fs';
import { buildCritiquePrompt, type AnimationContext } from './prompt';
import { parseCritique } from './parse';
import { normalizeVisionAnswer, type VisionAnswer } from './vision';
import { scoreCard, type CritiqueDimensions, type ScoreThresholds, type Scorecard } from './score';

export interface VisionImage {
  base64: string;
  mime: string;
}

/**
 * The full critique surfaced to the loop: verdict + score + dimensions + actionable text.
 * Carries the whole `Scorecard`, so the dimension that CAPPED the verdict travels with it
 * (`worstDimension` / `reason`) — the verdict is the worst dimension's band, never the mean.
 */
export interface AnimationCritiqueCard extends Scorecard {
  dimensions: CritiqueDimensions;
  reasons: string[];
  topFix: string;
}

export interface CritiqueResult {
  ok: boolean;
  card?: AnimationCritiqueCard;
  error?: string;
  /** Raw model text, for debugging / surfacing the frame the verdict came from. */
  raw?: string;
  /**
   * WHO wrote this score: the model that actually answered plus the models it fell back
   * from. A chain-walking seam re-routes on any quota signal, so the provider family is
   * not an attribution. `unreported` where the injected seam cannot know.
   */
  vision?: VisionAnswer;
}

export interface CritiqueDeps {
  /** The model seam: judge the filmstrip against the prompt, return its raw text. */
  callVision?: (images: VisionImage[], prompt: string) => Promise<string | VisionAnswer>;
  /** Read a frame file to bytes (default node fs). */
  readFile?: (path: string) => Buffer | Promise<Buffer>;
  thresholds?: Partial<ScoreThresholds>;
}

/** Frame MIME from the path. Captures are PNG, but a caller-supplied JPEG must not be
 *  announced to the provider as `image/png` — some vision APIs reject the mismatch. */
function mimeOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

export async function critiqueAnimation(
  framePaths: string[],
  ctx: AnimationContext,
  deps: CritiqueDeps = {},
): Promise<CritiqueResult> {
  if (framePaths.length === 0) {
    return { ok: false, error: 'no frames provided to critique' };
  }
  const readFile = deps.readFile ?? ((p: string) => readFileSync(p));
  const callVision = deps.callVision;
  if (!callVision) {
    return { ok: false, error: 'no vision model seam provided (callVision)' };
  }

  let images: VisionImage[];
  try {
    images = await Promise.all(
      framePaths.map(async (p) => ({ base64: (await readFile(p)).toString('base64'), mime: mimeOf(p) })),
    );
  } catch (e) {
    return { ok: false, error: `failed to read a frame: ${e instanceof Error ? e.message : 'unknown'}` };
  }

  // The prompt reflects the ACTUAL frame count, not whatever ctx claimed — and a sampling
  // claim that does not match the frames we are actually sending is dropped rather than
  // repeated to the judge (an honest instrument states only what it can stand behind).
  const sampling = ctx.sampling && ctx.sampling.kept === framePaths.length ? ctx.sampling : undefined;
  const prompt = buildCritiquePrompt({
    ...ctx,
    frameCount: framePaths.length,
    ...(sampling ? { sampling } : { sampling: undefined }),
  });

  let answer: VisionAnswer;
  try {
    answer = normalizeVisionAnswer(await callVision(images, prompt));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'vision model call failed' };
  }
  const raw = answer.text;

  const parsed = parseCritique(raw);
  if (!parsed.ok || !parsed.dimensions) {
    return { ok: false, error: parsed.error ?? 'could not parse critique', raw, vision: answer };
  }
  const scored = scoreCard(parsed.dimensions, deps.thresholds);
  return {
    ok: true,
    raw,
    vision: answer,
    card: {
      ...scored,
      dimensions: parsed.dimensions,
      reasons: parsed.reasons ?? [],
      topFix: parsed.topFix ?? '',
    },
  };
}
