'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Play, FlaskConical, Zap, Loader2,
} from 'lucide-react';
import { summarizeScenarios } from '@/types/ai-testing';
import type {
  TestSuite,
  TestScenario,
} from '@/types/ai-testing';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  OPACITY_15, OPACITY_30,
  ACCENT_EMERALD, ACCENT_INDIGO,
} from '@/lib/chart-colors';
import { DURATION, EASE_OUT, STAGGER } from '@/lib/motion';
import { SYSTEMS_ACCENT } from './constants';
import { ScenarioCard } from './ScenarioCard';

// ── Props ──

interface AITestingSandboxProps {
  suite: TestSuite;
  onUpdateScenario: (id: number, updates: Partial<TestScenario>) => void;
  onCreateScenario: (name: string) => void;
  onDeleteScenario: (id: number) => void;
  onGenerateTests: () => void;
  onGenerateSingleTest: (scenario: TestScenario) => void;
  onGenerateStimuli: (scenario: TestScenario) => void;
  onRunTests: () => void;
  isGenerating: boolean;
}

export function AITestingSandbox({
  suite,
  onUpdateScenario,
  onCreateScenario,
  onDeleteScenario,
  onGenerateTests,
  onGenerateSingleTest,
  onGenerateStimuli,
  onRunTests,
  isGenerating,
}: AITestingSandboxProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newScenarioName, setNewScenarioName] = useState('');

  const handleAddScenario = useCallback(() => {
    if (!newScenarioName.trim()) return;
    onCreateScenario(newScenarioName.trim());
    setNewScenarioName('');
  }, [newScenarioName, onCreateScenario]);

  // Shared aggregation so the suite counts/pass-rate stay in lockstep with the
  // DB summary (getTestingSummary) — both derive from summarizeScenarios.
  const { total: totalCount, passed: passedCount, failed: failedCount, passRate } =
    summarizeScenarios(suite.scenarios);
  // Live pass-rate ring: emerald when the whole suite is green, indigo while pending/mixed.
  const ringColor = passRate === 100 ? ACCENT_EMERALD : ACCENT_INDIGO;

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {totalCount > 0 && (
          <ProgressRing
            value={passRate}
            size={56}
            strokeWidth={5}
            color={ringColor}
            label={`${passRate}% pass rate — ${passedCount} of ${totalCount} passed`}
            className="flex-shrink-0 mr-1"
          />
        )}
        <FlaskConical className="w-4 h-4" style={{ color: SYSTEMS_ACCENT }} />
        <span className="text-xs font-semibold text-text">Test Scenarios</span>
        <span className="text-2xs text-text-muted ml-1">
          {suite.scenarios.length} scenarios
        </span>

        {/* Pass/fail badges */}
        {passedCount > 0 && (
          <span
            className="text-2xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${STATUS_SUCCESS}15`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}30` }}
          >
            {passedCount} passed
          </span>
        )}
        {failedCount > 0 && (
          <span
            className="text-2xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}30` }}
          >
            {failedCount} failed
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={onRunTests}
          disabled={isGenerating || suite.scenarios.length === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`,
            color: STATUS_SUCCESS,
            border: `1px solid ${STATUS_SUCCESS}${OPACITY_30}`,
          }}
        >
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Run Tests
        </button>

        <button
          onClick={onGenerateTests}
          disabled={isGenerating || suite.scenarios.length === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${SYSTEMS_ACCENT}15`,
            color: SYSTEMS_ACCENT,
            border: `1px solid ${SYSTEMS_ACCENT}30`,
          }}
        >
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Generate All Tests
        </button>
      </div>

      {/* Scenario list */}
      <div className="flex-1 overflow-y-auto">
        {suite.scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FlaskConical className="w-8 h-8 text-border-bright mb-3" />
            <p className="text-xs text-text-muted max-w-xs">
              Define test scenarios to validate your AI behavior tree. Describe game situations and expected NPC responses.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <AnimatePresence>
              {suite.scenarios.map((scenario, index) => (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT, delay: index * STAGGER.fast }}
                >
                  <ScenarioCard
                    scenario={scenario}
                    isExpanded={expandedId === scenario.id}
                    onToggle={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                    onUpdate={(updates) => onUpdateScenario(scenario.id, updates)}
                    onDelete={() => onDeleteScenario(scenario.id)}
                    onGenerateTest={() => onGenerateSingleTest(scenario)}
                    onGenerateStimuli={() => onGenerateStimuli(scenario)}
                    isGenerating={isGenerating}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add scenario input */}
      <div className="px-3 py-2.5 border-t border-border">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newScenarioName}
            onChange={(e) => setNewScenarioName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddScenario(); }}
            placeholder="e.g. Enemy sees player at 50m..."
            className="flex-1 px-2.5 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors min-w-0"
          />
          <button
            onClick={handleAddScenario}
            disabled={!newScenarioName.trim()}
            className="px-2 py-2 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
            style={{
              backgroundColor: `${SYSTEMS_ACCENT}15`,
              color: SYSTEMS_ACCENT,
              border: `1px solid ${SYSTEMS_ACCENT}30`,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
