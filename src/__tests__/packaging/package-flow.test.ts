/**
 * `packageFlow` is the Package button's decision, as a pure reducer: a press is
 * gated by a FAST pre-flight verdict for the pressed profile's OWN maps, a verdict
 * for other maps never releases the cook, and a blocked gate can run the checks it
 * is missing and then cook (ai-registry game-production/ship-pipeline-gating —
 * unmeasured is not a pass).
 */
import { describe, it, expect } from 'vitest';
import {
  packageFlow,
  INITIAL_PACKAGE_FLOW,
  type PackageFlowState,
  type PreflightStatusSummary,
} from '@/lib/packaging/package-flow';

const B_MAPS = ['/Game/Maps/B'];
const SHIPPING = 'Build verify (Shipping)';
const ASSETS = 'Asset validation';

function summary(over: Partial<PreflightStatusSummary> = {}): PreflightStatusSummary {
  return {
    canCook: true,
    overall: 'pass',
    fullyCovered: false,
    notRunLabels: [SHIPPING, ASSETS],
    notRunKinds: ['build-verify-shipping', 'asset-validation'],
    coverage: { ran: 2, total: 4 },
    mapsKey: '',
    failing: [],
    failingKinds: [],
    running: [],
    ...over,
  };
}

function measuringB(): PackageFlowState {
  return packageFlow(INITIAL_PACKAGE_FLOW, {
    type: 'press', profileId: 'B', maps: B_MAPS, summary: summary({ mapsKey: '' }),
  });
}

function blockedB(over: Partial<Extract<PackageFlowState, { phase: 'blocked' }>> = {}): PackageFlowState {
  return {
    phase: 'blocked', seq: 1, profileId: 'B', maps: B_MAPS, mapsKey: '/Game/Maps/B',
    failing: [], failingKinds: [],
    notRunLabels: [SHIPPING, ASSETS], notRunKinds: ['build-verify-shipping', 'asset-validation'],
    ...over,
  };
}

describe('packageFlow — a press is gated by ITS profile\'s maps', () => {
  it('press B while the held verdict measured the default maps ("") -> measuring B\'s maps, no cook', () => {
    const next = measuringB();
    expect(next).toMatchObject({ phase: 'measuring', profileId: 'B', mapsKey: '/Game/Maps/B', kinds: ['fast'] });
    expect(next.phase).not.toBe('cook');
  });

  it('measuring B + a passing summary for B\'s maps -> cook, disclosing the unrun slow checks (never a veto)', () => {
    const next = packageFlow(measuringB(), {
      type: 'summary', summary: summary({ mapsKey: '/Game/Maps/B', canCook: true }),
    });
    expect(next).toMatchObject({ phase: 'cook', profileId: 'B', disclosedNotRun: [SHIPPING, ASSETS] });
  });

  it('measuring B + a failing summary for B\'s maps -> blocked, naming the failing check', () => {
    const next = packageFlow(measuringB(), {
      type: 'summary',
      summary: summary({ mapsKey: '/Game/Maps/B', canCook: false, overall: 'fail', failing: ['Config sanity'], failingKinds: ['fast'] }),
    });
    expect(next).toMatchObject({ phase: 'blocked', profileId: 'B', failing: ['Config sanity'] });
  });

  it('blocked B + measure-missing -> measuring the unrun kinds; then no fail -> cook, a fail -> blocked', () => {
    const measuring = packageFlow(blockedB(), { type: 'measure-missing' });
    expect(measuring).toMatchObject({ phase: 'measuring', profileId: 'B', kinds: ['build-verify-shipping', 'asset-validation'] });

    const measured = summary({ mapsKey: '/Game/Maps/B', notRunLabels: [], notRunKinds: [], fullyCovered: true, coverage: { ran: 4, total: 4 } });
    expect(packageFlow(measuring, { type: 'summary', summary: measured })).toMatchObject({ phase: 'cook', profileId: 'B' });

    const failed = { ...measured, canCook: false, overall: 'fail' as const, failing: [SHIPPING], failingKinds: ['build-verify-shipping' as const] };
    expect(packageFlow(measuring, { type: 'summary', summary: failed })).toMatchObject({ phase: 'blocked', failing: [SHIPPING] });
  });

  it('measuring B + a summary for a stale mapsKey ("" or another profile\'s) -> state unchanged', () => {
    const m = measuringB();
    expect(packageFlow(m, { type: 'summary', summary: summary({ mapsKey: '' }) })).toBe(m);
    expect(packageFlow(m, { type: 'summary', summary: summary({ mapsKey: '/Game/Maps/A' }) })).toBe(m);
    expect(packageFlow(m, { type: 'summary', summary: summary({ mapsKey: null }) })).toBe(m);
  });

  it('[guard] blocked B + override -> cook B, overridden (Package anyway preserved)', () => {
    expect(packageFlow(blockedB({ failing: ['Config sanity'], failingKinds: ['fast'] }), { type: 'override' }))
      .toMatchObject({ phase: 'cook', profileId: 'B', overridden: true });
  });
});

describe('packageFlow — the edges of the policy', () => {
  it('press the default profile while the fast gate has not returned (overall idle) -> measuring, not cook', () => {
    const idleSummary = summary({ overall: 'idle', mapsKey: null, notRunLabels: ['Config sanity', 'Plugin WITH_EDITOR audit', SHIPPING, ASSETS] });
    const next = packageFlow(INITIAL_PACKAGE_FLOW, { type: 'press', profileId: 'A', maps: [], summary: idleSummary });
    expect(next).toMatchObject({ phase: 'measuring', profileId: 'A', mapsKey: '', kinds: ['fast'] });
  });

  it('press with a verdict already held for the same maps decides at once', () => {
    const next = packageFlow(INITIAL_PACKAGE_FLOW, { type: 'press', profileId: 'A', maps: [], summary: summary({ mapsKey: '' }) });
    expect(next).toMatchObject({ phase: 'cook', profileId: 'A' });
  });

  it('measure-missing after a fast failure re-measures the failing fast checks too', () => {
    const next = packageFlow(blockedB({ failing: ['Config sanity'], failingKinds: ['fast'] }), { type: 'measure-missing' });
    expect(next).toMatchObject({ phase: 'measuring', kinds: ['fast', 'build-verify-shipping', 'asset-validation'] });
  });

  it('a requested check still running holds the flow, even over an older fail', () => {
    const m = packageFlow(blockedB({ failing: ['Config sanity'], failingKinds: ['fast'] }), { type: 'measure-missing' });
    const inFlight = summary({ mapsKey: '/Game/Maps/B', canCook: false, failing: ['Config sanity'], failingKinds: ['fast'], running: ['fast'] });
    expect(packageFlow(m, { type: 'summary', summary: inFlight })).toBe(m);
  });

  it('a requested check that settled without a verdict blocks (unmeasured is not a pass)', () => {
    const m = packageFlow(blockedB(), { type: 'measure-missing' });
    const errored = summary({ mapsKey: '/Game/Maps/B', running: [] });
    expect(packageFlow(m, { type: 'summary', summary: errored }))
      .toMatchObject({ phase: 'blocked', failing: [], notRunKinds: ['build-verify-shipping', 'asset-validation'] });
  });

  it('cancel returns to idle; a press during a cook is ignored; settled ends the cook', () => {
    expect(packageFlow(measuringB(), { type: 'cancel' }).phase).toBe('idle');
    const cook = packageFlow(blockedB(), { type: 'override' });
    expect(packageFlow(cook, { type: 'press', profileId: 'A', maps: [], summary: summary() })).toBe(cook);
    expect(packageFlow(cook, { type: 'settled' }).phase).toBe('idle');
  });
});
