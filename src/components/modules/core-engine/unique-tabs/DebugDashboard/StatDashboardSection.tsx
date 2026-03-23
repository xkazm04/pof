'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, ChevronRight } from 'lucide-react';
import { BlueprintPanel, SectionHeader } from '../_design';
import { Sparkline } from './CircularGauge';
import { ACCENT } from './data';
import { STAT_GROUPS } from './data-perf';

export function StatDashboardSection() {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <SectionHeader label="STAT_COMMAND_DASHBOARD" color={ACCENT} icon={LayoutGrid} />
      <div className="space-y-3">
        {STAT_GROUPS.map((sg) => {
          const isCollapsed = collapsedGroups.has(sg.group);
          return (
            <BlueprintPanel key={sg.group} color={ACCENT} className="overflow-hidden">
              <button onClick={() => toggleGroup(sg.group)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-deep/50 transition-colors">
                <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                  <ChevronRight className="w-3 h-3" style={{ color: `${ACCENT}60` }} />
                </motion.div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>{sg.group}</span>
                <span className="ml-auto text-[10px] font-mono text-text-muted">{sg.stats.length} stats</span>
              </button>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-3 pb-2 space-y-1 border-t border-border">
                      {sg.stats.map((stat) => (
                        <div key={stat.label} className="flex items-center gap-3 py-1 hover:bg-surface-deep/30 transition-colors rounded px-1">
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em] w-24 text-text-muted">{stat.label}</span>
                          <Sparkline data={stat.sparkline} color={ACCENT} width={60} height={14} />
                          <span className="text-[10px] font-mono font-bold ml-auto" style={{ color: `${ACCENT}dd` }}>
                            {stat.value}<span className="text-text-muted text-[10px] ml-0.5">{stat.unit ?? ''}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BlueprintPanel>
          );
        })}
      </div>
    </motion.div>
  );
}
