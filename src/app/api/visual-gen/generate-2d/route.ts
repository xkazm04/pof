import { NextRequest } from 'next/server';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import {
  GENERATED_IMAGE_DIR,
  defaultImageProvider,
  generateTwoDImage,
  imageProviderCapabilities,
} from '@/lib/visual-gen/image-providers';
import { applyStyle, styleRequestOf } from '@/lib/visual-gen/style-apply';
import { getDb } from '@/lib/db';

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
 *
 * Style DNA: optional `applyStyleDna` / `canonProfile` / `catalogId` go to the one
 * canon-aware resolver (`style-apply.ts`), which appends the style under the shared cap and
 * reports `styleDnaApplied` / `styleDnaWithheld` / `styleDnaDropped`. Absent the flag the
 * provider receives the prompt byte-identical and the DB is never opened.
 */

/** Image dimensions a provider is ever asked for; the panels send 512 to 1536. */
const DIMENSION_MIN = 64;
const DIMENSION_MAX = 4096;

/** The first wrongly shaped field as a refusal, or null when the body can reach a provider. */
function bodyShapeRefusal(body: Record<string, unknown>): string | null {
  for (const field of ['prompt', 'providerId', 'size']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field} must be a string`;
  }
  for (const field of ['width', 'height']) {
    const n = body[field];
    if (n != null && !(Number.isInteger(n) && (n as number) >= DIMENSION_MIN && (n as number) <= DIMENSION_MAX)) {
      return `${field} must be a whole number from ${DIMENSION_MIN} to ${DIMENSION_MAX}`;
    }
  }
  return null;
}

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
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const shapeRefusal = bodyShapeRefusal(parsed);
    if (shapeRefusal) return apiError(shapeRefusal, 400);
    const body = parsed as {
      prompt?: string;
      providerId?: string;
      size?: string;
      width?: number;
      height?: number;
      applyStyleDna?: boolean;
      canonProfile?: string;
      catalogId?: string;
    };
    const env = process.env as Record<string, string | undefined>;
    const { prompt, ...style } = applyStyle(getDb, body?.prompt ?? '', styleRequestOf(body));

    const result = await generateTwoDImage(
      {
        prompt,
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
    return apiSuccess({ ...result, ...style });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process 2D generation request', 500);
  }
}
