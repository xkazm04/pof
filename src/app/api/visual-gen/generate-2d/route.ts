import { NextRequest } from 'next/server';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  GENERATED_IMAGE_DIR,
  defaultImageProvider,
  generateTwoDImage,
  imageProviderCapabilities,
} from '@/lib/visual-gen/image-providers';

/**
 * The in-app 2D generation front — the one prompt → image path.
 *
 * GET  → every registry provider with its verdict for THIS server, so the panel can
 *        disable an unrunnable provider WITH the reason before any submit. The client
 *        cannot read `process.env`, so capability has to be served, not guessed.
 * POST → run one prompt through one provider and write the image to
 *        `generated/images/`, served by GET /api/visual-gen/image/:name.
 *
 * A refusal (no runner / no key / empty prompt) is a 400 carrying the provider's own
 * sentence; a provider failure is a 502 carrying the provider's own error. Nothing
 * here returns a placeholder URL — `url` exists only when bytes are on disk.
 */

function outDir(): string {
  return join(process.cwd(), 'generated', GENERATED_IMAGE_DIR).replace(/\\/g, '/');
}

export async function GET() {
  const env = process.env as Record<string, string | undefined>;
  return apiSuccess({
    providers: imageProviderCapabilities(env),
    defaultProviderId: defaultImageProvider(env)?.id ?? null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      providerId?: string;
      size?: string;
      width?: number;
      height?: number;
    };
    const env = process.env as Record<string, string | undefined>;

    const result = await generateTwoDImage(
      {
        prompt: body?.prompt ?? '',
        providerId: typeof body?.providerId === 'string' ? body.providerId : undefined,
        size: typeof body?.size === 'string' ? body.size : undefined,
        width: typeof body?.width === 'number' ? body.width : undefined,
        height: typeof body?.height === 'number' ? body.height : undefined,
      },
      { env, outDir: outDir() },
    );

    if (!result.ok) {
      // 400 = the request could never have run here (unwired provider, no key, no
      // prompt); 502 = we asked a provider and it failed. Both carry the reason.
      return apiError(result.error ?? 'generation failed without a reason', result.refused ? 400 : 502);
    }
    return apiSuccess(result);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process 2D generation request', 500);
  }
}
