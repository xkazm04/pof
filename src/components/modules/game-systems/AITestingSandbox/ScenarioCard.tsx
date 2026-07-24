'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, ChevronRight, Zap, AlertTriangle,
} from 'lucide-react';
import type {
  TestScenario,
  MockStimulus,
  ExpectedAction,
} from '@/types/ai-testing';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { OPACITY_15, OPACITY_30, STATUS_WARNING } from '@/lib/chart-colors';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { formatTimeAgo } from '@/lib/format-time';
import { STATUS_META, SYSTEMS_ACCENT } from './constants';
import { DebouncedTextarea } from './DebouncedFields';
import { StimuliEditor, ExpectedActionsEditor } from './ScenarioEditors';
import { getRunFreshness, describeRunFreshness } from './runFreshness';

// ── Scenario Card ──

export function ScenarioCard({
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
  const status = STATUS_META[scenario.status];
  const StatusIcon = status.icon;
  // Display-only verdict on how much the status pill is worth: a result that
  // predates the scenario's last edit is stale, not green. Never rewrites status.
  const freshness = getRunFreshness(scenario);
  const freshnessNote = describeRunFreshness(freshness.state);

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
        aria-expanded={isExpanded}
      >
        <ChevronRight
          className="w-3 h-3 text-text-muted flex-shrink-0 transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        />

        <span className="text-xs text-text truncate flex-1 text-left">{scenario.name}</span>

        <span className="text-2xs text-text-muted">
          {scenario.stimuli.length} stimuli &middot; {scenario.expectedActions.length} expected
        </span>

        {/* When the last run happened — without it a status pill reads as if it
            were live truth. `null` means the pill is authored state, not a result. */}
        <span className="text-2xs text-text-muted flex-shrink-0 hidden sm:inline">
          {freshness.ranAtMs === null ? 'never run' : `ran ${formatTimeAgo(freshness.ranAtMs, { extended: true })}`}
        </span>

        {/* Stale marker — the scenario was edited after the run that produced the
            status, so the pill describes an older definition. Glyph + word, not hue. */}
        {freshness.state === 'stale' && (
          <span
            className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              backgroundColor: `${STATUS_WARNING}${OPACITY_15}`,
              color: STATUS_WARNING,
              border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
            }}
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            Stale
            <span className="sr-only"> — {freshnessNote}</span>
          </span>
        )}

        {/* Status pill — icon + color + label so status survives grayscale / colorblindness */}
        <span
          className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            backgroundColor: `${status.color}${OPACITY_15}`,
            color: status.color,
            border: `1px solid ${status.color}${OPACITY_30}`,
          }}
        >
          <StatusIcon className={`w-3 h-3 ${status.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
          {status.label}
        </span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border">
              {/* Description */}
              <div className="pt-3">
                <label className="text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold">
                  Scenario Description
                </label>
                <DebouncedTextarea
                  value={scenario.description}
                  onCommit={(v) => onUpdate({ description: v })}
                  placeholder="Describe the game situation in natural language..."
                  className="w-full px-3 py-2 bg-surface border border-border rounded text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none"
                  rows={2}
                />
              </div>

              {/* Stimuli */}
              <StimuliEditor
                scenario={scenario}
                isGenerating={isGenerating}
                onGenerateStimuli={onGenerateStimuli}
                onAdd={handleAddStimulus}
                onUpdate={handleUpdateStimulus}
                onRemove={handleRemoveStimulus}
              />

              {/* Expected Actions */}
              <ExpectedActionsEditor
                scenario={scenario}
                onAdd={handleAddExpected}
                onUpdate={handleUpdateExpected}
                onRemove={handleRemoveExpected}
              />

              {/* What the stored result is actually worth. Shown for every state
                  (not only stale) so "Passed" is never read as unqualified truth. */}
              <p
                className={`text-2xs leading-relaxed ${freshness.state === 'stale' ? '' : 'text-text-muted'}`}
                style={freshness.state === 'stale' ? { color: STATUS_WARNING } : undefined}
              >
                {freshnessNote}
                {freshness.ranAtMs !== null && (
                  <> Last run {formatTimeAgo(freshness.ranAtMs, { extended: true })}.</>
                )}
              </p>

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
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
