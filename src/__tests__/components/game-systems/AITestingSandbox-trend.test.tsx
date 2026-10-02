/**
 * "What broke since the last run": the suite header counts regressions and
 * fixes from each scenario's retained run history, and each ScenarioCard names
 * its own trend. There is no Flaky chip or count.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AITestingSandbox } from '@/components/modules/game-systems/AITestingSandbox';
import { SandboxTab } from '@/components/modules/game-systems/AIBehaviorView/SandboxTab';
import type { TestSuite, TestScenario, ScenarioRunRecord } from '@/types/ai-testing';

afterEach(cleanup);

let n = 0;
function rec(status: ScenarioRunRecord['status'], definitionHash = 'h1'): ScenarioRunRecord {
  n += 1;
  return { runId: `r-${String(n).padStart(8, '0')}`, status, ranAt: '2026-09-30T10:00:00.000Z', definitionHash };
}

function scenario(name: string, history: ScenarioRunRecord[]): TestScenario {
  n += 1;
  return {
    id: n, suiteId: 1, name, description: '', stimuli: [], expectedActions: [],
    status: history[0]?.status ?? 'draft', lastRunOutput: '', lastRunAt: history[0]?.ranAt ?? null,
    createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', history,
  };
}

function suite(): TestSuite {
  return {
    id: 1, name: 'Enemy AI', description: '', targetClass: 'AEnemyController',
    createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z',
    scenarios: [
      scenario('Chase', [rec('failed'), rec('passed')]),
      scenario('Flee', [rec('error'), rec('passed')]),
      scenario('Patrol', [rec('passed', 'h2'), rec('failed', 'h1')]),
      scenario('Idle', [rec('passed'), rec('passed')]),
      scenario('Guard', [rec('failed'), rec('failed')]),
      scenario('Alert', [rec('passed')]),
    ],
  };
}

const handlers = {
  onUpdateScenario: vi.fn(), onCreateScenario: vi.fn(), onDeleteScenario: vi.fn(),
  onGenerateTests: vi.fn(), onGenerateSingleTest: vi.fn(), onGenerateStimuli: vi.fn(),
  onRunTests: vi.fn(), isGenerating: false,
};

function cardOf(label: HTMLElement): string {
  return label.closest('button')!.textContent ?? '';
}

describe('AITestingSandbox - since last run (case 6, revised)', () => {
  it("shows '2 regressed' and '1 fixed' in the header, a Regressed chip on exactly Chase and Flee, and no Flaky anything", () => {
    render(<AITestingSandbox suite={suite()} {...handlers} />);
    expect(screen.getByText('2 regressed')).toBeTruthy();
    expect(screen.getByText('1 fixed')).toBeTruthy();

    const regressed = screen.getAllByText('Regressed');
    expect(regressed).toHaveLength(2);
    expect(regressed.map(cardOf).map((t) => t.match(/^(Chase|Flee)/)?.[1]).sort()).toEqual(['Chase', 'Flee']);

    const fixed = screen.getAllByText('Fixed');
    expect(fixed).toHaveLength(1);
    expect(cardOf(fixed[0])).toMatch(/^Patrol/);
    expect(cardOf(fixed[0])).toMatch(/after an edit/);

    expect(screen.queryByText(/flak/i)).toBeNull();
  });

  it('each card with history carries an outcome strip that is labelled, not colour-only', () => {
    render(<AITestingSandbox suite={suite()} {...handlers} />);
    const strip = screen.getByRole('img', { name: /Chase run history, newest first: failed, passed/i });
    expect(within(strip).getAllByTestId('run-outcome')).toHaveLength(2);
  });

  it('a suite with no retained runs shows no since-last-run counts', () => {
    const s = suite();
    s.scenarios = s.scenarios.map((x) => ({ ...x, history: [] }));
    render(<AITestingSandbox suite={s} {...handlers} />);
    expect(screen.queryByText(/regressed/i)).toBeNull();
    expect(screen.queryByText(/fixed/i)).toBeNull();
  });
});

describe('SandboxTab suite list - regression count per suite', () => {
  it('names how many scenarios of each suite regressed since their last run', () => {
    const s = suite();
    render(
      <SandboxTab
        isLoading={false} error={null} retry={vi.fn()}
        summary={{ totalSuites: 1, totalScenarios: 6, passedCount: 3, failedCount: 3, draftCount: 0 }}
        suites={[s]} activeSuite={null} setActiveSuiteId={vi.fn()}
        onDeleteSuite={vi.fn()} deleteScenario={vi.fn(async () => true)}
        actionError={null} onDismissActionError={vi.fn()}
        newSuiteName="" setNewSuiteName={vi.fn()} newTargetClass="" setNewTargetClass={vi.fn()}
        isCreating={false} handleCreateSuite={vi.fn()} handleUpdateScenario={vi.fn()}
        handleCreateScenario={vi.fn()} handleGenerateAllTests={vi.fn()} handleGenerateSingleTest={vi.fn()}
        handleGenerateStimuli={vi.fn()} handleRunTests={vi.fn()} isAnyRunning={false}
      />,
    );
    const row = screen.getByText('Enemy AI').closest('button')!;
    expect(within(row).getByText('2 regressed')).toBeTruthy();
  });
});
