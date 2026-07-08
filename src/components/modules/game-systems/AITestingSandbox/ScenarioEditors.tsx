'use client';

import { Plus, Trash2, Play, Sparkles } from 'lucide-react';
import type {
  TestScenario,
  MockStimulus,
  ExpectedAction,
  StimulusType,
} from '@/types/ai-testing';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { STIMULUS_META, SYSTEMS_ACCENT } from './constants';
import { DebouncedInput } from './DebouncedFields';

// ── Mock Stimuli editor ──

export function StimuliEditor({
  scenario,
  isGenerating,
  onGenerateStimuli,
  onAdd,
  onUpdate,
  onRemove,
}: {
  scenario: TestScenario;
  isGenerating: boolean;
  onGenerateStimuli: () => void;
  onAdd: () => void;
  onUpdate: (idx: number, updates: Partial<MockStimulus>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
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
            onClick={onAdd}
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
                    onChange={(e) => onUpdate(idx, { type: e.target.value as StimulusType })}
                    className="bg-surface-deep border border-border rounded text-xs text-text px-1.5 py-0.5 outline-none"
                  >
                    {Object.entries(STIMULUS_META).map(([key, m]) => (
                      <option key={key} value={key}>{m.label}</option>
                    ))}
                  </select>
                  <DebouncedInput
                    value={stim.label}
                    onCommit={(v) => onUpdate(idx, { label: v })}
                    placeholder="Label"
                    className="flex-1 bg-transparent text-xs text-text placeholder-text-muted outline-none min-w-0"
                  />
                </div>
                <DebouncedInput
                  value={stim.description}
                  onCommit={(v) => onUpdate(idx, { description: v })}
                  placeholder="What happens in the game world..."
                  className="w-full bg-transparent text-xs text-text-muted-hover placeholder-text-muted outline-none"
                />
              </div>
              <button
                onClick={() => onRemove(idx)}
                className="text-text-muted hover:text-red-400 transition-colors mt-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Expected Actions editor ──

export function ExpectedActionsEditor({
  scenario,
  onAdd,
  onUpdate,
  onRemove,
}: {
  scenario: TestScenario;
  onAdd: () => void;
  onUpdate: (idx: number, updates: Partial<ExpectedAction>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
          Expected Actions
        </label>
        <button
          onClick={onAdd}
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
            <Play className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
            <div className="flex-1 min-w-0 space-y-1">
              <DebouncedInput
                value={ea.action}
                onCommit={(v) => onUpdate(idx, { action: v })}
                placeholder="Expected action (e.g. 'Enter Chase state')"
                className="w-full bg-transparent text-xs text-text placeholder-text-muted outline-none"
              />
              <div className="flex items-center gap-2">
                <DebouncedInput
                  value={ea.btNode}
                  onCommit={(v) => onUpdate(idx, { btNode: v })}
                  placeholder="BT node (optional)"
                  className="flex-1 bg-transparent text-xs text-text-muted-hover placeholder-text-muted outline-none min-w-0"
                />
                <span className="text-2xs text-text-muted">timeout:</span>
                <input
                  type="number"
                  value={ea.timeoutSeconds}
                  onChange={(e) => onUpdate(idx, { timeoutSeconds: Number(e.target.value) || 5 })}
                  className="w-10 bg-surface-deep border border-border rounded text-xs text-text px-1.5 py-0.5 outline-none text-center"
                  min={1}
                  max={60}
                />
                <span className="text-2xs text-text-muted">s</span>
              </div>
            </div>
            <button
              onClick={() => onRemove(idx)}
              className="text-text-muted hover:text-red-400 transition-colors mt-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
