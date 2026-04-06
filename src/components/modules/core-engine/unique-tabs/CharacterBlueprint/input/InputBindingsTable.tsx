'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Keyboard, AlertTriangle, ShieldCheck, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR, STATUS_SUCCESS, OVERLAY_WHITE, ACCENT_ORANGE,
  OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_37,
  withOpacity, GLOW_SM,
} from '@/lib/chart-colors';
import { STATUS_COLORS } from '../../_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from '../design';
import type { FeatureRow } from '@/types/feature-matrix';
import { INPUT_BINDINGS, KEY_CONFLICTS as DEFAULT_CONFLICTS, KEY_FREQUENCY_MAP, heatColor } from '../data';

interface InputBindingsTableProps {
  featureMap: Map<string, FeatureRow>;
}

/** Build conflict map from current binding state */
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

/** Normalize event.key to a display label */
function normalizeKey(key: string): string {
  const map: Record<string, string> = { ' ': 'Space', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right' };
  return map[key.toLowerCase()] ?? key.toUpperCase();
}

export function InputBindingsTable({ featureMap }: InputBindingsTableProps) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);

  const conflicts = useMemo(
    () => Object.keys(overrides).length === 0
      ? DEFAULT_CONFLICTS
      : buildConflicts(INPUT_BINDINGS, overrides),
    [overrides],
  );

  const hasConflicts = conflicts.size > 0;
  const hasOverrides = Object.keys(overrides).length > 0;

  const getDisplayKey = useCallback(
    (action: string, defaultKey: string) => overrides[action] ?? defaultKey,
    [overrides],
  );

  /* ── Keydown listener for rebinding ──────────────────────────────────── */
  useEffect(() => {
    if (rebindingAction === null) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRebindingAction(null); return; }

      const newKey = normalizeKey(e.key);
      setOverrides(prev => {
        const next = { ...prev };
        // Find if another action already uses this key — swap them
        const currentKeyForAction = prev[rebindingAction]
          ?? INPUT_BINDINGS.find(b => b.action === rebindingAction)!.defaultKey;
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold
                       border border-border hover:bg-surface/60 text-text-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset All
          </button>
        )}
      </div>

      {/* ── Conflict / Clear Banner ──────────────────────────────────── */}
      {hasConflicts ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-2.5 p-3 rounded-lg border mb-4 relative overflow-hidden"
          style={{ borderColor: withOpacity(STATUS_ERROR, OPACITY_20), backgroundColor: withOpacity(STATUS_ERROR, OPACITY_5) }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
            style={{ background: `repeating-linear-gradient(180deg, ${STATUS_ERROR} 0px, ${STATUS_ERROR} 4px, transparent 4px, transparent 8px)` }} />
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 ml-1" style={{ color: STATUS_ERROR }} />
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
              {conflicts.size} Conflict{conflicts.size > 1 ? 's' : ''} Detected
            </div>
            <div className="text-xs text-text-muted mt-1 space-y-0.5 font-mono">
              {Array.from(conflicts.entries()).map(([key, actions]) => (
                <div key={key}>
                  <span className="font-bold" style={{ color: STATUS_ERROR }}>{key}</span>
                  <span className="text-text-muted"> → </span>{actions.join(', ')}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2.5 p-3 rounded-lg border mb-4"
          style={{ borderColor: withOpacity(STATUS_SUCCESS, OPACITY_15), backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_5) }}
        >
          <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
          <div>
            <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>No Conflicts</span>
            <span className="text-xs font-mono text-text-muted ml-2">
              {INPUT_BINDINGS.length} actions with unique bindings
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Bindings Table ────────────────────────────────────────── */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8) }}>
              {['Action', 'Key', 'Handler', 'Frequency', 'Status'].map(h => (
                <th key={h} className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INPUT_BINDINGS.map((binding, i) => {
              const displayKey = getDisplayKey(binding.action, binding.defaultKey);
              const isOverridden = overrides[binding.action] !== undefined;
              const isRebinding = rebindingAction === binding.action;
              const status = featureMap.get(binding.featureName)?.status ?? 'unknown';
              const sc = STATUS_COLORS[status];
              const freq = KEY_FREQUENCY_MAP.get(binding.defaultKey) ?? 0;
              const freqColor = heatColor(freq);
              const keys = displayKey === 'WASD' ? ['W', 'A', 'S', 'D'] : [displayKey];
              const rowConflict = keys.some(k => conflicts.has(k));

              return (
                <motion.tr
                  key={binding.action}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="border-b transition-colors hover:bg-surface/30"
                  style={{
                    borderColor: withOpacity(OVERLAY_WHITE, OPACITY_5),
                    backgroundColor: rowConflict ? withOpacity(STATUS_ERROR, OPACITY_5) : undefined,
                  }}
                >
                  <td className="py-2.5 pr-4 text-text font-bold">{binding.action}</td>
                  <td className="py-2.5 pr-4">
                    <button
                      data-testid={`rebind-action-${binding.action}`}
                      onClick={() => setRebindingAction(isRebinding ? null : binding.action)}
                      className="relative px-2 py-0.5 rounded text-xs font-bold border cursor-pointer
                                 transition-all hover:ring-1 hover:ring-white/20 focus:outline-none"
                      style={{
                        backgroundColor: isRebinding ? withOpacity(ACCENT_ORANGE, OPACITY_12) : withOpacity(freqColor, OPACITY_8),
                        color: isRebinding ? ACCENT_ORANGE : freqColor,
                        borderColor: isRebinding ? withOpacity(ACCENT_ORANGE, OPACITY_37) : withOpacity(freqColor, OPACITY_20),
                      }}
                    >
                      {isRebinding ? (
                        <motion.span
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        >
                          Press a key...
                        </motion.span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {isOverridden && (
                            <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                              style={{ backgroundColor: ACCENT_ORANGE, boxShadow: `${GLOW_SM} ${ACCENT_ORANGE}` }} />
                          )}
                          {displayKey}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{binding.handler}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16"><NeonBar pct={freq} color={freqColor} height={4} /></div>
                      <span className="text-xs text-text-muted tabular-nums w-6 text-right">{freq}%</span>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-1.5">
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: sc.dot, boxShadow: `${GLOW_SM} ${sc.dot}` }}
                        animate={status === 'implemented' ? { opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-xs uppercase font-bold tracking-wider" style={{ color: sc.dot }}>{sc.label}</span>
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlueprintPanel>
  );
}
