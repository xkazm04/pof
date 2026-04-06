'use client';

import { useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN, ACCENT_CYAN_LIGHT,
  withOpacity, OPACITY_20, OPACITY_30, OPACITY_50, OPACITY_5, OPACITY_15,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../design';
import { ACCENT, SCHEMA_VERSION_HISTORY } from '../data';

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
                  ? ''
                  : 'border-border/20 bg-surface-deep hover:border-border/40'
              }`}
              style={entry.isCurrent ? {
                borderColor: withOpacity(ACCENT_CYAN, OPACITY_50),
                backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_5),
                boxShadow: `0 0 12px ${withOpacity(ACCENT_CYAN, OPACITY_15)}`,
              } : undefined}
            >
              <div className="px-3 py-2.5 flex items-center gap-3">
                <ChevronRight
                  className={`w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0 ${expandedVersion === entry.version ? 'rotate-90' : ''}`}
                />
                <span className={`font-bold ${entry.isCurrent ? '' : 'text-text-muted'}`} style={entry.isCurrent ? { color: ACCENT_CYAN_LIGHT } : undefined}>{entry.version}</span>
                <span className="text-text-muted text-xs">{entry.date}</span>
                <span className="text-text-muted text-xs">by {entry.author}</span>
                {entry.isCurrent && (
                  <span className="px-1.5 py-0.5 text-xs font-bold rounded-sm" style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_20), color: ACCENT_CYAN, borderWidth: 1, borderStyle: 'solid', borderColor: withOpacity(ACCENT_CYAN, OPACITY_30) }}>CURRENT</span>
                )}
                {entry.breaking && (
                  <span className="px-1.5 py-0.5 text-xs font-bold rounded-sm" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_20), color: STATUS_WARNING, borderWidth: 1, borderStyle: 'solid', borderColor: withOpacity(STATUS_WARNING, OPACITY_30) }}>BREAKING</span>
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
                        <div key={ci} className="flex items-start gap-2 py-0.5 font-mono text-xs">
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
