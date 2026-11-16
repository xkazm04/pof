// @vitest-environment node
/**
 * `FeatureRow.filePaths` is typed `string[]` and consumed as such (the matrix search calls
 * `fp.toLowerCase()` on every element). The import route validates elements with
 * `z.array(z.string())`, but POST /api/feature-matrix only checks `Array.isArray`, so a
 * non-string element reached the column — and the reader passed it straight through.
 * The reader now holds the same degrade-don't-throw contract as catalog-db's `ue_assets`:
 * only strings survive, and a corrupt or wrong-shaped blob is logged.
 *
 * Runs against the worker's containment DB (POF_DB_PATH), never ~/.pof/pof.db.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getFeaturesByModule, upsertFeatures } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'fm-file-paths-shape-test' as SubModuleId;
const PROJECT = 'c:/tmp/fm-file-paths-shape';

function seed(featureName: string, filePaths: unknown) {
  upsertFeatures(
    MODULE,
    [{ featureName, category: 'c', status: 'partial', description: '', filePaths: filePaths as string[], reviewNotes: '' }],
    { projectId: PROJECT },
  );
}

function read(featureName: string) {
  return getFeaturesByModule(MODULE, PROJECT).find((f) => f.featureName === featureName)!;
}

describe('feature-matrix reader: filePaths is always string[]', () => {
  beforeEach(() => {
    getDb().prepare('DELETE FROM feature_matrix WHERE module_id = ?').run(MODULE);
  });
  afterEach(() => vi.restoreAllMocks());

  it('drops non-string elements written by an unvalidated path', () => {
    seed('mixed', ['src/a.ts', 1, null, { p: 'x' }, 'src/b.ts']);
    const row = read('mixed');
    expect(row.filePaths).toEqual(['src/a.ts', 'src/b.ts']);
    expect(row.filePaths.every((p) => typeof p === 'string')).toBe(true);
  });

  it('a wrong-shaped (non-array) blob reads as [] and is logged, not silent', () => {
    seed('shape', []);
    getDb()
      .prepare("UPDATE feature_matrix SET file_paths = '{\"a\":1}' WHERE module_id = ? AND feature_name = 'shape'")
      .run(MODULE);
    const warn = vi.spyOn(logger, 'warn');
    expect(read('shape').filePaths).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('a clean string array is unchanged', () => {
    seed('clean', ['src/x.ts', 'src/y.ts']);
    expect(read('clean').filePaths).toEqual(['src/x.ts', 'src/y.ts']);
  });
});
