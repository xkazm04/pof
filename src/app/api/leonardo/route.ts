import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateImage, upscaleImage, unzoomImage, generateTextureOn3DModel, MAX_PROMPT_LENGTH, type GenerateImageOptions } from '@/lib/leonardo';
import { applyStyleFragment, styleDnaToPromptFragment } from '@/lib/visual-gen/style-dna';
import { getActiveStyleDna } from '@/lib/visual-gen/style-dna-db';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

type Mode = 'image' | 'upscale' | 'unzoom' | 'texture3d';

/**
 * The hardcoded-Leonardo route. Its in-app callers are the Material Lab's
 * upscale/unzoom/controlnet/inpaint actions, each of which needs an opaque Leonardo
 * image id the user types by hand.
 *
 * `mode: 'image'` (prompt → image) is NOT the app's 2D generation front. That is
 * POST /api/visual-gen/generate-2d, which resolves a PROVIDER from the 2D registry
 * (`src/lib/visual-gen/image-providers.ts`) — Leonardo or Qwen-Image — refuses with a
 * reason when the chosen one has no key here, calls `generateImage` directly, and
 * saves the bytes to `generated/images/` so the result is retrievable. This route
 * stays as the Leonardo-specific surface (and the `applyStyleDna` path the gap-loop
 * batch scripts use); the 2D front does not send style DNA — see `STYLE_DNA_REACH`.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: Mode = body?.mode ?? 'image';

    if (!process.env.LEONARDO_API_KEY) {
      return apiError('LEONARDO_API_KEY not configured', 500);
    }

    if (mode === 'image') {
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== 'string') return apiError('Missing or invalid "prompt" field', 400);
      if (prompt.length > MAX_PROMPT_LENGTH) return apiError(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`, 400);
      const opts: GenerateImageOptions = body?.opts ?? {};

      // Opt-in project-style consistency: append the active Style DNA fragment through
      // the SHARED helper, capped so the combined prompt never exceeds the provider limit.
      //
      // NOTE ON REACH: nothing in `src/` sends `applyStyleDna` — only the gap-loop batch
      // scripts do. The forge's Style DNA panel now STATES that (`STYLE_DNA_REACH`)
      // instead of implying this path with a label that just says "prompts".
      let styleDnaApplied: string | null = null;
      let finalPrompt = prompt;
      if (body?.applyStyleDna === true) {
        const active = getActiveStyleDna(getDb());
        if (active) {
          finalPrompt = applyStyleFragment(prompt, styleDnaToPromptFragment(active.dna), MAX_PROMPT_LENGTH);
          styleDnaApplied = active.name;
        }
      }
      const result = await generateImage(finalPrompt, opts);

      // NO SEAM FIELD HERE, DELIBERATELY. This route used to run a tileability pass gated
      // on `opts.tiling` and return a `seam` alongside the image — but nothing anywhere
      // sets `tiling` (the only producer is the `GenerateImageOptions` type itself), so
      // the field was `null` on every single response ever served: a permanent "not
      // checked" wearing the shape of a result. The LIVE seam path is /api/scenario, which
      // genuinely runs `detectSeamsFromUrl` on the albedo it generates and whose verdict
      // the material lab renders in BOTH directions (seam found / checked and clean).
      // To bring it back, add a caller that actually requests a seamless tile from
      // Leonardo and restore the branch with it — not before.
      return apiSuccess({ ...result, styleDnaApplied });
    }

    if (mode === 'upscale') {
      const imageId = body?.imageId;
      if (!imageId || typeof imageId !== 'string') return apiError('Missing "imageId" for upscale', 400);
      const result = await upscaleImage(imageId, typeof body?.style === 'string' ? body.style : 'GENERAL');
      return apiSuccess(result);
    }

    if (mode === 'unzoom') {
      const imageId = body?.imageId;
      if (!imageId || typeof imageId !== 'string') return apiError('Missing "imageId" for unzoom', 400);
      const result = await unzoomImage(imageId, typeof body?.prompt === 'string' ? { prompt: body.prompt } : {});
      return apiSuccess(result);
    }

    if (mode === 'texture3d') {
      const { objBase64, prompt, preview } = body ?? {};
      if (!objBase64 || typeof objBase64 !== 'string') return apiError('Missing "objBase64" for texture3d', 400);
      if (!prompt || typeof prompt !== 'string') return apiError('Missing "prompt" for texture3d', 400);
      const objBytes = new Uint8Array(Buffer.from(objBase64, 'base64'));
      const result = await generateTextureOn3DModel({ objBytes, prompt, preview: Boolean(preview) });
      return apiSuccess(result);
    }

    return apiError(`Unknown mode "${String(mode)}"`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/leonardo] ${message}`);
    return apiError(message, 500);
  }
}
