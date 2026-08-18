import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

/**
 * Filename ↔ catalogId parity for every pipeline module.
 *
 * The registry's convention is that `src/lib/catalog/pipelines/<catalogId>.ts` declares
 * `catalogId: '<catalogId>'` — that is what lets a reader jump from a catalog id in
 * `pipeline_artifacts` (or a /status cell, or a judge verdict) straight to the file that
 * declares it, and what makes `scripts/gen-pipeline-registry.mjs`'s directory scan a
 * faithful index. It was 30/32 true: `currency.ts` registered `'currencies'` and
 * `status-effect.ts` registered `'status-effects'`. A convention that is 94% true is one a
 * reader trusts at exactly the wrong moment, so this test pins it at 100%.
 *
 * Renaming a module NEVER renames a catalog id — the ids are persisted in the database.
 * If they ever disagree again, rename the FILE, not the id.
 */
const PIPELINE_DIR = join(process.cwd(), 'src', 'lib', 'catalog', 'pipelines');

/** Every hand-authored pipeline module's basename (the generated barrel is not one). */
function pipelineFiles(): string[] {
  return readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.ts') && f !== 'registry.generated.ts');
}

/**
 * The catalogId a file REGISTERS, read from its own source: the first `catalogId: '…'`
 * following its `registerCatalogPipeline({` call. Read from source rather than by importing
 * each module in isolation because ES module caching makes "import one, see what it
 * registered" unrepeatable inside a single test run.
 */
function declaredCatalogId(file: string): string | null {
  const src = readFileSync(join(PIPELINE_DIR, file), 'utf8');
  const call = src.indexOf('registerCatalogPipeline(');
  if (call < 0) return null;
  return /catalogId:\s*'([^']+)'/.exec(src.slice(call))?.[1] ?? null;
}

describe('pipeline module filename ↔ catalogId parity', () => {
  it('every pipeline file declares the catalogId its filename encodes', () => {
    const mismatches = pipelineFiles()
      .map((f) => ({ f, expected: f.replace(/\.ts$/, ''), actual: declaredCatalogId(f) }))
      .filter((r) => r.actual !== r.expected)
      .map((r) =>
        r.actual == null
          ? `${r.f}: no registerCatalogPipeline({ catalogId: '…' }) found`
          : `${r.f}: registers catalogId '${r.actual}' — rename the FILE to '${r.actual}.ts' ` +
            `(never the id: catalog ids are persisted in pipeline_artifacts)`,
      );
    expect(mismatches).toEqual([]);
  });

  it('the registered catalog ids are exactly the pipeline filenames', () => {
    const files = pipelineFiles().map((f) => f.replace(/\.ts$/, '')).sort();
    const registered = allCatalogPipelines().map((p) => p.catalogId).sort();
    expect(registered).toEqual(files);
  });

  it('no two pipeline modules register the same catalogId', () => {
    const ids = allCatalogPipelines().map((p) => p.catalogId);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
