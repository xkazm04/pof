'use client';

import { motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { formatDurationBetween } from '@/lib/format';
import type { ModuleProgress } from '@/types/batch-review';
import { STATUS_ICON, STATUS_COLOR } from './constants';

export function ModuleRow({ mod }: { mod: ModuleProgress }) {
  const Icon = STATUS_ICON[mod.status];
  const color = STATUS_COLOR[mod.status];
  const isModRunning = mod.status === 'running';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: MOTION.base } },
      }}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors"
      style={{
        backgroundColor: isModRunning ? `${MODULE_COLORS.core}08` : 'transparent',
        border: isModRunning ? `1px solid ${MODULE_COLORS.core}20` : '1px solid transparent',
      }}
    >
      <Icon
        className={`w-3.5 h-3.5 flex-shrink-0 ${isModRunning ? 'animate-spin' : ''}`}
        style={{ color }}
      />
      <span className="text-xs text-text flex-1 min-w-0 truncate">
        {mod.label}
      </span>
      <span className="text-2xs text-text-muted flex-shrink-0">
        {mod.featureCount} features
      </span>
      {mod.startedAt && mod.completedAt && (
        <span className="text-2xs text-text-muted flex-shrink-0 tabular-nums">
          {formatDurationBetween(mod.startedAt, mod.completedAt)}
        </span>
      )}
      {mod.error && (
        <span className="text-2xs text-[#f87171] flex-shrink-0 truncate max-w-[120px]" title={mod.error}>
          {mod.error}
        </span>
      )}
      <span
        className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
        style={{ color, backgroundColor: color + '15', border: `1px solid ${color}25` }}
      >
        {mod.status}
      </span>
    </motion.div>
  );
}
