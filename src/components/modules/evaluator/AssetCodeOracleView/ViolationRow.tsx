'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { ConsistencyViolation } from '@/lib/asset-code-oracle';
import { SEVERITY_CONFIG, TYPE_LABELS } from './constants';

export function FilterChip({
  label, count, active, onClick, color,
}: {
  label: string; count: number; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors border ${
        active
          ? 'bg-surface-hover text-text border-border-bright'
          : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
      }`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

export function ViolationRow({
  violation: v,
  expanded,
  onToggle,
}: {
  violation: ConsistencyViolation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = SEVERITY_CONFIG[v.severity];
  const SevIcon = config.icon;

  return (
    <div className="rounded-lg border border-border bg-surface-deep overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <SevIcon className="w-3 h-3 flex-shrink-0" style={{ color: config.color }} />
        <span className="text-text font-medium flex-1 truncate">{v.title}</span>
        <Badge variant={config.variant}>{TYPE_LABELS[v.type]}</Badge>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
              <p className="text-2xs text-text-muted leading-relaxed">{v.description}</p>
              {v.expected && (
                <div className="flex items-center gap-1.5 text-2xs">
                  <span className="text-text-muted">Expected:</span>
                  <code className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted-hover font-mono">
                    {v.expected}
                  </code>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="text-text-muted">Fix:</span>
                <span className="text-text-muted-hover">{v.suggestion}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
