'use client';

import { useState, useMemo, useCallback } from 'react';
import { Crown, ChevronDown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, ITEM_SETS } from '../_shared/data';
import { STATUS_SUBDUED, STATUS_ERROR, STATUS_SUCCESS,
  withOpacity, OPACITY_5, OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_30, OPACITY_37,
} from '@/lib/chart-colors';

/* ── Set Bonus Section ─────────────────────────────────────────────────── */

export function SetBonusSection() {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(() => new Set(ITEM_SETS.map(s => s.name)));
  const [setFilter, setSetFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  const toggleSet = useCallback((name: string) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const filteredSets = useMemo(() => {
    if (setFilter === 'all') return ITEM_SETS;
    return ITEM_SETS.filter(set => {
      const complete = set.pieces.every(p => p.owned);
      return setFilter === 'complete' ? complete : !complete;
    });
  }, [setFilter]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Crown} label="Set Bonus System Preview" color={ACCENT} />
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {(['all', 'complete', 'incomplete'] as const).map(f => (
            <button key={f} onClick={() => setSetFilter(f)}
              className="text-xs font-mono px-2 py-1 rounded-md transition-all cursor-pointer"
              style={{
                backgroundColor: setFilter === f ? `${withOpacity(ACCENT, OPACITY_12)}` : 'transparent',
                color: setFilter === f ? ACCENT : 'var(--text-muted)',
                border: `1px solid ${setFilter === f ? withOpacity(ACCENT, OPACITY_30) : 'transparent'}`,
              }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Track set collection progress and bonus thresholds.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSets.map(set => {
          const ownedCount = set.pieces.filter(p => p.owned).length;
          const isExpanded = expandedSets.has(set.name);
          return (
            <motion.div key={set.name} className="rounded-lg border overflow-hidden"
              style={{ borderColor: `${withOpacity(set.color, OPACITY_25)}`, backgroundColor: `${withOpacity(set.color, OPACITY_5)}` }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Collapsible header */}
              <button onClick={() => toggleSet(set.name)}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/20 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  </motion.div>
                  <span className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(set.color, OPACITY_25)}` }}>{set.name}</span>
                </div>
                <span className="text-sm font-mono font-bold" style={{ color: set.color }}>{ownedCount}/{set.pieces.length}</span>
              </button>
              {/* Collapsible body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {set.pieces.map(piece => (
                          <div key={piece.slot} className="flex items-center gap-1.5 text-sm font-mono px-2 py-1 rounded border"
                            style={{ borderColor: piece.owned ? `${withOpacity(set.color, OPACITY_30)}` : 'var(--border)', backgroundColor: piece.owned ? `${withOpacity(set.color, OPACITY_10)}` : 'transparent', opacity: piece.owned ? 1 : 0.5 }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: piece.owned ? set.color : STATUS_SUBDUED }} />
                            <span className="text-text-muted">{piece.slot}:</span>
                            <span className={piece.owned ? 'text-text' : 'text-text-muted'}>{piece.name}</span>
                            {!piece.owned && <span className="text-xs" style={{ color: STATUS_ERROR }}>(missing)</span>}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5 border-t pt-2" style={{ borderColor: `${withOpacity(set.color, OPACITY_12)}` }}>
                        {set.bonuses.map(bonus => {
                          const active = ownedCount >= bonus.pieces;
                          return (
                            <div key={bonus.pieces} className="flex items-center gap-2 text-sm font-mono" style={{ opacity: active ? 1 : 0.4 }}>
                              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold border"
                                style={{ borderColor: active ? `${withOpacity(set.color, OPACITY_37)}` : 'var(--border)', backgroundColor: active ? `${withOpacity(set.color, OPACITY_12)}` : 'transparent', color: active ? set.color : 'var(--text-muted)' }}>
                                {bonus.pieces}
                              </span>
                              <span className={active ? 'text-text' : 'text-text-muted'}>{bonus.description}</span>
                              {active && <span className="text-xs font-mono uppercase tracking-[0.15em] ml-auto" style={{ color: STATUS_SUCCESS }}>ACTIVE</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
