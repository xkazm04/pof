// Fix-and-rerun-trap linter (pof-app §7).
//
// SP-B's biggest cost was four 40-minute live attempts chasing "the next fix is
// the last one." The remediation pattern: prove every harness behaviour change
// with a deterministic synthetic fixture (a `page.setContent`-style test) BEFORE
// a live run. This linter enforces that on PRs:
//   - changing harness helpers (e2e/helpers/*) requires a fixture/unit test in
//     the same change;
//   - adding a HARNESS_MODE=live run to CI requires deterministic fixture
//     coverage in the same change.
//
// Pure + injectable so it is unit-tested; a thin git-backed wrapper feeds it.

export interface FixAndRerunInput {
  /** Files touched by the change (repo-relative, forward slashes). */
  changedFiles: string[];
  /** Does the diff add a HARNESS_MODE=live invocation to a CI config? */
  addsLiveRunToCI: boolean;
  /** Override the "is this a deterministic fixture/unit test?" classifier. */
  isFixtureTest?: (file: string) => boolean;
}

export interface FixAndRerunViolation {
  rule: 'harness-change-needs-fixture' | 'live-run-needs-fixture';
  message: string;
}

const HARNESS_HELPER_RE = /^e2e\/helpers\/.+\.ts$/;
const TEST_FILE_RE = /\.(test|spec)\.ts$/;

/** Default classifier: a deterministic test under e2e/ (unit test or fixture spec). */
export function defaultIsFixtureTest(file: string): boolean {
  const f = file.replace(/\\/g, '/');
  return f.startsWith('e2e/') && TEST_FILE_RE.test(f);
}

function isHarnessHelper(file: string): boolean {
  const f = file.replace(/\\/g, '/');
  return HARNESS_HELPER_RE.test(f) && !TEST_FILE_RE.test(f);
}

/**
 * Return the fix-and-rerun-trap violations for a change. Empty array = clean.
 */
export function detectFixAndRerunViolations(input: FixAndRerunInput): FixAndRerunViolation[] {
  const isFixtureTest = input.isFixtureTest ?? defaultIsFixtureTest;
  const files = input.changedFiles.map((f) => f.replace(/\\/g, '/'));

  const hasFixtureTest = files.some(isFixtureTest);
  const touchedHarnessHelper = files.some(isHarnessHelper);

  const violations: FixAndRerunViolation[] = [];

  if (touchedHarnessHelper && !hasFixtureTest) {
    violations.push({
      rule: 'harness-change-needs-fixture',
      message:
        'Harness helper changed under e2e/helpers/ without a deterministic ' +
        'fixture/unit test (e2e/**/*.test.ts or a page.setContent spec) in the ' +
        'same change. Prove the behaviour deterministically before any live run.',
    });
  }

  if (input.addsLiveRunToCI && !hasFixtureTest) {
    violations.push({
      rule: 'live-run-needs-fixture',
      message:
        'This change adds a HARNESS_MODE=live run to CI but includes no ' +
        'deterministic fixture test. A live run must be backed by a synthetic ' +
        'fixture that proves the harness behaviour first (the SP-B lesson).',
    });
  }

  return violations;
}
