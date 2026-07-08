'use client';

import React, { useState, useCallback } from 'react';
import {
  Play, Trash2, CheckCircle2, Loader2, ChevronDown, ChevronRight,
  Clock, Crosshair, Eye, Layers,
} from 'lucide-react';
import {
  STATUS_ERROR, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { PofTestSpec } from '@/types/pof-bridge';

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario Card
// ═══════════════════════════════════════════════════════════════════════════════

interface ScenarioCardProps {
  scenario: PofTestSpec;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (s: PofTestSpec) => void;
  onRemove: () => void;
}

export function ScenarioCard({ scenario, index, isExpanded, onToggle, onUpdate, onRemove }: ScenarioCardProps) {
  const updateField = useCallback(
    <K extends keyof PofTestSpec>(field: K, value: PofTestSpec[K]) => {
      onUpdate({ ...scenario, [field]: value });
    },
    [scenario, onUpdate],
  );

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: `${STATUS_NEUTRAL}30` }}
    >
      {/* Scenario header */}
      <button
        className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <span className="text-xs font-mono text-text-muted">#{index + 1}</span>
        <span className="text-xs font-medium text-text flex-1 truncate">{scenario.description}</span>
        <span className="text-xs text-text-muted">
          {scenario.setup.length} spawn · {scenario.actions.length} action · {scenario.assertions.length} assert
        </span>
        <button
          className="p-0.5 rounded hover:bg-surface-3 shrink-0"
          style={{ color: STATUS_ERROR }}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </button>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: `${STATUS_NEUTRAL}20` }}>
          {/* Basic fields */}
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Test ID</span>
              <input
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs font-mono text-text outline-none"
                value={scenario.testId}
                onChange={(e) => updateField('testId', e.target.value)}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Timeout (s)</span>
              <input
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs font-mono text-text outline-none"
                type="number"
                value={scenario.timeout}
                onChange={(e) => updateField('timeout', Number(e.target.value))}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Cleanup</span>
              <select
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs text-text outline-none"
                value={scenario.cleanup}
                onChange={(e) => updateField('cleanup', e.target.value as 'destroyAll' | 'none')}
              >
                <option value="destroyAll">Destroy All</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>

          <label className="block space-y-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wider">Description</span>
            <input
              className="w-full bg-surface-2 rounded px-2 py-1 text-xs text-text outline-none"
              value={scenario.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </label>

          {/* Setup (spawns) */}
          <ScenarioSection
            label="Spawn Setup"
            icon={Layers}
            color={ACCENT_CYAN}
            count={scenario.setup.length}
          >
            {scenario.setup.map((spawn, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <Crosshair className="w-3 h-3 shrink-0" style={{ color: ACCENT_CYAN }} />
                <span className="font-mono text-text-muted truncate flex-1" title={spawn.spawn}>
                  {spawn.tag}
                </span>
                <span className="text-xs text-text-muted">
                  [{spawn.location.join(', ')}]
                </span>
              </div>
            ))}
          </ScenarioSection>

          {/* Actions */}
          <ScenarioSection
            label="Actions"
            icon={Play}
            color={ACCENT_ORANGE}
            count={scenario.actions.length}
          >
            {scenario.actions.map((action, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                {action.type === 'wait' ? (
                  <Clock className="w-3 h-3 shrink-0" style={{ color: ACCENT_ORANGE }} />
                ) : (
                  <Play className="w-3 h-3 shrink-0" style={{ color: ACCENT_ORANGE }} />
                )}
                <span className="text-text-muted">
                  {action.type === 'wait'
                    ? `Wait ${action.duration}s — ${action.reason || 'no reason'}`
                    : `Call ${action.target}.${action.function}()`}
                </span>
              </div>
            ))}
          </ScenarioSection>

          {/* Assertions */}
          <ScenarioSection
            label="Assertions"
            icon={CheckCircle2}
            color={ACCENT_EMERALD}
            count={scenario.assertions.length}
          >
            {scenario.assertions.map((a) => (
              <div key={a.id} className="flex items-center gap-1 text-xs">
                <Eye className="w-3 h-3 shrink-0" style={{ color: ACCENT_EMERALD }} />
                <span className="text-text-muted truncate">
                  {a.target}.{a.property} {a.operator} {JSON.stringify(a.expected)}
                </span>
              </div>
            ))}
          </ScenarioSection>
        </div>
      )}
    </div>
  );
}

// ── Scenario Section (collapsible sub-group) ─────────────────────────────────

function ScenarioSection({
  label, icon: Icon, color, count, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center gap-1.5 w-full text-left text-xs uppercase tracking-wider font-medium mb-1"
        style={{ color }}
        onClick={() => setOpen((p) => !p)}
      >
        <Icon className="w-3 h-3" style={{ color }} />
        {label} ({count})
        {open ? <ChevronDown className="w-2.5 h-2.5 ml-auto opacity-50" /> : <ChevronRight className="w-2.5 h-2.5 ml-auto opacity-50" />}
      </button>
      {open && <div className="space-y-1 pl-4">{children}</div>}
    </div>
  );
}
