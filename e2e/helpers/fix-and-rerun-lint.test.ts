import { describe, it, expect } from 'vitest';
import {
  detectFixAndRerunViolations, defaultIsFixtureTest,
} from './fix-and-rerun-lint';

describe('defaultIsFixtureTest', () => {
  it('treats e2e unit/fixture tests as fixture tests', () => {
    expect(defaultIsFixtureTest('e2e/helpers/foo.test.ts')).toBe(true);
    expect(defaultIsFixtureTest('e2e/some-fixture.spec.ts')).toBe(true);
    expect(defaultIsFixtureTest('e2e/helpers/foo.ts')).toBe(false);
    expect(defaultIsFixtureTest('src/lib/foo.test.ts')).toBe(false);
  });
});

describe('detectFixAndRerunViolations', () => {
  it('flags a harness-helper change with no fixture test', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['e2e/helpers/ue-verification.ts'],
      addsLiveRunToCI: false,
    });
    expect(v.map((x) => x.rule)).toEqual(['harness-change-needs-fixture']);
  });

  it('passes a harness-helper change accompanied by a unit test', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['e2e/helpers/ue-verification.ts', 'e2e/helpers/ue-verification.test.ts'],
      addsLiveRunToCI: false,
    });
    expect(v).toEqual([]);
  });

  it('flags adding a live CI run with no fixture coverage', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['.github/workflows/harness.yml'],
      addsLiveRunToCI: true,
    });
    expect(v.map((x) => x.rule)).toEqual(['live-run-needs-fixture']);
  });

  it('passes a live CI run addition that ships a fixture test', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['.github/workflows/harness.yml', 'e2e/helpers/harness-mode.test.ts'],
      addsLiveRunToCI: true,
    });
    expect(v).toEqual([]);
  });

  it('can report both violations at once', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['e2e/helpers/dispatch-helpers.ts', '.github/workflows/harness.yml'],
      addsLiveRunToCI: true,
    });
    expect(v.map((x) => x.rule).sort()).toEqual(['harness-change-needs-fixture', 'live-run-needs-fixture']);
  });

  it('is clean for an unrelated change', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['src/components/Button.tsx'],
      addsLiveRunToCI: false,
    });
    expect(v).toEqual([]);
  });

  it('honours a custom isFixtureTest classifier', () => {
    const v = detectFixAndRerunViolations({
      changedFiles: ['e2e/helpers/foo.ts', 'custom/proof.fixture.ts'],
      addsLiveRunToCI: false,
      isFixtureTest: (f) => f.includes('.fixture.'),
    });
    expect(v).toEqual([]);
  });
});
