'use client';

import { TrendingUp, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import { CURRENCIES, CRAFTING_ACTIONS } from './constants';
import type { CurrencyId, CraftLogEntry } from './types';

interface CraftLogSectionProps {
  craftLog: CraftLogEntry[];
  avgCraftCost: Partial<Record<CurrencyId, number>> | null;
  craftCount: number;
}

export function CraftLogSection({ craftLog, avgCraftCost, craftCount }: CraftLogSectionProps) {
  return (
    <div className="space-y-2">
      {avgCraftCost && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
          style={{ border: `1px solid ${ACCENT_CYAN}25`, backgroundColor: `${ACCENT_CYAN}05` }}>
          <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-mono font-bold text-text uppercase tracking-[0.15em]">Avg cost/craft:</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(avgCraftCost).map(([cid, avg]) => {
              const cur = CURRENCIES.find(c => c.id === cid);
              if (!cur) return null;
              return <span key={cid} className="text-xs font-mono" style={{ color: cur.color }}>{avg} {cur.icon}</span>;
            })}
          </div>
          <span className="ml-auto text-xs font-mono text-text-muted">({craftCount} crafts)</span>
        </div>
      )}

      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        <div className="flex items-center gap-1 text-xs font-mono font-bold text-text-muted uppercase tracking-[0.15em]">
          <History className="w-3 h-3" /> Craft Log
        </div>
        {craftLog.slice(0, 8).map((entry, i) => {
          const action = CRAFTING_ACTIONS.find(a => a.id === entry.action);
          return (
            <motion.div key={`${entry.timestamp}-${i}`}
              initial={i === 0 ? { opacity: 0, y: -5 } : {}}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs font-mono">
              <span className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.success ? (action?.color ?? ACCENT_CYAN) : STATUS_ERROR }} />
              <span className={entry.success ? 'text-text-muted' : 'text-red-400 line-through'}>{entry.detail}</span>
              <span className="ml-auto text-text-muted opacity-50 flex-shrink-0">
                {Object.entries(entry.spent).map(([cid, amt]) => {
                  const cur = CURRENCIES.find(c => c.id === cid);
                  return amt ? `${amt}${cur?.icon ?? ''}` : '';
                }).filter(Boolean).join(' ')}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
