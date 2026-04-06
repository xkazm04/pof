'use client';

import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN, ACCENT_CYAN_LIGHT, OPACITY_8,
  withOpacity, OPACITY_10, OPACITY_5, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../design';
import { ACCENT } from '../data';
import { MIGRATION_PATH, COMPAT_VERSIONS, COMPAT_LOOKUP } from '../data-panels';

export function MigrationPathGraph() {
  const [expandedMigration, setExpandedMigration] = useState<string | null>('V2.0');

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10">
        <SectionHeader label="MIGRATION_PATH_GRAPH" icon={GitBranch} color={ACCENT} />
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {/* Version node graph */}
        <div className="flex items-center gap-2 flex-wrap">
          {MIGRATION_PATH.map((node, i, arr) => (
            <div key={node.version} className="flex items-center gap-2">
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.12 }}
                onClick={() => setExpandedMigration(expandedMigration === node.version ? null : node.version)}
                className={`flex flex-col items-center px-4 py-2.5 border rounded-lg font-mono text-xs transition-all cursor-pointer ${
                  expandedMigration === node.version ? '' : 'border-border/20 hover:border-border/40'
                }`}
                style={{
                  backgroundColor: expandedMigration === node.version ? withOpacity(ACCENT, OPACITY_10) : withOpacity(ACCENT, OPACITY_5),
                  ...(expandedMigration === node.version ? { borderColor: ACCENT_CYAN, boxShadow: `0 0 12px ${withOpacity(ACCENT_CYAN, OPACITY_20)}` } : {}),
                }}
              >
                <span className="font-bold" style={{ color: node.breaking ? STATUS_WARNING : ACCENT_CYAN_LIGHT }}>{node.version}</span>
                <span className="text-xs text-text-muted mt-0.5">{node.date}</span>
                {node.breaking && (
                  <span className="text-xs mt-1 px-1 py-0.5 rounded" style={{ color: STATUS_WARNING, backgroundColor: withOpacity(STATUS_WARNING, OPACITY_5), borderWidth: 1, borderStyle: 'solid', borderColor: withOpacity(STATUS_WARNING, OPACITY_30) }}>BREAKING</span>
                )}
              </motion.button>
              {i < arr.length - 1 && (
                <div className="flex items-center gap-0.5">
                  <div className="w-4 h-px bg-border/20" />
                  <span className="text-text-muted text-xs">&gt;</span>
                  <div className="w-4 h-px bg-border/20" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Expanded migration details */}
        <AnimatePresence>
          {expandedMigration && (() => {
            const node = MIGRATION_PATH.find(n => n.version === expandedMigration);
            if (!node) return null;
            return (
              <motion.div key={node.version} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border border-border/10 rounded-lg p-3 font-mono text-xs space-y-3" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
                  <div className="text-xs font-mono uppercase tracking-[0.15em] border-b border-border/10 pb-1" style={{ color: ACCENT }}>
                    {node.version} Migration Details
                  </div>
                  {node.fieldsAdded.length > 0 && (
                    <div className="space-y-0.5">
                      {node.fieldsAdded.map(f => (
                        <div key={f} className="flex items-center gap-2" style={{ color: STATUS_SUCCESS }}><span className="text-xs">+</span> {f}</div>
                      ))}
                    </div>
                  )}
                  {node.fieldsRemoved.length > 0 && (
                    <div className="space-y-0.5">
                      {node.fieldsRemoved.map(f => (
                        <div key={f} className="flex items-center gap-2 line-through opacity-70" style={{ color: STATUS_ERROR }}><span className="text-xs">-</span> {f}</div>
                      ))}
                    </div>
                  )}
                  {node.fieldsModified.length > 0 && (
                    <div className="space-y-0.5">
                      {node.fieldsModified.map(f => (
                        <div key={f} className="flex items-center gap-2" style={{ color: STATUS_WARNING }}><span className="text-xs">~</span> {f}</div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Compatibility matrix */}
        <div className="space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT }}>Compatibility Matrix</span>
          <div className="overflow-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-surface-deep px-3 py-2 text-xs text-text-muted text-left border border-border/10 whitespace-nowrap">
                    FROM / TO
                  </th>
                  {COMPAT_VERSIONS.map(v => (
                    <th key={v} className="sticky top-0 z-10 bg-surface-deep px-3 py-2 text-center border border-border/10 whitespace-nowrap" style={{ color: ACCENT_CYAN }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPAT_VERSIONS.map(from => (
                  <tr key={from}>
                    <td className="sticky left-0 z-10 bg-surface-deep px-3 py-2 font-bold border border-border/10 whitespace-nowrap" style={{ color: ACCENT_CYAN }}>{from}</td>
                    {COMPAT_VERSIONS.map(to => {
                      if (from === to) {
                        return <td key={to} className="px-3 py-2 text-center border border-border/10 text-text-muted" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>--</td>;
                      }
                      const compat = COMPAT_LOOKUP.get(`${from}->${to}`);
                      const color = compat === 'full' ? STATUS_SUCCESS : compat === 'partial' ? STATUS_WARNING : compat === 'none' ? STATUS_ERROR : undefined;
                      const bg = compat === 'full' ? `${STATUS_SUCCESS}${OPACITY_8}` : compat === 'partial' ? `${STATUS_WARNING}${OPACITY_8}` : compat === 'none' ? `${STATUS_ERROR}${OPACITY_8}` : undefined;
                      return (
                        <td key={to} className="px-3 py-2 text-center border border-border/10 font-bold" style={color ? { backgroundColor: bg, color } : { color: 'var(--text-muted)' }}>
                          {compat ? compat.toUpperCase() : '--'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
