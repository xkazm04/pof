/**
 * GET /api/harness/screenshots → enumeration of saved visual-gate screenshots.
 *
 * Returns an iteration-keyed view of every screenshot artifact under the
 * harness state path, derived from the parsed `result.json` for each iteration
 * (so each row carries its per-module pass/fail + a11y + diff metadata, not
 * just a file listing). Used by `HarnessVisualGallery` to render the iteration
 * selector + thumbnail grid.
 *
 * Response shape:
 *   {
 *     statePath: string,
 *     baselineSlugs: string[],
 *     iterations: Array<{ iteration: number, capturedAt: string, modules: VisualModuleResult[] }>
 *   }
 */
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { VisualGateResult, VisualModuleResult } from '@/lib/harness/visual-gate';

interface GlobalHarness {
  harnessConfig?: { statePath: string };
}

function getStatePath(req: NextRequest): string | null {
  const override = req.nextUrl.searchParams.get('statePath');
  if (override) return override;
  const g = globalThis as unknown as GlobalHarness;
  return g.harnessConfig?.statePath ?? null;
}

export async function GET(req: NextRequest) {
  const statePath = getStatePath(req);
  if (!statePath) return apiError('No statePath — start the harness first or pass ?statePath=', 404);
  const screenshotsRoot = path.join(statePath, 'screenshots');
  if (!fs.existsSync(screenshotsRoot)) return apiSuccess({ statePath, baselineSlugs: [], iterations: [] });

  const entries = fs.readdirSync(screenshotsRoot, { withFileTypes: true });
  const iterations: Array<{ iteration: number; capturedAt: string; modules: VisualModuleResult[] }> = [];
  let baselineSlugs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'baseline') {
      const dir = path.join(screenshotsRoot, entry.name);
      baselineSlugs = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.png') && !f.endsWith('.diff.png'))
        .map((f) => f.replace(/\.png$/, ''));
      continue;
    }
    const iter = Number(entry.name);
    if (!Number.isFinite(iter)) continue;
    const dir = path.join(screenshotsRoot, entry.name);
    const resultPath = path.join(dir, 'result.json');
    let modules: VisualModuleResult[] = [];
    let capturedAt = '';
    if (fs.existsSync(resultPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as VisualGateResult;
        modules = parsed.modules ?? [];
      } catch { /* fall through with empty modules */ }
      try { capturedAt = fs.statSync(resultPath).mtime.toISOString(); } catch { /* */ }
    }
    iterations.push({ iteration: iter, capturedAt, modules });
  }
  iterations.sort((a, b) => b.iteration - a.iteration);

  return apiSuccess({ statePath, baselineSlugs, iterations });
}
