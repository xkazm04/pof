/**
 * A Next route file may export only its HTTP handlers and route config. Reads the source of
 * every route in visual-gen-core, comments stripped, so a helper exported from one is caught.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = [
  'generate', 'generate/status', 'generate-2d', 'asset/[name]', 'assets', 'browse', 'browse/files',
  'contact-sheet', 'image/[name]', 'icon/[name]', 'icons', 'icon-from-mesh', 'input-gate', 'footage-gate',
];
const ALLOWED = new Set([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
  'dynamic', 'dynamicParams', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion', 'maxDuration',
]);

function exportedNames(route: string): string[] {
  const source = readFileSync(join(process.cwd(), 'src/app/api/visual-gen', route, 'route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...source.matchAll(/^export\s+(?:async\s+)?(?:const|let|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
}

describe('visual-gen-core route exports', () => {
  it.each(ROUTES)('%s exports only handlers and route config', (route) => {
    expect(exportedNames(route).filter((n) => !ALLOWED.has(n))).toEqual([]);
  });

  it('[seeded] the scanner sees a non-handler export', () => {
    const line = 'export const helper = 1;';
    expect([...line.matchAll(/^export\s+(?:async\s+)?(?:const|let|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1])).toEqual(['helper']);
  });
});
