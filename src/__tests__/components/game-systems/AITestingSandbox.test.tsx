import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { AITestingSandbox } from '@/components/modules/game-systems/AITestingSandbox';
import type { TestSuite, TestScenario, ScenarioStatus } from '@/types/ai-testing';
import {
  getRunFreshness,
  parseDbTimestamp,
  RUN_STALENESS_TOLERANCE_MS,
} from '@/components/modules/game-systems/AITestingSandbox/runFreshness';
import { ACCENT_EMERALD, ACCENT_INDIGO } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` color values as `rgb(r, g, b)`; convert for matching. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

let scenarioId = 0;
function makeScenario(status: ScenarioStatus, name = `Scenario ${status}`): TestScenario {
  scenarioId += 1;
  return {
    id: scenarioId,
    suiteId: 1,
    name,
    description: 'A test situation',
    stimuli: [],
    expectedActions: [],
    status,
    lastRunOutput: '',
    lastRunAt: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

function makeSuite(scenarios: TestScenario[]): TestSuite {
  return {
    id: 1,
    name: 'Suite',
    description: '',
    targetClass: 'AARPGEnemyController',
    scenarios,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

const noopHandlers = {
  onUpdateScenario: vi.fn(),
  onCreateScenario: vi.fn(),
  onDeleteScenario: vi.fn(),
  onGenerateTests: vi.fn(),
  onGenerateSingleTest: vi.fn(),
  onGenerateStimuli: vi.fn(),
  onRunTests: vi.fn(),
  isGenerating: false,
};

function renderSandbox(suite: TestSuite) {
  return render(<AITestingSandbox suite={suite} {...noopHandlers} />);
}

describe('AITestingSandbox — pass-rate ProgressRing (Phase 2)', () => {
  it('shows a progressbar with the live pass-rate when scenarios exist', () => {
    renderSandbox(makeSuite([makeScenario('passed'), makeScenario('failed')]));
    const ring = screen.getByRole('progressbar');
    // 1 of 2 passed → 50%
    expect(ring.getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders no progressbar for an empty suite', () => {
    renderSandbox(makeSuite([]));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('colors the ring emerald when the whole suite is green, indigo otherwise', () => {
    const { container: allGreen } = renderSandbox(makeSuite([makeScenario('passed'), makeScenario('passed')]));
    const greenRing = within(allGreen).getByRole('progressbar');
    // The active stroke circle carries the color.
    expect(greenRing.innerHTML).toContain(hexToRgb(ACCENT_EMERALD));

    cleanup();
    const { container: mixed } = renderSandbox(makeSuite([makeScenario('passed'), makeScenario('failed')]));
    const mixedRing = within(mixed).getByRole('progressbar');
    expect(mixedRing.innerHTML).toContain(hexToRgb(ACCENT_INDIGO));
  });
});

describe('AITestingSandbox — icon+label status pills (Phase 2)', () => {
  const cases: Array<[ScenarioStatus, string]> = [
    ['draft', 'Draft'],
    ['ready', 'Ready'],
    ['running', 'Running'],
    ['passed', 'Passed'],
    ['failed', 'Failed'],
    ['error', 'Error'],
  ];

  it('renders a text label (not a color-only dot) for every status', () => {
    for (const [status, label] of cases) {
      cleanup();
      renderSandbox(makeSuite([makeScenario(status, `Name ${status}`)]));
      // Label text proves status survives grayscale / colorblindness.
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});

describe('AITestingSandbox — expand/collapse motion parity (Phase 1)', () => {
  it('reveals the scenario detail editor when the row is toggled', () => {
    renderSandbox(makeSuite([makeScenario('ready', 'Expandable')]));

    // Collapsed: detail labels are not present.
    expect(screen.queryByText('Scenario Description')).toBeNull();

    // The row toggle button carries aria-expanded.
    const toggle = screen.getByRole('button', { name: /Expandable/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Scenario Description')).toBeTruthy();
    expect(screen.getByText('Mock Stimuli')).toBeTruthy();
  });

  it('renders every scenario in the list (staggered entrance)', () => {
    renderSandbox(makeSuite([
      makeScenario('passed', 'Alpha'),
      makeScenario('failed', 'Bravo'),
      makeScenario('ready', 'Charlie'),
    ]));
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });
});

// ── Run-result freshness ──
//
// The status pill is the outcome of the LAST RUN; the scenario keeps being
// edited afterwards. These cover the derivation (pure) and its surfacing.

const MINUTE = 60 * 1000;

/** Render an epoch-ms instant the way SQLite's `datetime('now')` writes it: UTC, no zone suffix. */
function sqliteStamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** A scenario whose last run happened `ranAgoMs` ago and was last edited `editedAgoMs` ago. */
function makeRunScenario(
  status: ScenarioStatus,
  name: string,
  ranAgoMs: number | null,
  editedAgoMs: number,
): TestScenario {
  const now = Date.now();
  return {
    ...makeScenario(status, name),
    lastRunAt: ranAgoMs === null ? null : new Date(now - ranAgoMs).toISOString(),
    updatedAt: sqliteStamp(now - editedAgoMs),
  };
}

describe('AITestingSandbox — run freshness derivation', () => {
  it('reads SQLite naive stamps as UTC, not local time', () => {
    // Without normalisation `new Date('2026-06-01 12:00:00')` is LOCAL noon —
    // off by the machine's UTC offset, which would fake (or mask) staleness.
    expect(parseDbTimestamp('2026-06-01 12:00:00'))
      .toBe(Date.parse('2026-06-01T12:00:00.000Z'));
    expect(parseDbTimestamp('2026-06-01T12:00:00.000Z'))
      .toBe(Date.parse('2026-06-01T12:00:00.000Z'));
    expect(parseDbTimestamp(null)).toBeNull();
    expect(parseDbTimestamp('not-a-date')).toBeNull();
  });

  it('reports never-run when no run has been recorded', () => {
    const f = getRunFreshness(makeRunScenario('ready', 'Fresh draft', null, 0));
    expect(f.state).toBe('never-run');
    expect(f.ranAtMs).toBeNull();
  });

  it('reports running while a run is in flight, whatever the timestamps say', () => {
    expect(getRunFreshness(makeRunScenario('running', 'In flight', 10 * MINUTE, 0)).state)
      .toBe('running');
  });

  it('reports stale when the scenario was edited after its last run', () => {
    const f = getRunFreshness(makeRunScenario('passed', 'Edited since', 30 * MINUTE, 5 * MINUTE));
    expect(f.state).toBe('stale');
    expect(f.driftMs).toBeGreaterThan(RUN_STALENESS_TOLERANCE_MS);
  });

  it('does not report stale for the run write-back itself (two clocks, same moment)', () => {
    // `last_run_at` (JS ISO) and `updated_at` (SQLite, whole seconds) are written
    // by one statement — a couple of seconds apart at most. That must read current.
    const f = getRunFreshness(makeRunScenario('passed', 'Just ran', 2000, 0));
    expect(f.state).toBe('current');
    expect(f.driftMs).toBe(0);
  });
});

describe('AITestingSandbox — run freshness in the card', () => {
  it('marks a passed-but-edited scenario Stale next to its green pill', () => {
    renderSandbox(makeSuite([makeRunScenario('passed', 'Drifted', 30 * MINUTE, 5 * MINUTE)]));
    // Both are shown: the outcome, and the fact it no longer describes the scenario.
    expect(screen.getByText('Passed')).toBeTruthy();
    expect(screen.getByText('Stale')).toBeTruthy();
  });

  it('says "never run" instead of implying the pill is a result', () => {
    renderSandbox(makeSuite([makeRunScenario('ready', 'Unrun', null, 0)]));
    expect(screen.getByText('never run')).toBeTruthy();
    expect(screen.queryByText('Stale')).toBeNull();
  });

  it('leaves a current result unmarked', () => {
    renderSandbox(makeSuite([makeRunScenario('passed', 'Verified', 2000, 0)]));
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByText(/^ran /)).toBeTruthy();
  });
});
