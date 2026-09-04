/**
 * Build the animation-critique prompt. Pure (no I/O). This is the aesthetic ruler's
 * load-bearing wording: it forces ABSOLUTE judgment against professional game-animation
 * standards rather than grading the input on a curve — so a stiff, code-authored motion
 * scores low even though it "technically functions". The model returns a strict JSON card.
 */

import type { FilmstripSampling } from './filmstrip';

export interface AnimationContext {
  /** Asset / clip name, for the model's reference (e.g. "AM_SwordSlashC"). */
  name: string;
  /** What the motion is and how it SHOULD read (the design intent). */
  intent: string;
  /** Number of frames in the filmstrip (sampled in time order). */
  frameCount: number;
  /** Optional total motion duration in seconds. */
  durationSeconds?: number;
  /**
   * How this strip was sampled from the capture. When frames were dropped, the prompt SAYS
   * so — the judge is asked to score timing, and the sampler's own uneven spacing (and the
   * in-betweens it removed) must not be read as a defect in the motion. Omitted, or with
   * kept === available, the prompt is byte-identical to the unsampled one.
   */
  sampling?: FilmstripSampling;
}

const DIMENSION_GUIDE = `- anticipation: is there a clear windup/preparation that telegraphs the action before it happens? (a weighty strike pulls back first)
- weight: does the motion convey mass and force — acceleration into the hit, a sense of effort — or does it float/glide with uniform speed?
- timing: spacing of the action — slow-in/slow-out, a fast snap on the strike and a settle on recovery. Even, metronomic spacing reads robotic.
- followThrough: does the body overshoot and settle after the peak (secondary motion, the blade carrying past), or stop dead?
- silhouette: at the key poses, is the action readable from the body's outline alone, or is it a cramped/ambiguous shape?
- believability: overall — does this read as motion from a trained human/skilled fighter (or a AAA game), or as stiff, robotic, keyframe-interpolated, or T-pose-adjacent?`;

/**
 * State the sampling, or say nothing. Empty when the judge is seeing the whole capture —
 * so a full-strip prompt is byte-identical to the one this ruler has always sent.
 */
function samplingBlock(s: FilmstripSampling | undefined): string {
  if (!s || s.kept >= s.available) return '';
  const spacing = s.uniform
    ? `every ${s.stride}${s.stride === 2 ? 'nd' : s.stride === 3 ? 'rd' : 'th'} captured frame (a uniform stride of ${s.stride})`
    : `NOT uniform — consecutive frames you see are ${s.gaps.join('-')} captured frames apart`;
  return `
SAMPLING (read this before you judge timing): you are seeing ${s.kept} of the ${s.available} frames that were captured. Their spacing is ${spacing}. The frames in between were removed by the sampler, not missing from the motion: do NOT lower the timing score, and do NOT cite a "jump with no in-between", for a gap the sampling can explain. Judge timing only on rhythm that survives this sampling — a pose that has clearly not moved, or an abrupt change far larger than the neighbouring steps.
`;
}

export function buildCritiquePrompt(ctx: AnimationContext): string {
  const dur = ctx.durationSeconds ? ` over ~${ctx.durationSeconds}s` : '';
  return `You are a senior game animation director reviewing a character animation for SHIP quality.

You are looking at ${ctx.frameCount} frames sampled in time order${dur} from a single motion — read them as a filmstrip / flipbook of one continuous action, left-to-right, top-to-bottom.
${samplingBlock(ctx.sampling)}
The motion is: ${ctx.intent}
(asset: ${ctx.name})

Judge it in ABSOLUTE terms against professional, shipped AAA game animation — do NOT grade on a curve, do NOT assume the input is competent, and do NOT judge it relative to itself. If the motion is stiff, robotic, weightless, evenly-spaced, or lacks anticipation/follow-through, it MUST score low even if the limb roughly reaches the right place. A "functional" motion that doesn't read as believable is a low score.

Score each dimension 0-100 (0 = broken/absent, 50 = amateur/placeholder, 70 = acceptable for ship, 90+ = excellent):
${DIMENSION_GUIDE}

Then give:
- reasons: 2-5 short, concrete observations grounded in what you SEE across the frames (cite frame-to-frame changes, e.g. "frames 2-3 jump with no in-between").
- topFix: the SINGLE highest-impact change that would most improve believability.

Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "dimensions": {
    "anticipation": number,
    "weight": number,
    "timing": number,
    "followThrough": number,
    "silhouette": number,
    "believability": number
  },
  "reasons": string[],
  "topFix": string
}`;
}
