/**
 * POST /api/verify/animation
 *
 * The aesthetic-truth half of the loop (sibling of /api/verify/visual, but for MOTION).
 * Given a captured filmstrip (a frame directory or explicit paths) plus the motion's intent,
 * run the multi-frame critique and return a scored, dimensional, actionable card. The eye is
 * ROUTED, not named here: the route asks `@/lib/vision` for the `recognize-multiframe`
 * capability and the plan decides which provider answers (see the chokepoint note below).
 * Reads the PNGs on the same machine, like the visual route. Standard { success, data } envelope.
 */
import { NextRequest } from 'next/server';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { critiqueAnimation, type VisionImage } from '@/lib/anim-critique/critique';
import type { VisionAnswer } from '@/lib/anim-critique/vision';
import { sampleFilmstrip, type FilmstripSampling } from '@/lib/anim-critique/filmstrip';
import { recognize, type VisionSteer } from '@/lib/vision/router';
import { defaultProviders } from '@/lib/vision/providers';
import type { RoutedVisionAnswer } from '@/lib/vision/types';
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

  // THE CHOKEPOINT. This route no longer names an eye.
  //
  // It used to choose one inline — `body.provider === 'qwen' ? makeQwenVisionAttributed(...)
  // : makeGeminiVisionAttributed(...)` — which is the deviation the vision module exists to
  // remove: "no surface outside the routing layer may name a vendor and get it". Now it asks
  // for the `recognize-multiframe` CAPABILITY and `@/lib/vision`'s plan decides who answers.
  //
  // `body.provider` survives unchanged as a caller STEER, translated once here from the
  // route's public vocabulary into the router's. It is a `prefer`, never an `avoid`: prefer
  // REORDERS and is dropped when it cannot be honoured, so a caller who asks for the
  // DashScope eye on a machine that has no DashScope key still gets an answer with the skip
  // in the trail, where an avoid would have turned an absent eye into a hard failure.
  //
  // The one behaviour that is NOT identical to the ternary: an eye that is unconfigured is
  // now a re-route rather than an error, so a machine with no Gemini key reaches the metered
  // DashScope rung instead of 502-ing. That is the chokepoint's standing semantics (the same
  // ones `/api/verify/visual` has had since it migrated), and the rung it reaches BILLS —
  // which is exactly why the elimination travels on the answer in `provenance.trail` rather
  // than being implied.
  const requested: 'qwen' | 'gemini' = body.provider === 'qwen' ? 'qwen' : 'gemini';
  const steer: VisionSteer = requested === 'qwen' ? { prefer: 'qwen-cloud' } : {};

  // Captured from inside the seam so the response can report WHO answered. The legacy
  // `(images, prompt) => VisionAnswer` shape has no room for provenance, so it is narrowed
  // back down on the way out rather than leaking `provider`/`trail` into `result.vision`.
  let routed: RoutedVisionAnswer | undefined;
  const callVision = async (images: VisionImage[], prompt: string): Promise<VisionAnswer> => {
    const answer = await recognize(
      { images, prompt },
      {
        capability: 'recognize-multiframe',
        // A caller's `model` is a vendor-specific pin; the roster applies it to whichever eye
        // the plan reaches, exactly as the ternary applied it to whichever eye it picked.
        providers: defaultProviders(model ? { model } : {}),
        steer,
      },
    );
    routed = answer;
    return {
      text: answer.text,
      model: answer.model,
      attribution: answer.attribution,
      fellBackFrom: answer.fellBackFrom,
    };
  };

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
      provider: requested,
      tier1: result.tier1,
      tier2: result.tier2,
    });
  }

  if (!result.ok || !result.card) {
    return apiError(result.error ?? 'critique failed', 502);
  }
  // `provider` is what was REQUESTED — a steer, never an attribution — and it keeps its old
  // spelling ('qwen' | 'gemini') because every existing caller reads it. `vision` is the model
  // that answered (the Qwen chain silently re-routes on quota, so the family is not an
  // attribution), and `provenance` is the new, routed half: which EYE the plan reached and
  // every eye that dropped out first. A judgement whose author is unrecorded is not evidence.
  // The Tier-2 card stays exactly where it was (flat), with the Tier-1 integrity verdict
  // beside it. `tier1.status === 'not-run'` when the caller supplied no markers — an omitted
  // gate reads as a passed one, so it is stated rather than dropped.
  return apiSuccess({
    ...result.card,
    frames,
    sampled,
    provider: requested,
    vision: result.vision,
    ...(routed
      ? { provenance: { provider: routed.provider, model: routed.model, trail: routed.trail } }
      : {}),
    tier1: result.tier1,
    tier2: result.tier2,
  });
}
