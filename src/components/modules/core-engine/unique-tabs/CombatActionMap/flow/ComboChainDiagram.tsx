'use client';

import { useState, useMemo } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import type { FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from '../../_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { ACCENT, COMBO_SECTIONS } from '../data';
import { COMBO_SEQUENCES } from '../data-metrics';
import type { WeaponCategory } from '../data-metrics';

const CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const PAGE_SIZE = 6;

export function ComboChainDiagram({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];
  const [filterCat, setFilterCat] = useState<WeaponCategory | 'All'>('All');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (filterCat === 'All') return COMBO_SEQUENCES;
    return COMBO_SEQUENCES.filter(c => c.weaponCategory === filterCat);
  }, [filterCat]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePages = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePages * PAGE_SIZE, (safePages + 1) * PAGE_SIZE);
  const maxDps = Math.max(...COMBO_SEQUENCES.map(c => c.dps), 1);

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex items-center gap-4 mb-2">
        <SectionHeader label="Combo Chain Analysis" color={ACCENT} icon={Play} />
        <span className="text-2xs px-2 py-0.5 rounded-md ml-auto" style={{ backgroundColor: sc.bg, color: sc.dot }}>
          {sc.label}
        </span>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        {(['All', ...CATEGORIES] as const).map(cat => {
          const active = filterCat === cat;
          return (
            <button
              key={cat}
              onClick={() => { setFilterCat(cat); setPage(0); }}
              className="px-2 py-0.5 rounded text-xs font-mono border transition-colors cursor-pointer hover:brightness-110"
              style={{
                borderColor: active ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)',
                backgroundColor: active ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                color: active ? ACCENT : 'var(--text-muted)',
              }}
            >
              {cat}
            </button>
          );
        })}
        <span className="text-2xs font-mono text-text-muted self-center ml-1">{filtered.length} combos</span>
      </div>

      {/* Combo list header */}
      <div className="flex items-center gap-3 px-2 py-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted border-b border-border/40">
        <span className="w-[120px] flex-shrink-0">Combo</span>
        <span className="w-[70px] flex-shrink-0">Type</span>
        <span className="w-[40px] flex-shrink-0">Hits</span>
        <span className="w-[50px] flex-shrink-0">Time</span>
        <span className="flex-1">DPS</span>
      </div>

      {/* Paged combos */}
      <div className="space-y-0.5">
        {paged.map((combo, i) => (
          <motion.div
            key={combo.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors"
          >
            <span className="text-xs font-mono text-text w-[120px] flex-shrink-0 truncate">{combo.name}</span>
            <span className="text-2xs font-mono text-text-muted w-[70px] flex-shrink-0">{combo.weaponCategory}</span>
            <span className="text-2xs font-mono text-text-muted w-[40px] flex-shrink-0">{combo.hits}h</span>
            <span className="text-2xs font-mono text-text-muted w-[50px] flex-shrink-0">{combo.totalTime}</span>
            <div className="flex-1">
              <NeonBar pct={(combo.dps / maxDps) * 100} color={ACCENT} />
            </div>
            <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: ACCENT }}>{combo.dps}</span>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePages === 0}
            className="p-1 rounded hover:bg-surface-hover/50 transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className="w-6 h-6 rounded text-xs font-mono transition-colors cursor-pointer"
              style={safePages === i
                ? { backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }
                : { color: 'var(--text-muted)', border: '1px solid var(--border)' }
              }
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePages === totalPages - 1}
            className="p-1 rounded hover:bg-surface-hover/50 transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      )}

      {/* Legacy static chain (collapsed) */}
      <details className="mt-3">
        <summary className="text-xs font-mono text-text-muted cursor-pointer hover:text-text transition-colors">Legacy 3-Hit Chain</summary>
        <div className="mt-2 space-y-0.5">
          {COMBO_SECTIONS.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 px-2 py-1 rounded">
              <span className="text-xs font-mono text-text w-[100px]">{s.name}</span>
              <span className="text-2xs font-mono text-text-muted w-[80px]">{s.timing}</span>
              <span className="text-2xs font-medium w-[80px]" style={{ color: i === 2 ? STATUS_ERROR : ACCENT }}>{s.window}</span>
              <div className="flex-1"><NeonBar pct={s.pct} color={i === 2 ? STATUS_ERROR : ACCENT} /></div>
            </div>
          ))}
        </div>
      </details>
    </BlueprintPanel>
  );
}
