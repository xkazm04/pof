import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { AITestingSandbox } from '@/components/modules/game-systems/AITestingSandbox';
import type { TestSuite, TestScenario, ScenarioStatus } from '@/types/ai-testing';
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
