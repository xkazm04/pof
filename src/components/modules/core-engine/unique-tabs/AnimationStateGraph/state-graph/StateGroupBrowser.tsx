'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, X, ArrowRightLeft } from 'lucide-react';
import { STATUS_WARNING, withOpacity, OPACITY_8, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, STATE_GROUPS, STATE_NODES, TRANSITION_RULES, type TransitionRule } from '../data';

export function StateGroupBrowser() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (group: string) =>
    setCollapsed(p => ({ ...p, [group]: !p[group] }));

  const { incoming, outgoing } = useMemo(() => {
    if (!selectedState) return { incoming: [] as TransitionRule[], outgoing: [] as TransitionRule[] };
    return {
      incoming: TRANSITION_RULES.filter(r => r.to === selectedState),
      outgoing: TRANSITION_RULES.filter(r => r.from === selectedState),
    };
  }, [selectedState]);

  const totalTransitions = incoming.length + outgoing.length;

  const stateRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of STATE_NODES) map.set(n.name, n.ref);
    return map;
  }, []);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="State Browser" icon={ArrowRightLeft} color={ACCENT} />

      {/* Top bar */}
      {selectedState && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md text-xs font-mono"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), borderLeft: `2px solid ${ACCENT}` }}>
          <span className="font-bold" style={{ color: ACCENT }}>{selectedState}</span>
          <span className="text-text-muted">{stateRef.get(selectedState)}</span>
          <span className="ml-auto text-text-muted">{totalTransitions} transition{totalTransitions !== 1 ? 's' : ''}</span>
          <button onClick={() => setSelectedState(null)}
            className="p-0.5 rounded hover:bg-surface-hover transition-colors cursor-pointer">
            <X className="w-3 h-3 text-text-muted" />
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Left panel - Grouped state list */}
        <div className="w-[220px] flex-shrink-0 space-y-2">
          {STATE_GROUPS.map(({ group, states }) => (
            <div key={group}>
              <button onClick={() => toggle(group)}
                className="w-full flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors cursor-pointer">
                <ChevronDown className="w-3 h-3 transition-transform" style={{
                  transform: collapsed[group] ? 'rotate(-90deg)' : undefined,
                }} />
                {group}
                <span className="ml-auto text-text-muted/50">{states.length}</span>
              </button>
              {!collapsed[group] && (
                <div className="flex flex-wrap gap-1 mt-1 ml-4">
                  {states.map(s => {
                    const active = selectedState === s;
                    return (
                      <button key={s} onClick={() => setSelectedState(active ? null : s)}
                        className="px-2 py-0.5 rounded text-xs font-mono border transition-all cursor-pointer"
                        style={active
                          ? { backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                        }>
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right panel - Transition detail */}
        <div className="flex-1 min-w-0">
          {!selectedState ? (
            <div className="flex items-center justify-center h-full text-xs font-mono text-text-muted/50 py-8">
              Select a state to inspect transitions
            </div>
          ) : (
            <div className="space-y-3">
              <TransitionList label="Incoming" rules={incoming} field="from" accent={ACCENT} onSelect={setSelectedState} />
              <TransitionList label="Outgoing" rules={outgoing} field="to" accent={ACCENT} onSelect={setSelectedState} />
            </div>
          )}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Transition sub-list ──────────────────────────────────────────────────── */

function TransitionList({ label, rules, field, accent, onSelect }: {
  label: string;
  rules: TransitionRule[];
  field: 'from' | 'to';
  accent: string;
  onSelect: (s: string) => void;
}) {
  if (rules.length === 0) {
    return (
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{label} (0)</div>
        <div className="text-xs text-text-muted/50 italic">None</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{label} ({rules.length})</div>
      <div className="space-y-1">
        {rules.map((r, i) => (
          <button key={i} onClick={() => onSelect(r[field])}
            className="w-full flex items-center gap-2 text-xs font-mono px-2 py-1 rounded hover:bg-surface-hover/50 transition-colors text-left cursor-pointer">
            <span className="font-medium text-text min-w-[80px]">{r[field]}</span>
            <span className="text-text-muted truncate flex-1">{r.condition}</span>
            {r.gateBool && (
              <span className="px-1 rounded text-[10px]"
                style={{ backgroundColor: withOpacity(accent, OPACITY_8), color: accent }}>{r.gateBool}</span>
            )}
            {r.useCancelWindow && (
              <span className="px-1 rounded text-[10px]"
                style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8), color: STATUS_WARNING }}>cancel</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
