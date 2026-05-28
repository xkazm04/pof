/**
 * GET /api/harness/screenshot?iter=<n|baseline>&slug=<module>&kind=<screenshot|diff>
 *
 * Serves a single PNG from the harness's `.harness/screenshots/<iteration>/`
 * tree. Used by HarnessVisualGallery to load thumbnails + the before/after
 * diff overlay. Strictly path-jailed under the configured statePath so a
 * `slug` like `../../etc/passwd` can never escape the screenshots root.
 */
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { apiError } from '@/lib/api-utils';

interface GlobalHarness {
  harnessConfig?: { statePath: string };
}

function getStatePath(req: NextRequest): string | null {
  const override = req.nextUrl.searchParams.get('statePath');
  if (override) return override;
  const g = globalThis as unknown as GlobalHarness;
  return g.harnessConfig?.statePath ?? null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export async function GET(req: NextRequest) {
  const statePath = getStatePath(req);
  if (!statePath) return apiError('No statePath — start the harness first or pass ?statePath=', 404);

  const iter = req.nextUrl.searchParams.get('iter');
  const slug = req.nextUrl.searchParams.get('slug');
  const kind = req.nextUrl.searchParams.get('kind') ?? 'screenshot';
  if (!iter || !slug) return apiError('Missing iter or slug', 400);
  if (!SLUG_RE.test(slug)) return apiError('Invalid slug', 400);
  if (!/^\d+$/.test(iter) && iter !== 'baseline') return apiError('Invalid iter', 400);
  if (kind !== 'screenshot' && kind !== 'diff') return apiError('Invalid kind', 400);

  const screenshotsRoot = path.resolve(path.join(statePath, 'screenshots'));
  const filename = kind === 'diff' ? `${slug}.diff.png` : `${slug}.png`;
  const target = path.resolve(path.join(screenshotsRoot, iter, filename));
  // Defence in depth — the regex above already eliminates traversal, but verify.
  if (!target.startsWith(screenshotsRoot + path.sep)) return apiError('Forbidden path', 403);
  if (!fs.existsSync(target)) return apiError('Screenshot not found', 404);

  const buf = fs.readFileSync(target);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Iteration screenshots are immutable; baselines change rarely.
      'Cache-Control': iter === 'baseline' ? 'private, max-age=60' : 'private, max-age=300, immutable',
    },
  });
}
