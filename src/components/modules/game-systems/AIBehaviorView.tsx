'use client';

import { useState, useCallback } from 'react';
import {
  Bot, Plus, Trash2, Loader2,
  FlaskConical,
} from 'lucide-react';
import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { useAITesting } from '@/hooks/useAITesting';
import { FetchError } from '../shared/FetchError';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { AITestingSandbox } from './AITestingSandbox';
import {
  buildGenerateTestsPrompt,
  buildSingleScenarioTestPrompt,
  buildMockStimuliPrompt,
  buildRunTestsPrompt,
} from '@/lib/prompts/ai-testing';
import type { TestScenario } from '@/types/ai-testing';
import type { ExtraTab } from '../shared/ReviewableModuleView';

const SYSTEMS_ACCENT = '#8b5cf6';

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

  const testGenCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'ai-test-gen',
    label: 'AI Test Gen',
    accentColor: SYSTEMS_ACCENT,
  });

  const testRunCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'ai-test-run',
    label: 'AI Test Run',
    accentColor: '#4ade80',
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
      const prompt = buildMockStimuliPrompt(
        scenario.description,
        activeSuite.targetClass,
        ctx
      );
      testGenCli.sendPrompt(prompt);
    },
    [activeSuite, ctx, testGenCli]
  );

  const handleRunTests = useCallback(() => {
    if (!activeSuite) return;
    const prompt = buildRunTestsPrompt(activeSuite, ctx);
    testRunCli.sendPrompt(prompt);
  }, [activeSuite, ctx, testRunCli]);

  const isAnyRunning = testGenCli.isRunning || testRunCli.isRunning;

  if (!mod || !cat) return null;

  // ── Build sandbox tab ──

  const sandboxTab: ExtraTab = {
    id: 'sandbox',
    label: 'Testing Sandbox',
    icon: FlaskConical,
    render: () => {
      if (isLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted-hover" />
          </div>
        );
      }

      if (error) {
        return <FetchError message={error} onRetry={retry} />;
      }

      return (
        <div className="flex h-full">
          {/* Left sidebar — Suite list */}
          <div className="w-56 border-r border-border bg-surface-deep flex-shrink-0 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
              <Bot className="w-3.5 h-3.5" style={{ color: SYSTEMS_ACCENT }} />
              <h2 className="text-xs font-semibold text-text">AI Test Suites</h2>
            </div>

            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center justify-between text-2xs text-text-muted">
                <span>{summary.totalSuites} suites</span>
                <span>{summary.totalScenarios} scenarios</span>
              </div>
              {summary.totalScenarios > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  {summary.passedCount > 0 && (
                    <span className="text-2xs text-[#4ade80]">{summary.passedCount} passed</span>
                  )}
                  {summary.failedCount > 0 && (
                    <span className="text-2xs text-[#f87171]">{summary.failedCount} failed</span>
                  )}
                  {summary.draftCount > 0 && (
                    <span className="text-2xs text-text-muted">{summary.draftCount} draft</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {suites.map((suite) => {
                  const isActive = activeSuite?.id === suite.id;
                  const passed = suite.scenarios.filter((s) => s.status === 'passed').length;
                  const total = suite.scenarios.length;
                  return (
                    <button
                      key={suite.id}
                      onClick={() => setActiveSuiteId(suite.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors ${
                        isActive
                          ? 'bg-surface-hover text-text'
                          : 'text-text-muted-hover hover:bg-surface hover:text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{suite.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-5">
                        <span className="text-2xs text-text-muted">
                          {total > 0 ? `${passed}/${total} passed` : 'no scenarios'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-2 border-t border-border space-y-1.5">
              <input
                type="text"
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuite(); }}
                placeholder="New test suite..."
                className="w-full px-2.5 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
              />
              <input
                type="text"
                value={newTargetClass}
                onChange={(e) => setNewTargetClass(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuite(); }}
                placeholder="Target class (e.g. AMyAIController)"
                className="w-full px-2.5 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors font-mono"
              />
              <button
                onClick={handleCreateSuite}
                disabled={!newSuiteName.trim() || isCreating}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${SYSTEMS_ACCENT}15`,
                  color: SYSTEMS_ACCENT,
                  border: `1px solid ${SYSTEMS_ACCENT}30`,
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Suite
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeSuite ? (
              <>
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-semibold text-text truncate">{activeSuite.name}</h1>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">
                      {activeSuite.targetClass} &middot; {activeSuite.scenarios.length} scenarios
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSuite(activeSuite.id)}
                    className="px-2 py-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
                    title="Delete suite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <AITestingSandbox
                    suite={activeSuite}
                    onUpdateScenario={handleUpdateScenario}
                    onCreateScenario={handleCreateScenario}
                    onDeleteScenario={deleteScenario}
                    onGenerateTests={handleGenerateAllTests}
                    onGenerateSingleTest={handleGenerateSingleTest}
                    onGenerateStimuli={handleGenerateStimuli}
                    onRunTests={handleRunTests}
                    isGenerating={isAnyRunning}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <FlaskConical className="w-10 h-10 mx-auto text-border-bright" />
                  <div>
                    <h2 className="text-sm font-semibold text-text">AI Behavior Testing Sandbox</h2>
                    <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                      Define test scenarios for your AI behavior trees. Describe game situations, expected NPC responses, and generate C++ unit tests using UE5&apos;s Automation Framework.
                    </p>
                  </div>
                  <div className="space-y-2 mt-4">
                    <input
                      type="text"
                      value={newSuiteName}
                      onChange={(e) => setNewSuiteName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuite(); }}
                      placeholder="e.g. Enemy AI Combat Tests"
                      className="w-64 px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors mx-auto block"
                    />
                    <input
                      type="text"
                      value={newTargetClass}
                      onChange={(e) => setNewTargetClass(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuite(); }}
                      placeholder="Target class (e.g. AEnemyAIController)"
                      className="w-64 px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors mx-auto block font-mono"
                    />
                    <button
                      onClick={handleCreateSuite}
                      disabled={!newSuiteName.trim() || isCreating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50 mx-auto"
                      style={{
                        backgroundColor: `${SYSTEMS_ACCENT}15`,
                        color: SYSTEMS_ACCENT,
                        border: `1px solid ${SYSTEMS_ACCENT}30`,
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Test Suite
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },
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
