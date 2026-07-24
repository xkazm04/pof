'use client';

import { useMemo, useState, useCallback } from 'react';
import { Table2, Code, Download, AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, ACCENT_CYAN, ACCENT_CYAN_LIGHT, ACCENT_VIOLET,
  OVERLAY_WHITE, withOpacity,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30, OPACITY_80, OPACITY_90,
} from '@/lib/chart-colors';
import { motionSafe } from '@/lib/motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, CopyButton } from '../../../unique-tabs/_shared';
import { ACCENT, MAX_LEVEL, LEVEL_REWARDS } from '../../_shared/data';
import {
  generateProgressionTable,
  progressionToCSV,
  progressionToUE5Struct,
  progressionToUE5Loader,
} from './helpers';

/* ── Component ─────────────────────────────────────────────────────────────── */

interface XpTableGeneratorProps {
  baseXp: number;
  curveExp: number;
}

export function XpTableGenerator({ baseXp, curveExp }: XpTableGeneratorProps) {
  const prefersReduced = useReducedMotion();
  const [hpPerLevel, setHpPerLevel] = useState(10);
  const [manaPerLevel, setManaPerLevel] = useState(5);
  const [attrPointsPerLevel, setAttrPointsPerLevel] = useState(3);
  const [xpTableTab, setXpTableTab] = useState<'table' | 'csv' | 'struct' | 'loader'>('table');
  const [levelOverrides] = useState<Map<number, Partial<{ xpRequired: number; hpBonus: number; manaBonus: number }>>>(new Map());

  const progressionRows = useMemo(
    () => generateProgressionTable(MAX_LEVEL, baseXp, curveExp, hpPerLevel, manaPerLevel, attrPointsPerLevel, levelOverrides),
    [baseXp, curveExp, hpPerLevel, manaPerLevel, attrPointsPerLevel, levelOverrides],
  );

  const xpTableOutput = useMemo(() => {
    switch (xpTableTab) {
      case 'table': return '';
      case 'csv': return progressionToCSV(progressionRows);
      case 'struct': return progressionToUE5Struct();
      case 'loader': return progressionToUE5Loader();
    }
  }, [xpTableTab, progressionRows]);

  const getCopyText = useCallback(() => {
    return xpTableTab === 'table' ? progressionToCSV(progressionRows) : xpTableOutput;
  }, [xpTableTab, progressionRows, xpTableOutput]);

  const handleDownloadCSV = useCallback(() => {
    const csv = progressionToCSV(progressionRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DT_ProgressionCurve_Base${baseXp}_Exp${curveExp.toFixed(1)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [progressionRows, baseXp, curveExp]);

  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel icon={Table2} label="XP Curve Data Table Generator" color={ACCENT} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border"
            style={{ borderColor: `${STATUS_SUCCESS}${OPACITY_30}`, color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}
          >
            <Download className="w-3 h-3" /> Download .csv
          </button>
          <CopyButton getText={getCopyText} accent={ACCENT} />
        </div>
      </div>

      <p className="text-2xs text-text-muted mb-3">
        Replaces <span className="font-mono" style={{ color: ACCENT_CYAN }}>CalculateXPForLevel()</span> with a UE5 Data Table.
        Uses Base XP ({baseXp}) and Exponent ({curveExp}) from sliders above. Includes HP/Mana/Attr bonuses and milestone rewards.
      </p>

      {/* Per-level stat config */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/50 border border-border/30">
          <span className="text-2xs font-mono text-text-muted w-14">HP/Lvl</span>
          <input
            type="number" min={1} max={100} step={1} value={hpPerLevel}
            onChange={e => setHpPerLevel(Number(e.target.value))}
            className="flex-1 bg-surface-deep/50 border border-border/40 rounded px-2 py-1 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/50 border border-border/30">
          <span className="text-2xs font-mono text-text-muted w-14">Mana/Lvl</span>
          <input
            type="number" min={1} max={100} step={1} value={manaPerLevel}
            onChange={e => setManaPerLevel(Number(e.target.value))}
            className="flex-1 bg-surface-deep/50 border border-border/40 rounded px-2 py-1 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/50 border border-border/30">
          <span className="text-2xs font-mono text-text-muted w-14">Attr Pts</span>
          <input
            type="number" min={0} max={10} step={1} value={attrPointsPerLevel}
            onChange={e => setAttrPointsPerLevel(Number(e.target.value))}
            className="flex-1 bg-surface-deep/50 border border-border/40 rounded px-2 py-1 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Output tabs */}
      <div className="flex items-center gap-1 mb-2">
        {([
          { id: 'table' as const, label: 'Preview Table' },
          { id: 'csv' as const, label: 'CSV Export' },
          { id: 'struct' as const, label: 'FProgressionCurveRow.h' },
          { id: 'loader' as const, label: 'Data Table Loader' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setXpTableTab(tab.id)}
            className="px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border"
            style={{
              backgroundColor: xpTableTab === tab.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
              borderColor: xpTableTab === tab.id ? `${ACCENT}${OPACITY_30}` : 'var(--border)',
              color: xpTableTab === tab.id ? ACCENT : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table preview */}
      {xpTableTab === 'table' && (
        <div className="overflow-x-auto custom-scrollbar max-h-[400px] overflow-y-auto rounded-xl border border-border/40 bg-[#0d1117]">
          <table className="w-full text-2xs font-mono">
            <thead className="sticky top-0 bg-[#0d1117] z-10">
              <tr className="text-text-muted border-b border-border/40">
                <th className="text-center py-2 px-2 w-12">Lvl</th>
                <th className="text-right py-2 px-2">XP Req</th>
                <th className="text-right py-2 px-2">XP Total</th>
                <th className="text-right py-2 px-2">HP</th>
                <th className="text-right py-2 px-2">Mana</th>
                <th className="text-right py-2 px-2">Attr</th>
                <th className="text-left py-2 px-3">Unlock</th>
              </tr>
            </thead>
            <tbody>
              {progressionRows.map((row, i) => {
                const hasReward = row.unlockReward.length > 0;
                const reward = LEVEL_REWARDS.find(r => r.level === row.level);
                return (
                  <motion.tr
                    key={row.level}
                    initial={prefersReduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={motionSafe({ delay: i * 0.01 }, prefersReduced)}
                    className="border-b border-border/20 transition-colors hover:bg-surface-hover/20"
                    style={hasReward ? { backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10) } : undefined}
                  >
                    <td className="text-center py-1.5 px-2 font-bold" style={{ color: hasReward ? ACCENT : 'var(--text)' }}>
                      {row.level}
                    </td>
                    <td className="text-right py-1.5 px-2 text-text-muted">{row.xpRequired.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 text-text-muted">{row.xpTotal.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2" style={{ color: STATUS_SUCCESS }}>+{row.hpBonus}</td>
                    <td className="text-right py-1.5 px-2" style={{ color: ACCENT_CYAN }}>+{row.manaBonus}</td>
                    <td className="text-right py-1.5 px-2" style={{ color: ACCENT_VIOLET }}>+{row.attrPoints}</td>
                    <td className="text-left py-1.5 px-3">
                      {hasReward && reward && (
                        <span
                          className="px-1.5 py-0.5 rounded text-2xs"
                          style={{ backgroundColor: `${reward.color}${OPACITY_10}`, color: reward.color }}
                        >
                          {row.unlockReward}
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Code/CSV output */}
      {xpTableTab !== 'table' && (
        <div className="relative bg-[#0d1117] rounded-xl border border-border/40 overflow-hidden">
          <div className="px-3 py-1.5 bg-surface-deep/50 border-b border-border/30 flex items-center gap-2">
            <Code className="w-3 h-3 text-text-muted" />
            <span className="text-2xs font-mono text-text-muted">
              {xpTableTab === 'csv' ? `DT_ProgressionCurve_Base${baseXp}_Exp${curveExp.toFixed(1)}.csv` :
               xpTableTab === 'struct' ? 'Framework/FProgressionCurveRow.h' :
               'Player/ARPGPlayerCharacter_DataTable.cpp'}
            </span>
          </div>
          <pre className="p-4 text-2xs font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-[400px] overflow-y-auto" style={{ color: withOpacity(OVERLAY_WHITE, OPACITY_90) }}>
            {xpTableOutput}
          </pre>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mt-3">
        {[
          { label: 'Total XP to Max', value: progressionRows[progressionRows.length - 1]?.xpTotal.toLocaleString() ?? '0', color: ACCENT },
          { label: 'Total HP Gained', value: `+${(hpPerLevel * MAX_LEVEL).toLocaleString()}`, color: STATUS_SUCCESS },
          { label: 'Total Mana Gained', value: `+${(manaPerLevel * MAX_LEVEL).toLocaleString()}`, color: ACCENT_CYAN },
          { label: 'Total Attr Points', value: `${(attrPointsPerLevel * MAX_LEVEL).toLocaleString()}`, color: ACCENT_VIOLET },
        ].map(stat => (
          <div key={stat.label} className="bg-surface/50 rounded-lg p-2.5 border border-border/30 text-center">
            <div className="text-sm font-mono font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* UE5 integration note */}
      <div className="mt-2.5 p-3 rounded-lg border" style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_20), backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10) }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: STATUS_WARNING }} />
          <div className="text-2xs font-mono leading-relaxed" style={{ color: withOpacity(STATUS_WARNING, OPACITY_80) }}>
            <span className="font-bold" style={{ color: STATUS_WARNING }}>UE5 Import:</span> Download the CSV, then in UE5: Right-click Content Browser →
            Import → select CSV → choose <span style={{ color: ACCENT_CYAN_LIGHT }}>FProgressionCurveRow</span> as row struct.
            Set <span style={{ color: ACCENT_CYAN_LIGHT }}>ProgressionTable</span> on your player BP to the imported Data Table.
            The loader code falls back to the formula if no table is assigned.
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
