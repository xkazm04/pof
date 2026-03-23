'use client';

import { useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT, SCHEMA_VERSION_HISTORY } from './data';

export function VersionHistory() {
  const [expandedVersion, setExpandedVersion] = useState<string | null>('v2.0.0');

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10">
        <SectionHeader label="SCHEMA_VERSION_HISTORY" icon={History} color={ACCENT} />
      </div>
      <div className="flex items-center justify-between px-4 pb-1">
        <span className="text-xs font-mono text-text-muted">{SCHEMA_VERSION_HISTORY.length} versions</span>
      </div>

      <div className="p-4 space-y-3">
        {SCHEMA_VERSION_HISTORY.map((entry, i) => (
          <motion.div
            key={entry.version}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <button
              onClick={() => setExpandedVersion(expandedVersion === entry.version ? null : entry.version)}
              className={`w-full text-left border rounded-sm font-mono text-xs transition-all ${
                entry.isCurrent
                  ? 'border-cyan-500/50 bg-cyan-950/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'border-border/20 bg-surface-deep hover:border-border/40'
              }`}
            >
              <div className="px-3 py-2.5 flex items-center gap-3">
                <ChevronRight
                  className={`w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0 ${expandedVersion === entry.version ? 'rotate-90' : ''}`}
                />
                <span className={`font-bold ${entry.isCurrent ? 'text-cyan-300' : 'text-text-muted'}`}>{entry.version}</span>
                <span className="text-text-muted text-xs">{entry.date}</span>
                <span className="text-text-muted text-xs">by {entry.author}</span>
                {entry.isCurrent && (
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[11px] font-bold border border-cyan-500/30 rounded-sm">CURRENT</span>
                )}
                {entry.breaking && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[11px] font-bold border border-amber-500/30 rounded-sm">BREAKING</span>
                )}
                <span className="ml-auto text-xs text-text-muted">{entry.changes.length} changes</span>
              </div>
            </button>

            <AnimatePresence>
              {expandedVersion === entry.version && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 py-2 border-x border-b border-border/20 bg-surface-deep space-y-1 rounded-b-sm">
                    {entry.changes.map((change, ci) => {
                      const changeColor = change.type === 'added' ? STATUS_SUCCESS : change.type === 'removed' ? STATUS_ERROR : STATUS_WARNING;
                      const prefix = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
                      return (
                        <div key={ci} className="flex items-start gap-2 py-0.5 font-mono text-[11px]">
                          <span className="flex-shrink-0 font-bold w-3 text-center" style={{ color: changeColor }}>{prefix}</span>
                          <span className="text-text font-bold flex-shrink-0">{change.field}</span>
                          <span className="text-text-muted truncate">{change.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
