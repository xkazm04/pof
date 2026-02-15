'use client';

import { useState, useCallback } from 'react';
import {
  Plus, Trash2, Play, FlaskConical, Zap, ChevronDown, ChevronRight,
  Loader2, Eye, Ear, Crosshair, Tag, Sparkles, AlertTriangle,
} from 'lucide-react';
import type {
  TestSuite,
  TestScenario,
  MockStimulus,
  ExpectedAction,
  StimulusType,
  ScenarioStatus,
} from '@/types/ai-testing';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

const SYSTEMS_ACCENT = '#8b5cf6';

// ── Stimulus type metadata ──

const STIMULUS_META: Record<StimulusType, { label: string; icon: typeof Eye; color: string }> = {
  perception_sight: { label: 'Sight', icon: Eye, color: '#60a5fa' },
  perception_hearing: { label: 'Hearing', icon: Ear, color: '#fbbf24' },
  perception_damage: { label: 'Damage Sense', icon: Crosshair, color: '#f87171' },
  damage_event: { label: 'Damage Event', icon: AlertTriangle, color: '#fb923c' },
  gameplay_tag: { label: 'Gameplay Tag', icon: Tag, color: '#4ade80' },
  custom: { label: 'Custom', icon: Sparkles, color: '#c084fc' },
};

const STATUS_COLORS: Record<ScenarioStatus, string> = {
  draft: 'var(--text-muted)',
  ready: '#60a5fa',
  running: '#fbbf24',
  passed: '#4ade80',
  failed: '#f87171',
  error: '#fb923c',
};

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

  const passedCount = suite.scenarios.filter((s) => s.status === 'passed').length;
  const failedCount = suite.scenarios.filter((s) => s.status === 'failed' || s.status === 'error').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <FlaskConical className="w-4 h-4" style={{ color: SYSTEMS_ACCENT }} />
        <span className="text-xs font-semibold text-text">Test Scenarios</span>
        <span className="text-2xs text-text-muted ml-1">
          {suite.scenarios.length} scenarios
        </span>

        {/* Pass/fail badges */}
        {passedCount > 0 && (
          <span className="text-2xs px-1.5 py-0.5 rounded bg-[#4ade8015] text-[#4ade80] border border-[#4ade8030]">
            {passedCount} passed
          </span>
        )}
        {failedCount > 0 && (
          <span className="text-2xs px-1.5 py-0.5 rounded bg-[#f8717115] text-[#f87171] border border-[#f8717130]">
            {failedCount} failed
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={onRunTests}
          disabled={isGenerating || suite.scenarios.length === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: '#4ade8015',
            color: '#4ade80',
            border: '1px solid #4ade8030',
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
            {suite.scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isExpanded={expandedId === scenario.id}
                onToggle={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                onUpdate={(updates) => onUpdateScenario(scenario.id, updates)}
                onDelete={() => onDeleteScenario(scenario.id)}
                onGenerateTest={() => onGenerateSingleTest(scenario)}
                onGenerateStimuli={() => onGenerateStimuli(scenario)}
                isGenerating={isGenerating}
              />
            ))}
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

// ── Scenario Card ──

function ScenarioCard({
  scenario,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onGenerateTest,
  onGenerateStimuli,
  isGenerating,
}: {
  scenario: TestScenario;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<TestScenario>) => void;
  onDelete: () => void;
  onGenerateTest: () => void;
  onGenerateStimuli: () => void;
  isGenerating: boolean;
}) {
  const statusColor = STATUS_COLORS[scenario.status];

  const handleAddStimulus = () => {
    const newStimulus: MockStimulus = {
      id: `stim-${Date.now()}`,
      type: 'perception_sight',
      label: 'New stimulus',
      description: '',
      params: {},
    };
    onUpdate({ stimuli: [...scenario.stimuli, newStimulus] });
  };

  const handleUpdateStimulus = (idx: number, updates: Partial<MockStimulus>) => {
    const updated = scenario.stimuli.map((s, i) => (i === idx ? { ...s, ...updates } : s));
    onUpdate({ stimuli: updated });
  };

  const handleRemoveStimulus = (idx: number) => {
    onUpdate({ stimuli: scenario.stimuli.filter((_, i) => i !== idx) });
  };

  const handleAddExpected = () => {
    const newAction: ExpectedAction = {
      id: `exp-${Date.now()}`,
      action: '',
      btNode: '',
      timeoutSeconds: 5,
    };
    onUpdate({ expectedActions: [...scenario.expectedActions, newAction] });
  };

  const handleUpdateExpected = (idx: number, updates: Partial<ExpectedAction>) => {
    const updated = scenario.expectedActions.map((a, i) => (i === idx ? { ...a, ...updates } : a));
    onUpdate({ expectedActions: updated });
  };

  const handleRemoveExpected = (idx: number) => {
    onUpdate({ expectedActions: scenario.expectedActions.filter((_, i) => i !== idx) });
  };

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}

        {/* Status dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColor }}
        />

        <span className="text-xs text-text truncate flex-1 text-left">{scenario.name}</span>

        <span className="text-2xs text-text-muted">
          {scenario.stimuli.length} stimuli &middot; {scenario.expectedActions.length} expected
        </span>

        <span
          className="text-2xs px-1.5 py-0.5 rounded capitalize"
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
            border: `1px solid ${statusColor}30`,
          }}
        >
          {scenario.status}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Description */}
          <div className="pt-3">
            <label className="text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold">
              Scenario Description
            </label>
            <textarea
              value={scenario.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe the game situation in natural language..."
              className="w-full px-3 py-2 bg-surface border border-border rounded text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none"
              rows={2}
            />
          </div>

          {/* Stimuli */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
                Mock Stimuli
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={onGenerateStimuli}
                  disabled={isGenerating || !scenario.description.trim()}
                  className="text-2xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                  style={{ color: SYSTEMS_ACCENT }}
                  title="Auto-generate stimuli from description"
                >
                  <Sparkles className="w-3 h-3 inline mr-0.5" />
                  Auto-detect
                </button>
                <button
                  onClick={handleAddStimulus}
                  className="text-2xs text-text-muted hover:text-text transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {scenario.stimuli.map((stim, idx) => {
                const meta = STIMULUS_META[stim.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={stim.id}
                    className="flex items-start gap-2 px-2.5 py-2 bg-surface border border-border rounded"
                  >
                    <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={stim.type}
                          onChange={(e) => handleUpdateStimulus(idx, { type: e.target.value as StimulusType })}
                          className="bg-surface-deep border border-border rounded text-xs text-text px-1.5 py-0.5 outline-none"
                        >
                          {Object.entries(STIMULUS_META).map(([key, m]) => (
                            <option key={key} value={key}>{m.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={stim.label}
                          onChange={(e) => handleUpdateStimulus(idx, { label: e.target.value })}
                          placeholder="Label"
                          className="flex-1 bg-transparent text-xs text-text placeholder-text-muted outline-none min-w-0"
                        />
                      </div>
                      <input
                        type="text"
                        value={stim.description}
                        onChange={(e) => handleUpdateStimulus(idx, { description: e.target.value })}
                        placeholder="What happens in the game world..."
                        className="w-full bg-transparent text-xs text-text-muted-hover placeholder-text-muted outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveStimulus(idx)}
                      className="text-text-muted hover:text-[#f87171] transition-colors mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expected Actions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
                Expected Actions
              </label>
              <button
                onClick={handleAddExpected}
                className="text-2xs text-text-muted hover:text-text transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {scenario.expectedActions.map((ea, idx) => (
                <div
                  key={ea.id}
                  className="flex items-start gap-2 px-2.5 py-2 bg-surface border border-border rounded"
                >
                  <Play className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#4ade80]" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={ea.action}
                      onChange={(e) => handleUpdateExpected(idx, { action: e.target.value })}
                      placeholder="Expected action (e.g. 'Enter Chase state')"
                      className="w-full bg-transparent text-xs text-text placeholder-text-muted outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ea.btNode}
                        onChange={(e) => handleUpdateExpected(idx, { btNode: e.target.value })}
                        placeholder="BT node (optional)"
                        className="flex-1 bg-transparent text-xs text-text-muted-hover placeholder-text-muted outline-none min-w-0"
                      />
                      <span className="text-2xs text-text-muted">timeout:</span>
                      <input
                        type="number"
                        value={ea.timeoutSeconds}
                        onChange={(e) => handleUpdateExpected(idx, { timeoutSeconds: Number(e.target.value) || 5 })}
                        className="w-10 bg-surface-deep border border-border rounded text-xs text-text px-1.5 py-0.5 outline-none text-center"
                        min={1}
                        max={60}
                      />
                      <span className="text-2xs text-text-muted">s</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveExpected(idx)}
                    className="text-text-muted hover:text-[#f87171] transition-colors mt-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Last run output */}
          {scenario.lastRunOutput && (
            <div>
              <label className="text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold">
                Last Run Output
              </label>
              <pre className="px-3 py-2 bg-surface border border-border rounded text-xs text-text-muted-hover whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                {scenario.lastRunOutput}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onGenerateTest}
              disabled={isGenerating || scenario.stimuli.length === 0}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${SYSTEMS_ACCENT}15`,
                color: SYSTEMS_ACCENT,
                border: `1px solid ${SYSTEMS_ACCENT}30`,
              }}
            >
              <Zap className="w-3 h-3" />
              Generate Test
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-text-muted hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
