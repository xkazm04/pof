'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronDown } from 'lucide-react';
import { BlueprintPanel, SectionHeader } from '../_design';
import { DECISION_LOG } from './data';
import type { DecisionEntry } from './data';
import { STATUS_WARNING } from '@/lib/chart-colors';

export function DecisionDebugger() {
  const [debugFilter, setDebugFilter] = useState<DecisionEntry['type'] | 'all'>('all');
  const [debugExpanded, setDebugExpanded] = useState<number | null>(null);

  const filteredDecisions = useMemo(() => {
    if (debugFilter === 'all') return DECISION_LOG;
    return DECISION_LOG.filter(d => d.type === debugFilter);
  }, [debugFilter]);

  return (
    <BlueprintPanel color={STATUS_WARNING} className="p-3">
      <SectionHeader icon={Bug} label="AI Decision Debugger" color={STATUS_WARNING} />
      <div className="mt-3 space-y-3">
        {/* Filter buttons */}
        <div className="flex gap-1.5 mb-2">
          {(['all', 'evaluation', 'selection', 'unexpected'] as const).map(f => (
            <button key={f} onClick={() => setDebugFilter(f)}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                debugFilter === f
                  ? f === 'unexpected' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-surface-hover text-text border border-border/50'
                  : 'text-text-muted hover:text-text bg-surface border border-border/30'
              }`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {/* Decision log */}
        <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1.5">
          {filteredDecisions.map(entry => {
            const isExpanded = debugExpanded === entry.tick;
            const isUnexpected = entry.type === 'unexpected';
            return (
              <motion.div key={entry.tick} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                className={`rounded border transition-colors ${isUnexpected ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/30 bg-surface-deep'}`}>
                <button onClick={() => setDebugExpanded(isExpanded ? null : entry.tick)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-hover/30 transition-colors focus:outline-none">
                  <span className={`text-xs font-mono font-bold flex-shrink-0 ${isUnexpected ? 'text-amber-400' : 'text-text-muted'}`}>
                    #{entry.tick}
                  </span>
                  <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
                    entry.type === 'evaluation' ? 'bg-blue-500/15 text-blue-400'
                      : entry.type === 'selection' ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {entry.type}
                  </span>
                  <span className="text-xs text-text truncate">{entry.summary}</span>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="ml-auto flex-shrink-0">
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-2 border-t border-border/20">
                        <p className="text-xs text-text-muted leading-relaxed mt-1.5 font-mono">{entry.details}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
