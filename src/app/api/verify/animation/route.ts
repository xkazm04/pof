/**
 * POST /api/verify/animation
 *
 * The aesthetic-truth half of the loop (sibling of /api/verify/visual, but for MOTION).
 * Given a captured filmstrip (a frame directory or explicit paths) plus the motion's intent,
 * run the multi-frame Gemini critique and return a scored, dimensional, actionable card.
 * Reads the PNGs on the same machine, like the visual route. Standard { success, data } envelope.
 */
import { NextRequest } from 'next/server';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { critiqueAnimation } from '@/lib/anim-critique/critique';
import { makeGeminiVisionAttributed } from '@/lib/anim-critique/gemini';
import { makeQwenVisionAttributed } from '@/lib/anim-critique/qwen';
import { sampleFilmstrip, type FilmstripSampling } from '@/lib/anim-critique/filmstrip';
import type { LoopIntent } from '@/lib/motion-gate';

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    intent?: string;
    frameDir?: string;
    framePaths?: string[];
    durationSeconds?: number;
    model?: string;
    provider?: string;
    cam?: string;
    maxFrames?: number;
    /**
     * Tier-1 integrity input: the raw stdout of `scripts/visual-gen/ardy/pof_loop_closure.py`.
     * MARKER TEXT, not a pre-parsed verdict — the same seam shape as mesh-critique, because
     * that text is the extractor's only transport and because a JSON verdict field would let
     * a caller assert a `pass` no measurement produced.
     */
    loopMarkers?: string;
    /** 'oneshot' for a clip never meant to loop; it is graded `n/a`, never `pass`. */
    loopIntent?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { name, intent, frameDir, framePaths, durationSeconds, model } = body;
  if (!name || !intent) {
    return apiError('Missing "name" or "intent"', 400);
  }

  // Resolve the ordered filmstrip from explicit paths or a directory, and REPORT the
  // sampling: how many of the captured frames the judge actually saw, and whether their
  // spacing is uniform. A subsampled strip is not an evenly-spaced filmstrip, and the
  // judge scores timing — "the sampling is part of the instrument".
  let frames: string[];
  let sampling: FilmstripSampling | undefined;
  // `available`/`uniform` are null, never guessed, when the caller chose the paths: this
  // route cannot know what capture they came from or what was left out.
  let sampled: { kept: number; available: number | null; uniform: boolean | null; stride: number | null; source: 'framePaths' | 'frameDir' };
  if (Array.isArray(framePaths) && framePaths.length > 0) {
    frames = framePaths;
    sampled = { kept: frames.length, available: null, uniform: null, stride: null, source: 'framePaths' };
  } else if (frameDir) {
    if (!existsSync(frameDir)) return apiError(`frameDir not found: ${frameDir}`, 404);
    const cam = body.cam === 'side' ? 'side' : 'main';
    const maxFrames = typeof body.maxFrames === 'number' && body.maxFrames > 0 ? body.maxFrames : 10;
    const strip = sampleFilmstrip(readdirSync(frameDir), { cam, maxFrames });
    frames = strip.frames.map((f) => join(frameDir, f));
    sampling = { kept: strip.kept, available: strip.available, uniform: strip.uniform, stride: strip.stride, gaps: strip.gaps };
    sampled = { kept: strip.kept, available: strip.available, uniform: strip.uniform, stride: strip.stride, source: 'frameDir' };
  } else {
    return apiError('Provide "frameDir" or "framePaths"', 400);
  }
  if (frames.length === 0) {
    return apiError('No frames resolved from input (expected frame_NN.png / shot_NN.png)', 404);
  }
  const missing = frames.find((f) => !existsSync(f));
  if (missing) return apiError(`Frame not found: ${missing}`, 404);

  // Pick the vision provider: 'qwen' (DashScope, Gemini-free) or 'gemini' (default).
  const provider = body.provider === 'qwen' ? 'qwen' : 'gemini';
  const callVision =
    provider === 'qwen'
      ? makeQwenVisionAttributed({ ...(model ? { model } : {}) })
      : makeGeminiVisionAttributed({ ...(model ? { model } : {}) });

  const result = await critiqueAnimation(
    frames,
    {
      name,
      intent,
      frameCount: frames.length,
      ...(durationSeconds ? { durationSeconds } : {}),
      ...(sampling ? { sampling } : {}),
    },
    {
      callVision,
      ...(typeof body.loopMarkers === 'string'
        ? {
            tier1: {
              markers: body.loopMarkers,
              intent: (body.loopIntent === 'oneshot' ? 'oneshot' : 'loop') as LoopIntent,
            },
          }
        : {}),
    },
  );

  // A gated clip is a SUCCESSFUL measurement, not a server failure: Tier-1 answered in
  // millimetres and the paid craft pass was correctly skipped. Report both tiers with their
  // own basis — no Tier-2 verdict is invented to fill the hole ("never manufacture a number
  // to complete a report"), so `verdict`/`dimensions` are simply absent.
  if (result.gated) {
    return apiSuccess({
      gated: true,
      frames,
      sampled,
      provider,
      tier1: result.tier1,
      tier2: result.tier2,
    });
  }

  if (!result.ok || !result.card) {
    return apiError(result.error ?? 'critique failed', 502);
  }
  // `provider` is what was REQUESTED; `vision` is who actually answered (the Qwen chain
  // silently re-routes on quota, so the family is not an attribution).
  // The Tier-2 card stays exactly where it was (flat), with the Tier-1 integrity verdict
  // beside it. `tier1.status === 'not-run'` when the caller supplied no markers — an omitted
  // gate reads as a passed one, so it is stated rather than dropped.
  return apiSuccess({
    ...result.card,
    frames,
    sampled,
    provider,
    vision: result.vision,
    tier1: result.tier1,
    tier2: result.tier2,
  });
}
