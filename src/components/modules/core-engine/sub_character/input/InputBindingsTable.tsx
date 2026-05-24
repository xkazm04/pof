'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_SUCCESS, OVERLAY_WHITE, OPACITY_8, withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import type { FeatureRow } from '@/types/feature-matrix';
import { INPUT_BINDINGS, KEY_CONFLICTS as DEFAULT_CONFLICTS } from '../_shared/data';
import { InputBindingsBanner } from './InputBindingsBanner';
import { InputBindingsRow } from './InputBindingsRow';

interface InputBindingsTableProps {
  featureMap: Map<string, FeatureRow>;
}

/** Build conflict map from current binding state. */
function buildConflicts(bindings: typeof INPUT_BINDINGS, overrides: Record<string, string>) {
  const keyToActions = new Map<string, string[]>();
  for (const b of bindings) {
    const dk = overrides[b.action] ?? b.defaultKey;
    const keys = dk === 'WASD' ? ['W', 'A', 'S', 'D'] : [dk];
    for (const k of keys) {
      const existing = keyToActions.get(k) ?? [];
      existing.push(b.action);
      keyToActions.set(k, existing);
    }
  }
  const conflicts = new Map<string, string[]>();
  for (const [key, actions] of keyToActions) {
    if (actions.length > 1) conflicts.set(key, actions);
  }
  return conflicts;
}

/** Normalize event.key to a display label. */
function normalizeKey(key: string): string {
  const map: Record<string, string> = {
    ' ': 'Space', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right',
  };
  return map[key.toLowerCase()] ?? key.toUpperCase();
}

export function InputBindingsTable({ featureMap }: InputBindingsTableProps) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);

  const conflicts = useMemo(
    () => (Object.keys(overrides).length === 0
      ? DEFAULT_CONFLICTS
      : buildConflicts(INPUT_BINDINGS, overrides)),
    [overrides],
  );

  const hasConflicts = conflicts.size > 0;
  const hasOverrides = Object.keys(overrides).length > 0;

  const getDisplayKey = useCallback(
    (action: string, defaultKey: string) => overrides[action] ?? defaultKey,
    [overrides],
  );

  const handleStartRebind = useCallback((action: string) => {
    setRebindingAction((cur) => (cur === action ? null : action));
  }, []);

  /* ── Keydown listener for rebinding ──────────────────────────────────── */
  useEffect(() => {
    if (rebindingAction === null) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRebindingAction(null); return; }

      const newKey = normalizeKey(e.key);
      setOverrides((prev) => {
        const next = { ...prev };
        const currentKeyForAction = prev[rebindingAction]
          ?? INPUT_BINDINGS.find((b) => b.action === rebindingAction)!.defaultKey;
        for (const b of INPUT_BINDINGS) {
          const bKey = prev[b.action] ?? b.defaultKey;
          if (b.action !== rebindingAction && bKey === newKey) {
            next[b.action] = currentKeyForAction; // swap
            break;
          }
        }
        next[rebindingAction] = newKey;
        return next;
      });
      setRebindingAction(null);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [rebindingAction]);

  return (
    <BlueprintPanel className="p-4" color={hasConflicts ? STATUS_ERROR : STATUS_SUCCESS}>
      <div className="flex items-center justify-between mb-0">
        <SectionHeader icon={Keyboard} label="Input Bindings" color={hasConflicts ? STATUS_ERROR : STATUS_SUCCESS} />
        {hasOverrides && (
          <button
            onClick={() => { setOverrides({}); setRebindingAction(null); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-border hover:bg-surface/60 text-text-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset All
          </button>
        )}
      </div>

      <InputBindingsBanner conflicts={conflicts} totalBindings={INPUT_BINDINGS.length} />

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8) }}>
              {['Action', 'Key', 'Handler', 'Frequency', 'Status'].map((h) => (
                <th key={h} className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INPUT_BINDINGS.map((binding, i) => (
              <InputBindingsRow
                key={binding.action}
                binding={binding}
                index={i}
                isOverridden={overrides[binding.action] !== undefined}
                isRebinding={rebindingAction === binding.action}
                displayKey={getDisplayKey(binding.action, binding.defaultKey)}
                conflicts={conflicts}
                status={featureMap.get(binding.featureName)?.status ?? 'unknown'}
                onStartRebind={handleStartRebind}
              />
            ))}
          </tbody>
        </table>
      </div>
    </BlueprintPanel>
  );
}
