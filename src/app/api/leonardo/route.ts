import { apiSuccess, apiError } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { generateImage, upscaleImage, unzoomImage, generateTextureOn3DModel, MAX_PROMPT_LENGTH, type GenerateImageOptions } from '@/lib/leonardo';
import { applyStyle, styleRequestOf } from '@/lib/visual-gen/style-apply';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

const MODES = ['image', 'upscale', 'unzoom', 'texture3d'] as const;
type Mode = (typeof MODES)[number];
const isMode = (v: unknown): v is Mode => MODES.includes(v as Mode);

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
 * batch scripts use). Both resolve Style DNA through the one resolver, `style-apply.ts`.
 */

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const mode = body.mode ?? 'image';
    // Before the key check: a request that could never be served is wrong on every machine.
    if (!isMode(mode)) return apiError(`Unknown mode "${String(mode)}"`, 400);

    if (!process.env.LEONARDO_API_KEY) {
      return apiError('LEONARDO_API_KEY not configured', 500);
    }

    if (mode === 'image') {
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== 'string') return apiError('Missing or invalid "prompt" field', 400);
      if (prompt.length > MAX_PROMPT_LENGTH) return apiError(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`, 400);
      // `cleanup` and `pollIntervalMs` are library seams, not request options: forwarding a
      // caller's `cleanup: false` would leave the generation on the Leonardo account, breaking
      // the download-then-delete contract every generation honours. No in-tree caller sends either.
      const rawOpts = body?.opts && typeof body.opts === 'object' && !Array.isArray(body.opts) ? body.opts : {};
      const opts: GenerateImageOptions = { ...(rawOpts as GenerateImageOptions) };
      delete opts.cleanup;
      delete opts.pollIntervalMs;

      // Opt-in style consistency through the ONE canon-aware resolver (style-apply.ts):
      // `canonProfile` (/diablo W03 D13) picks WHICH style — the project's active one for PoF's
      // own entities, only a style bound to that canon for any other, and a withheld style says
      // why instead of rendering a Diablo entity in PoF's look; `catalogId` picks the canon's
      // per-subject-class variant (D15). Capped at Leonardo's own prompt ceiling.
      const style = applyStyle(getDb, prompt, styleRequestOf(body), MAX_PROMPT_LENGTH);
      const result = await generateImage(style.prompt, opts);

      // NO SEAM FIELD HERE, DELIBERATELY. This route used to run a tileability pass gated
      // on `opts.tiling` and return a `seam` alongside the image — but nothing anywhere
      // sets `tiling` (the only producer is the `GenerateImageOptions` type itself), so
      // the field was `null` on every single response ever served: a permanent "not
      // checked" wearing the shape of a result. The LIVE seam path is /api/scenario, which
      // genuinely runs `detectSeamsFromUrl` on the albedo it generates and whose verdict
      // the material lab renders in BOTH directions (seam found / checked and clean).
      // To bring it back, add a caller that actually requests a seamless tile from
      // Leonardo and restore the branch with it — not before.
      return apiSuccess({
        ...result,
        styleDnaApplied: style.styleDnaApplied,
        styleDnaWithheld: style.styleDnaWithheld,
        styleDnaDropped: style.styleDnaDropped,
      });
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

    const { objBase64, prompt, preview } = body;
    if (!objBase64 || typeof objBase64 !== 'string') return apiError('Missing "objBase64" for texture3d', 400);
    if (!prompt || typeof prompt !== 'string') return apiError('Missing "prompt" for texture3d', 400);
    const objBytes = new Uint8Array(Buffer.from(objBase64, 'base64'));
    const result = await generateTextureOn3DModel({ objBytes, prompt, preview: Boolean(preview) });
    return apiSuccess(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/leonardo] ${message}`);
    return apiError(message, 500);
  }
}
