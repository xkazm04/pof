/**
 * One scenario <-> UE automation test identity, spoken by every sandbox prompt.
 *
 * Generate All, Generate Single and Run used to spell the test path three ways
 * (category only / `<class>.<name with spaces replaced>` / a class-wide filter),
 * so a scenario could never be graded individually from UE's report.
 */
import { describe, it, expect } from 'vitest';
import {
  aiScenarioTestPath,
  aiScenarioTestPrefix,
  aiTestReportDir,
  isAiTestReportDir,
} from '@/lib/ai-testing/test-identity';
import {
  buildGenerateTestsPrompt,
  buildSingleScenarioTestPrompt,
  buildRunTestsPrompt,
} from '@/lib/prompts/ai-testing';
import type { ProjectContext } from '@/lib/prompt-context';
import type { TestScenario, TestSuite } from '@/types/ai-testing';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

function scenario(id: number, name: string): TestScenario {
  return {
    id,
    suiteId: 1,
    name,
    description: `${name} description`,
    stimuli: [],
    expectedActions: [],
    status: 'ready',
    lastRunOutput: '',
    lastRunAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const SUITE: TestSuite = {
  id: 1,
  name: 'Aggro',
  description: 'Perception + chase',
  targetClass: 'AARPGEnemyAIController',
  scenarios: [scenario(3, 'Enemy sees player at 50m...'), scenario(12, 'Flee at 10% HP')],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('aiScenarioTestPath / aiScenarioTestPrefix', () => {
  it('slugs the scenario name so the leaf never adds a UE hierarchy level', () => {
    const path = aiScenarioTestPath({ targetClass: 'AARPGEnemyAIController' }, { id: 3, name: 'Enemy sees player at 50m...' });
    expect(path).toBe('AI.BehaviorTests.AARPGEnemyAIController.S3_Enemy_sees_player_at_50m');
    expect(path.split('.')).toHaveLength(4);
    expect(aiScenarioTestPrefix(SUITE, { id: 3 })).toBe('AI.BehaviorTests.AARPGEnemyAIController.S3_');
  });
});

describe('every sandbox prompt speaks the same test identity', () => {
  it('Generate All, Generate Single and Run name each scenario by aiScenarioTestPath / its prefix', () => {
    const all = buildGenerateTestsPrompt(SUITE, CTX);
    for (const s of SUITE.scenarios) expect(all).toContain(aiScenarioTestPath(SUITE, s));

    for (const s of SUITE.scenarios) {
      expect(buildSingleScenarioTestPrompt(s, SUITE, CTX)).toContain(aiScenarioTestPath(SUITE, s));
    }

    const runId = 'r-abc12345';
    const reportDir = aiTestReportDir(CTX.projectPath, runId);
    const run = buildRunTestsPrompt(SUITE, CTX, { runId, reportDir });
    const filter = SUITE.scenarios.map((s) => aiScenarioTestPrefix(SUITE, s)).join('+');
    expect(run).toContain(`-ExecCmds=Automation RunTests ${filter};Quit`);
    expect(run).toContain(`-ReportOutputPath=${reportDir}`);
    // The model is no longer asked to be the grader.
    expect(run).not.toContain('Parse the test output log');
  });
});

describe('aiTestReportDir', () => {
  it('lives under <project>/Saved/Automation/PoF-AITests/<runId> and passes its own validator', () => {
    const dir = aiTestReportDir('C:\\proj\\PoF', 'r-abc12345');
    expect(dir).toBe('C:/proj/PoF/Saved/Automation/PoF-AITests/r-abc12345');
    expect(isAiTestReportDir(dir, 'r-abc12345')).toBe(true);
    expect(isAiTestReportDir('C:/proj/PoF/Saved/Automation/PoF-AITests/../../../x/r-abc12345', 'r-abc12345')).toBe(false);
    expect(isAiTestReportDir('C:/proj/PoF/Saved/Automation/PoF-AITests/r-other000', 'r-abc12345')).toBe(false);
    expect(isAiTestReportDir('relative/Saved/Automation/PoF-AITests/r-abc12345', 'r-abc12345')).toBe(false);
  });
});
