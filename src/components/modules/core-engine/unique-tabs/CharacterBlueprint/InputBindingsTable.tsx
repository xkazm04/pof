'use client';

import { Keyboard, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, STATUS_SUCCESS, OVERLAY_WHITE } from '@/lib/chart-colors';
import { STATUS_COLORS } from '../_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from './design';
import type { FeatureRow } from '@/types/feature-matrix';
import { INPUT_BINDINGS, KEY_CONFLICTS, KEY_FREQUENCY_MAP, heatColor } from './data';

interface InputBindingsTableProps {
  featureMap: Map<string, FeatureRow>;
}

export function InputBindingsTable({ featureMap }: InputBindingsTableProps) {
  const hasConflicts = KEY_CONFLICTS.size > 0;

  return (
    <BlueprintPanel className="p-4" color={hasConflicts ? STATUS_ERROR : STATUS_SUCCESS}>
      <SectionHeader icon={Keyboard} label="Input Bindings" color={hasConflicts ? STATUS_ERROR : STATUS_SUCCESS} />

      {/* ── Conflict / Clear Banner ────────────────────────────────────── */}
      {hasConflicts ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-2.5 p-3 rounded-lg border mb-4 relative overflow-hidden"
          style={{ borderColor: `${STATUS_ERROR}30`, backgroundColor: `${STATUS_ERROR}08` }}
        >
          {/* Warning stripe accent */}
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
            style={{ background: `repeating-linear-gradient(180deg, ${STATUS_ERROR} 0px, ${STATUS_ERROR} 4px, transparent 4px, transparent 8px)` }} />
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 ml-1" style={{ color: STATUS_ERROR }} />
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
              {KEY_CONFLICTS.size} Conflict{KEY_CONFLICTS.size > 1 ? 's' : ''} Detected
            </div>
            <div className="text-xs text-text-muted mt-1 space-y-0.5 font-mono">
              {Array.from(KEY_CONFLICTS.entries()).map(([key, actions]) => (
                <div key={key}>
                  <span className="font-bold" style={{ color: STATUS_ERROR }}>{key}</span>
                  <span className="text-text-muted"> → </span>
                  {actions.join(', ')}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2.5 p-3 rounded-lg border mb-4"
          style={{ borderColor: `${STATUS_SUCCESS}25`, backgroundColor: `${STATUS_SUCCESS}06` }}
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

      {/* ── Bindings Table ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: `${OVERLAY_WHITE}10` }}>
              {['Action', 'Key', 'Handler', 'Frequency', 'Status'].map(h => (
                <th key={h} className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INPUT_BINDINGS.map((binding, i) => {
              const status = featureMap.get(binding.featureName)?.status ?? 'unknown';
              const sc = STATUS_COLORS[status];
              const freq = KEY_FREQUENCY_MAP.get(binding.defaultKey) ?? 0;
              const freqColor = heatColor(freq);
              const keys = binding.defaultKey === 'WASD' ? ['W', 'A', 'S', 'D'] : [binding.defaultKey];
              const rowConflict = keys.some(k => KEY_CONFLICTS.has(k));

              return (
                <motion.tr
                  key={binding.action}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="border-b transition-colors hover:bg-surface/30"
                  style={{
                    borderColor: `${OVERLAY_WHITE}05`,
                    backgroundColor: rowConflict ? `${STATUS_ERROR}06` : undefined,
                  }}
                >
                  <td className="py-2.5 pr-4 text-text font-bold">{binding.action}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded text-xs font-bold border"
                      style={{
                        backgroundColor: `${freqColor}10`,
                        color: freqColor,
                        borderColor: `${freqColor}30`,
                      }}>
                      {binding.defaultKey}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{binding.handler}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <NeonBar pct={freq} color={freqColor} height={4} />
                      </div>
                      <span className="text-xs text-text-muted tabular-nums w-6 text-right">{freq}%</span>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-1.5">
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: sc.dot, boxShadow: `0 0 4px ${sc.dot}` }}
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
