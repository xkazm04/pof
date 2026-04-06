'use client';

import { useState } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import type { FieldDef, FieldWarning } from './types';

/* ── Profile Section Component ─────────────────────────────────────────── */

interface ProfileSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  fields: FieldDef[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  compareValues?: Record<string, number>;
  compareColor?: string;
  fieldWarnings?: Map<string, FieldWarning>;
}

export function ProfileSection({
  title, icon, color, fields, values, onChange,
  compareValues, compareColor, fieldWarnings,
}: ProfileSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const warningCount = fieldWarnings ? Array.from(fieldWarnings.values()).length : 0;

  return (
    <BlueprintPanel color={color}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface/30 transition-colors"
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronRight className="w-3 h-3 text-text-muted" />
        </motion.div>
        <SectionHeader icon={icon} label={title} color={color} />
        <span className="ml-auto flex items-center gap-1.5">
          {warningCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold"
              style={{ backgroundColor: `${withOpacity(STATUS_WARNING, OPACITY_10)}`, color: STATUS_WARNING, border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_20)}` }}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {warningCount}
            </span>
          )}
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{fields.length} fields</span>
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {fields.map((f, index) => {
                const val = values[f.key] ?? 0;
                const pct = ((val - f.min) / (f.max - f.min)) * 100;
                const cmpVal = compareValues?.[f.key];
                const cmpPct = cmpVal != null ? ((cmpVal - f.min) / (f.max - f.min)) * 100 : undefined;
                return (
                  <motion.div
                    key={f.key}
                    initial={{ opacity: 0.5, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'tween', duration: 0.35, delay: index * 0.02 }}
                    className="group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-24 truncate flex-shrink-0">{f.label}</span>
                      <div className="flex-1 relative h-4 flex items-center">
                        <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
                        {cmpPct != null && (
                          <div className="absolute h-1.5 rounded-full opacity-30"
                            style={{ width: `${Math.min(cmpPct, 100)}%`, backgroundColor: compareColor }} />
                        )}
                        <NeonBar pct={pct} color={color} height={6} glow />
                        <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                          onChange={(e) => onChange(f.key, parseFloat(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                        <div className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none transition-all duration-150"
                          style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: color }} />
                      </div>
                      <input type="number" min={f.min} max={f.max} step={f.step} value={val}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) onChange(f.key, Math.max(f.min, Math.min(f.max, v)));
                        }}
                        className="w-16 text-xs font-mono font-bold text-right px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                        style={{ textShadow: `0 0 12px ${withOpacity(color, OPACITY_25)}` }}
                      />
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted/60 w-8 flex-shrink-0">{f.unit}</span>
                    </div>
                    {fieldWarnings?.get(f.key) && (() => {
                      const w = fieldWarnings.get(f.key)!;
                      const wColor = w.severity === 'error' ? STATUS_ERROR : STATUS_WARNING;
                      return (
                        <div className="flex items-center gap-1.5 ml-[104px] mt-0.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: wColor }} />
                          <span className="text-xs font-mono leading-tight" style={{ color: wColor }}>{w.message}</span>
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BlueprintPanel>
  );
}
