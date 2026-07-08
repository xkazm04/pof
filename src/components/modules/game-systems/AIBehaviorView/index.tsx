'use client';

import { useState, useCallback, useRef } from 'react';
import {
  FlaskConical,
} from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { useAITesting } from '@/hooks/useAITesting';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import {
  buildGenerateTestsPrompt,
  buildSingleScenarioTestPrompt,
} from '@/lib/prompts/ai-testing';
import { TaskFactory } from '@/lib/cli-task';
import type { TestScenario } from '@/types/ai-testing';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SYSTEMS_ACCENT } from './constants';
import { SandboxTab } from './SandboxTab';

export function AIBehaviorView() {
  const mod = SUB_MODULE_MAP['ai-behavior'];
  const cat = getCategoryForSubModule('ai-behavior');

  const {
    suites,
    summary,
    activeSuite,
    isLoading,
    error,
    retry,
    setActiveSuiteId,
    createSuite,
    deleteSuite,
    createScenario,
    updateScenario,
    bulkUpdateScenarioStatus,
    deleteScenario,
  } = useAITesting();

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [isCreating, setIsCreating] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newTargetClass, setNewTargetClass] = useState('');

  const ctx = { projectName, projectPath, ueVersion };

  // ── Testing-specific CLI sessions ──

  // Scenario ids set to 'running' by the last Run Tests dispatch — used to
  // reset them to 'error' if the CLI run dies before submitting results.
  const runningIdsRef = useRef<number[]>([]);

  const testGenCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'ai-test-gen',
    label: 'AI Test Gen',
    accentColor: SYSTEMS_ACCENT,
    // Auto-detected stimuli land via @@CALLBACK while the run completes —
    // refetch so the scenario editor shows them.
    onComplete: () => retry(),
  });

  const testRunCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'ai-test-run',
    label: 'AI Test Run',
    accentColor: STATUS_SUCCESS,
    onComplete: (success) => {
      const ids = runningIdsRef.current;
      runningIdsRef.current = [];
      if (!success && ids.length > 0) {
        // One PUT for the whole reset; bulkUpdateScenarioStatus already
        // refetches once afterwards, so no separate retry() needed here.
        bulkUpdateScenarioStatus(ids, 'error', {
          lastRunOutput: 'CLI run failed before reporting results',
          lastRunAt: new Date().toISOString(),
        });
      } else {
        // Pick up the statuses the @@CALLBACK wrote during the run.
        retry();
      }
    },
  });

  // ── Handlers ──

  const handleCreateSuite = useCallback(async () => {
    const name = newSuiteName.trim();
    if (!name) return;
    setIsCreating(true);
    await createSuite({
      name,
      description: '',
      targetClass: newTargetClass.trim() || 'AMyAIController',
    });
    setNewSuiteName('');
    setNewTargetClass('');
    setIsCreating(false);
  }, [newSuiteName, newTargetClass, createSuite]);

  const handleUpdateScenario = useCallback(
    (id: number, updates: Partial<TestScenario>) => {
      updateScenario({ id, ...updates });
    },
    [updateScenario]
  );

  const handleCreateScenario = useCallback(
    (name: string) => {
      if (!activeSuite) return;
      createScenario({ suiteId: activeSuite.id, name, description: '' });
    },
    [activeSuite, createScenario]
  );

  const handleGenerateAllTests = useCallback(() => {
    if (!activeSuite) return;
    const prompt = buildGenerateTestsPrompt(activeSuite, ctx);
    testGenCli.sendPrompt(prompt);
  }, [activeSuite, ctx, testGenCli]);

  const handleGenerateSingleTest = useCallback(
    (scenario: TestScenario) => {
      if (!activeSuite) return;
      const prompt = buildSingleScenarioTestPrompt(scenario, activeSuite, ctx);
      testGenCli.sendPrompt(prompt);
    },
    [activeSuite, ctx, testGenCli]
  );

  const handleGenerateStimuli = useCallback(
    (scenario: TestScenario) => {
      if (!activeSuite) return;
      testGenCli.execute(
        TaskFactory.detectStimuli(
          'ai-behavior',
          {
            scenarioId: scenario.id,
            scenarioDescription: scenario.description,
            targetClass: activeSuite.targetClass,
          },
          window.location.origin,
          'Auto-detect Stimuli'
        )
      );
    },
    [activeSuite, testGenCli]
  );

  const handleRunTests = useCallback(() => {
    if (!activeSuite) return;
    // The existing 'running' status pill becomes real: mark every scenario
    // running now; the @@CALLBACK writes the final per-scenario results.
    // One bulk PUT + one refetch for the whole transition (was N PUTs + N refetches).
    const ids = activeSuite.scenarios.map((s) => s.id);
    runningIdsRef.current = ids;
    bulkUpdateScenarioStatus(ids, 'running');
    testRunCli.execute(
      TaskFactory.runAITests('ai-behavior', activeSuite, window.location.origin, 'AI Test Run')
    );
  }, [activeSuite, testRunCli, bulkUpdateScenarioStatus]);

  const isAnyRunning = testGenCli.isRunning || testRunCli.isRunning;

  if (!mod || !cat) return null;

  // ── Build sandbox tab ──

  const sandboxTab: ExtraTab = {
    id: 'sandbox',
    label: 'Testing Sandbox',
    icon: FlaskConical,
    render: () => (
      <SandboxTab
        isLoading={isLoading}
        error={error}
        retry={retry}
        summary={summary}
        suites={suites}
        activeSuite={activeSuite}
        setActiveSuiteId={setActiveSuiteId}
        deleteSuite={deleteSuite}
        deleteScenario={deleteScenario}
        newSuiteName={newSuiteName}
        setNewSuiteName={setNewSuiteName}
        newTargetClass={newTargetClass}
        setNewTargetClass={setNewTargetClass}
        isCreating={isCreating}
        handleCreateSuite={handleCreateSuite}
        handleUpdateScenario={handleUpdateScenario}
        handleCreateScenario={handleCreateScenario}
        handleGenerateAllTests={handleGenerateAllTests}
        handleGenerateSingleTest={handleGenerateSingleTest}
        handleGenerateStimuli={handleGenerateStimuli}
        handleRunTests={handleRunTests}
        isAnyRunning={isAnyRunning}
      />
    ),
  };

  return (
    <ReviewableModuleView
      moduleId="ai-behavior"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('ai-behavior')}
      quickActions={mod.quickActions}
      extraTabs={[sandboxTab]}
    />
  );
}
