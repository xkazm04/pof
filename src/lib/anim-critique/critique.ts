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
import {
  resolveTier1, tier1Blocks, TIER2_RAN, tier2NotRun,
  type Tier1Input, type Tier1Report, type Tier2Report,
} from './tier1';

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
  /**
   * The Tier-1 integrity gate (numeric loop closure), reported BESIDE the Tier-2 craft card
   * and never merged into it. Always present: when the caller supplied no Tier-1 input it
   * reads `not-run`, because an un-run gate that is silently omitted reads as a pass.
   */
  tier1: Tier1Report;
  /** Whether the craft pass actually ran — `not-run` when Tier-1 gated it, or errored first. */
  tier2: Tier2Report;
  /** True when a measured Tier-1 failure stopped the (paid) vision call from happening. */
  gated?: boolean;
}

export interface CritiqueDeps {
  /** The model seam: judge the filmstrip against the prompt, return its raw text. */
  callVision?: (images: VisionImage[], prompt: string) => Promise<string | VisionAnswer>;
  /** Read a frame file to bytes (default node fs). */
  readFile?: (path: string) => Buffer | Promise<Buffer>;
  thresholds?: Partial<ScoreThresholds>;
  /**
   * Tier-1 loop-closure input — the extractor's marker text (preferred, mirrors
   * mesh-critique's stdout seam) or an already-scored card. Omitted ⇒ the gate did not run
   * and the result says so; behaviour of the craft pass is unchanged.
   */
  tier1?: Tier1Input;
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
  // Tier-1 FIRST: a clip that provably does not loop must not cost a filmstrip render plus
  // a paid vision call to find that out. Only a MEASURED fail gates; `n/a` (one-shot),
  // `warn`, `error` and `not-run` all fall through to the craft pass carrying their own
  // status, so none of them can be read as an integrity pass.
  const tier1 = resolveTier1(deps.tier1);
  if (tier1Blocks(tier1)) {
    return {
      ok: true,
      gated: true,
      tier1,
      tier2: tier2NotRun(
        `Tier-1 integrity gate failed, so the aesthetic pass was not run — craft is UNMEASURED, not failed. ${tier1.reason}`,
      ),
    };
  }

  if (framePaths.length === 0) {
    return { ok: false, error: 'no frames provided to critique', tier1, tier2: tier2NotRun('no frames to judge') };
  }
  const readFile = deps.readFile ?? ((p: string) => readFileSync(p));
  const callVision = deps.callVision;
  if (!callVision) {
    return {
      ok: false,
      error: 'no vision model seam provided (callVision)',
      tier1,
      tier2: tier2NotRun('no vision model seam provided'),
    };
  }

  let images: VisionImage[];
  try {
    images = await Promise.all(
      framePaths.map(async (p) => ({ base64: (await readFile(p)).toString('base64'), mime: mimeOf(p) })),
    );
  } catch (e) {
    return {
      ok: false,
      error: `failed to read a frame: ${e instanceof Error ? e.message : 'unknown'}`,
      tier1,
      tier2: tier2NotRun('a frame could not be read'),
    };
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
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'vision model call failed',
      tier1,
      tier2: tier2NotRun('the vision model call failed'),
    };
  }
  const raw = answer.text;

  const parsed = parseCritique(raw);
  if (!parsed.ok || !parsed.dimensions) {
    return { ok: false, error: parsed.error ?? 'could not parse critique', raw, vision: answer, tier1, tier2: TIER2_RAN };
  }
  const scored = scoreCard(parsed.dimensions, deps.thresholds);
  return {
    ok: true,
    raw,
    vision: answer,
    tier1,
    tier2: TIER2_RAN,
    card: {
      ...scored,
      dimensions: parsed.dimensions,
      reasons: parsed.reasons ?? [],
      topFix: parsed.topFix ?? '',
    },
  };
}
