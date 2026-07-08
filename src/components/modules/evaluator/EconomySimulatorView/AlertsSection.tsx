'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { InflationAlert } from '@/types/economy-simulator';
import { MOTION } from '@/lib/constants';
import { SEVERITY_STYLE, ALERT_TYPE_LABELS } from './constants';

// ── Alerts Section ──────────────────────────────────────────────────────────

export function AlertsSection({ alerts }: { alerts: InflationAlert[] }) {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) {
    return (
      <SurfaceCard className="p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-text">Economy Health</span>
          <Badge variant="success">No Issues Detected</Badge>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-text">Inflation Alerts</span>
        <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'error' : 'warning'}>
          {alerts.length} issues
        </Badge>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-2">
              {alerts.map((alert, i) => {
                const style = SEVERITY_STYLE[alert.severity];
                const Icon = style.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${style.text} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${style.text}`}>
                          {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                        </span>
                        <span className="text-2xs text-text-muted">Lvl {alert.level} · Hour {alert.hour}</span>
                      </div>
                      <p className="text-2xs text-text-muted/80 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
