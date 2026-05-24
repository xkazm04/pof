'use client';

import { motion } from 'framer-motion';
import {
  STATUS_ERROR, OVERLAY_WHITE, ACCENT_ORANGE,
  OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_37,
  withOpacity, GLOW_SM,
} from '@/lib/chart-colors';
import { STATUS_COLORS } from '../../unique-tabs/_shared';
import { NeonBar } from '../_shared/design';
import {
  type INPUT_BINDINGS, KEY_FREQUENCY_MAP, heatColor,
} from '../_shared/data';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

type Binding = (typeof INPUT_BINDINGS)[number];

interface Props {
  binding: Binding;
  index: number;
  isOverridden: boolean;
  isRebinding: boolean;
  displayKey: string;
  conflicts: Map<string, string[]>;
  status: FeatureStatus;
  onStartRebind: (action: string) => void;
}

/** One row in the InputBindingsTable: action / key (rebindable) / handler / frequency / status. */
export function InputBindingsRow({
  binding, index, isOverridden, isRebinding, displayKey, conflicts, status, onStartRebind,
}: Props) {
  const sc = STATUS_COLORS[status];
  const freq = KEY_FREQUENCY_MAP.get(binding.defaultKey) ?? 0;
  const freqColor = heatColor(freq);
  const keys = displayKey === 'WASD' ? ['W', 'A', 'S', 'D'] : [displayKey];
  const rowConflict = keys.some((k) => conflicts.has(k));

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
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
          onClick={() => onStartRebind(binding.action)}
          className="relative px-2 py-0.5 rounded text-xs font-bold border cursor-pointer transition-all hover:ring-1 hover:ring-white/20 focus:outline-none"
          style={{
            backgroundColor: isRebinding ? withOpacity(ACCENT_ORANGE, OPACITY_12) : withOpacity(freqColor, OPACITY_8),
            color: isRebinding ? ACCENT_ORANGE : freqColor,
            borderColor: isRebinding ? withOpacity(ACCENT_ORANGE, OPACITY_37) : withOpacity(freqColor, OPACITY_20),
          }}
        >
          {isRebinding ? (
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              Press a key...
            </motion.span>
          ) : (
            <span className="flex items-center gap-1.5">
              {isOverridden && (
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: ACCENT_ORANGE, boxShadow: `${GLOW_SM} ${ACCENT_ORANGE}` }}
                />
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
}
