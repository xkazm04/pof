/**
 * Download-then-delete protocol guard (06-TM tests.md PoF #2).
 *
 * The `leonardo-generation-cleanup` memory mandates that every Leonardo
 * generation/model the codebase creates is removed from the account afterwards
 * (the local copy is the only retained one). The direct-function tests in
 * leonardo-client.test.ts prove the existing call sites do this; THIS test is a
 * source-level guard that fails if a *future* call site creates a generation or
 * model without a cleanup path.
 *
 * It is a "naive grep" over the Leonardo lib: for every exported async function
 * that POSTs to a generation/model CREATE endpoint, the same function body must
 * reference a cleanup token (downloadThenDelete / deleteGeneration / a DELETE).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LEONARDO_LIB = join(process.cwd(), 'src', 'lib', 'leonardo.ts');

/** Endpoints whose POST creates a retained asset that must be cleaned up. */
const CREATE_ENDPOINTS = [
  '/generations`', // POST /generations (note: backtick — excludes /generations/${id} GET/DELETE)
  '/generations-texture`',
  '/models-3d/upload`',
];
const CLEANUP_TOKENS = ['downloadThenDelete', 'deleteGeneration', "method: 'DELETE'", 'method: "DELETE"'];

/** Split a TS source into { name, body } blocks by `export async function`. */
function exportedAsyncFunctions(src: string): Array<{ name: string; body: string }> {
  const re = /export\s+async\s+function\s+(\w+)/g;
  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) starts.push({ name: m[1], index: m.index });
  return starts.map((s, i) => ({
    name: s.name,
    body: src.slice(s.index, starts[i + 1]?.index ?? src.length),
  }));
}

function createsRetainedAsset(body: string): boolean {
  return CREATE_ENDPOINTS.some((ep) => body.includes('POST') && body.includes(ep));
}

function hasCleanup(body: string): boolean {
  return CLEANUP_TOKENS.some((t) => body.includes(t));
}

describe('Leonardo download-then-delete protocol', () => {
  it('the leonardo lib exists where the guard expects it', () => {
    expect(() => readFileSync(LEONARDO_LIB, 'utf8')).not.toThrow();
  });

  it('every generation/model-creating call site has a cleanup path', () => {
    const src = readFileSync(LEONARDO_LIB, 'utf8');
    const offenders: string[] = [];
    for (const fn of exportedAsyncFunctions(src)) {
      if (createsRetainedAsset(fn.body) && !hasCleanup(fn.body)) offenders.push(fn.name);
    }
    expect(offenders, `these create a Leonardo asset without a cleanup path: ${offenders.join(', ')}`).toEqual([]);
  });

  it('generateImage cleans up by default (download-then-delete unless explicitly opted out)', () => {
    const src = readFileSync(LEONARDO_LIB, 'utf8');
    const gen = exportedAsyncFunctions(src).find((f) => f.name === 'generateImage');
    expect(gen).toBeDefined();
    expect(gen!.body).toContain('downloadThenDelete');
    // The only opt-out is an explicit cleanup===false — never a silent skip.
    expect(gen!.body).toMatch(/opts\.cleanup === false/);
  });

  it('generateTextureOn3DModel deletes the uploaded model in a finally (no leak)', () => {
    const src = readFileSync(LEONARDO_LIB, 'utf8');
    const tex = exportedAsyncFunctions(src).find((f) => f.name === 'generateTextureOn3DModel');
    expect(tex).toBeDefined();
    expect(tex!.body).toContain('finally');
    expect(tex!.body).toMatch(/\/models-3d\/\$\{modelAssetId\}/);
    expect(tex!.body).toMatch(/method:\s*'DELETE'/);
  });

  it('covers the whole leonardo surface — no other src/lib/leonardo/* file escapes the guard', () => {
    // If the lib is ever split into a directory, those files are scanned too.
    const dir = join(process.cwd(), 'src', 'lib', 'leonardo');
    const files = existsSync(dir)
      ? readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts'))
      : []; // directory does not exist yet — single-file lib; nothing extra to scan
    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(dir, rel), 'utf8');
      for (const fn of exportedAsyncFunctions(src)) {
        if (createsRetainedAsset(fn.body) && !hasCleanup(fn.body)) offenders.push(`${rel}:${fn.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
