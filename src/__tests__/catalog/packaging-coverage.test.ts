import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import {
  packagingCoverage,
  verifyPackagingAll,
  type PackagingVerifyDeps,
} from '@/lib/catalog/acceptance/packagingVerify';

/**
 * Packaging coverage is a TWO-state rule with no third state.
 *
 * A registered pipeline either owns a packaging step — the `packaging: true` flag, or the
 * canonical "UE Packaging" label 30 of the 32 pipelines end on — or it declares
 * `packagingExempt: '<reason>'`. Before that field existed, `character-pipeline` (ends on
 * Visual Gate) and `player-movement` (ends on Playable Gate) simply had neither, so the
 * packaging-truth drain had nothing to re-grade for them and reported the absence as an
 * ordinary skip: an intentional exemption was indistinguishable from an authoring omission.
 *
 * These tests pin that the third state cannot come back, and that the drain SAYS "exempt by
 * declaration" rather than silently finding nothing.
 */
const pipelines = allCatalogPipelines();

/** Long enough that "n/a" or "TBD" cannot pass as a reason. */
const MIN_REASON_CHARS = 60;

describe('packaging coverage', () => {
  it('every registered pipeline has a packaging step or a declared exemption — never neither', () => {
    const uncovered = pipelines
      .filter((p) => packagingCoverage(p).kind === 'none')
      .map(
        (p) =>
          `${p.catalogId}: owns no packaging step and declares no packagingExempt reason — ` +
          `the packaging drain has nothing to re-grade for it and cannot say why. Add a ` +
          `packaging step, or declare CatalogPipeline.packagingExempt with the reason one ` +
          `would be meaningless here.`,
      );
    expect(uncovered).toEqual([]);
  });

  it('no pipeline declares an exemption AND owns a packaging step (the states are exclusive)', () => {
    const both = pipelines
      .filter((p) => p.packagingExempt != null && packagingCoverage(p).kind === 'step')
      .map((p) => `${p.catalogId}: declares packagingExempt while owning a packaging step — drop one`);
    expect(both).toEqual([]);
  });

  it('every declared exemption states a real reason', () => {
    const thin = pipelines
      .filter((p) => p.packagingExempt != null && p.packagingExempt.trim().length < MIN_REASON_CHARS)
      .map((p) => `${p.catalogId}: packagingExempt reason is too thin to be a reason (<${MIN_REASON_CHARS} chars)`);
    expect(thin).toEqual([]);
  });

  it('the exempt pipelines are exactly the two that end on a gate rather than packaging', () => {
    const exempt = pipelines
      .filter((p) => packagingCoverage(p).kind === 'exempt')
      .map((p) => p.catalogId)
      .sort();
    // A ratchet, not a target: changing this list means a pipeline changed its packaging
    // posture, which is a decision worth reading in a diff.
    expect(exempt).toEqual(['character-pipeline', 'player-movement']);
  });

  it('packagingCoverage prefers a real packaging step over any declaration', () => {
    expect(packagingCoverage({ steps: [{ label: 'UE Packaging' }] })).toEqual({ kind: 'step', label: 'UE Packaging' });
    expect(packagingCoverage({ steps: [{ label: 'Bundle', packaging: true }] })).toEqual({ kind: 'step', label: 'Bundle' });
    expect(packagingCoverage({ steps: [{ label: 'Visual Gate' }] })).toEqual({ kind: 'none' });
    // Whitespace is not a declaration.
    expect(packagingCoverage({ steps: [{ label: 'Visual Gate' }], packagingExempt: '   ' })).toEqual({ kind: 'none' });
    expect(packagingCoverage({ steps: [{ label: 'Visual Gate' }], packagingExempt: 'no assets staged here' }))
      .toEqual({ kind: 'exempt', reason: 'no assets staged here' });
  });
});

describe('the packaging drain reports exemptions', () => {
  const deps = (over: Partial<PackagingVerifyDeps> = {}): PackagingVerifyDeps => ({
    listArtifacts: () => [{ catalogId: 'character-pipeline', entityId: 'jinx', step: 'Visual Gate', status: 'deferred' }],
    isPackaging: () => false,
    listExemptions: () => [{ catalogId: 'character-pipeline', reason: 'workflow recipe, nothing staged' }],
    getSiblings: () => [],
    build: () => ({ catalogId: 'c', entityId: 'e', packagedAt: '2026-08-18T00:00:00.000Z', files: [], missing: [], ueDeclarations: [] }),
    upsertStatus: () => {},
    ...over,
  });

  it("names the exempt catalog and its reason instead of only counting a skip", () => {
    const summary = verifyPackagingAll({}, deps(), { apply: false });
    expect(summary.verified).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.exempt).toEqual([{ catalogId: 'character-pipeline', reason: 'workflow recipe, nothing staged' }]);
  });

  it('reports no exemptions when the dep set declares none (back-compatible)', () => {
    const withoutExemptions: PackagingVerifyDeps = { ...deps() };
    delete withoutExemptions.listExemptions;
    const summary = verifyPackagingAll({}, withoutExemptions, { apply: false });
    expect(summary.exempt).toEqual([]);
  });
});
