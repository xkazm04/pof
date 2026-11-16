/**
 * `CLASS_BY_CATALOG` is a hand-maintained catalogId → subject-class list. A misspelled or retired
 * key is silent: `subjectClassOf` returns undefined and that catalog's images fall back to the
 * BASE Style DNA — the exact environment-cues-on-a-creature failure (/diablo W03) the per-class
 * variants exist to prevent. Pin every key to a registered catalog pipeline.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { SUBJECT_CLASS_CATALOGS, subjectClassOf } from '@/lib/catalog/canon/subjectClass';

const registered = new Set(allCatalogPipelines().map((p) => p.catalogId));

describe('subject-class catalog list', () => {
  it('is not vacuous and every listed catalog resolves to a class', () => {
    expect(SUBJECT_CLASS_CATALOGS.length).toBeGreaterThanOrEqual(10);
    for (const c of SUBJECT_CLASS_CATALOGS) expect(subjectClassOf(c)).toBeDefined();
  });

  it('every listed catalog is a registered catalog pipeline', () => {
    expect(SUBJECT_CLASS_CATALOGS.filter((c) => !registered.has(c))).toEqual([]);
  });
});
