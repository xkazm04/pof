import { describe, it, expect } from 'vitest';

/**
 * Live dry-run of the packaging-truth drain against the REAL app SQLite + filesystem.
 * Env-gated (same pattern as live-drain.integration.test.ts): skipped unless
 * POF_PACKAGING_DRYRUN=1. Reads persisted artifacts, REBUILDS the package dirs +
 * manifests under generated/packages/ (that is the ground truth being graded — the
 * dirs are gitignored), and reports the would-be verdicts WITHOUT writing artifacts.
 *
 *   POF_PACKAGING_DRYRUN=1 npx vitest run src/__tests__/catalog/packaging-verify.dryrun.integration.test.ts
 */
const enabled = process.env.POF_PACKAGING_DRYRUN === '1';

describe.skipIf(!enabled)('packaging-verify dry-run (real DB + fs)', () => {
  it('rebuilds every packaging step package and reports honest verdicts', async () => {
    const { verifyPackagingAll, defaultPackagingVerifyDeps } = await import(
      '@/lib/catalog/acceptance/packagingVerify'
    );
    const summary = verifyPackagingAll({}, defaultPackagingVerifyDeps(), { apply: false });

    // eslint-disable-next-line no-console -- operator-facing dry-run report
    console.log(
      `[packaging dry-run] verified=${summary.verified} pass=${summary.passed} deferred=${summary.deferred} skipped=${summary.skipped}`,
    );
    for (const r of summary.results) {
      // eslint-disable-next-line no-console -- operator-facing dry-run report
      console.log(`  ${r.from}->${r.to}  ${r.catalogId}/${r.entityId}  ${r.detail ?? ''} ${r.reason ? `| ${r.reason.slice(0, 160)}` : ''}`);
    }

    expect(summary.verified).toBeGreaterThan(0); // 30 pipelines persist a UE Packaging artifact
    // A dry run never writes artifacts.
    expect(summary.changed).toBe(0);
  });
});
