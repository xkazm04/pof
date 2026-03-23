'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_INFO, STATUS_WARNING,
  ACCENT_EMERALD, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';

interface PowerBudgetRadarProps {
  radarAxes: string[];
  radarValues: number[];
  ghostRadarValues: number[] | null;
  isOverBudget: boolean;
  powerBudget: { offense: number; defense: number; utility: number; total: number };
  budgetMax: number;
  budgetRatio: number;
  rarityLabel: string;
  rarityColor: string;
  accentColor: string;
}

export function PowerBudgetRadar({
  radarAxes, radarValues, ghostRadarValues,
  isOverBudget, powerBudget, budgetMax, budgetRatio,
  rarityLabel, rarityColor, accentColor,
}: PowerBudgetRadarProps) {
  return (
    <SurfaceCard level={2} className="p-3">
      <SectionLabel label="Power Budget" />
      <p className="text-2xs text-text-muted mt-1 mb-3">
        vs. max for <span style={{ color: rarityColor }}>{rarityLabel}</span> tier ({budgetMax} budget)
      </p>

      {/* Radar SVG */}
      <div className="flex justify-center">
        <svg width={160} height={140} viewBox="0 0 160 140" className="overflow-visible">
          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1.0].map((t) => {
            const r = t * 50;
            return (
              <polygon
                key={t}
                points={radarAxes.map((_, i) => {
                  const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                  return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
                }).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}
          {/* Axis lines */}
          {radarAxes.map((_, i) => {
            const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={i}
                x1={80} y1={65}
                x2={80 + 50 * Math.cos(angle)} y2={65 + 50 * Math.sin(angle)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            );
          })}
          {/* Ghost polygon — shows max magnitude potential */}
          {ghostRadarValues && (
            <polygon
              points={ghostRadarValues.map((v, i) => {
                const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                const r = Math.min(v, 1.0) * 50;
                return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
              }).join(' ')}
              fill={`${ACCENT_VIOLET}10`}
              stroke={ACCENT_VIOLET}
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity={0.7}
            />
          )}
          {/* Data polygon */}
          <polygon
            points={radarValues.map((v, i) => {
              const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
              const r = Math.min(v, 1.0) * 50;
              return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
            }).join(' ')}
            fill={isOverBudget ? `${STATUS_ERROR}20` : `${accentColor}20`}
            stroke={isOverBudget ? STATUS_ERROR : accentColor}
            strokeWidth="2"
          />
          {/* Data points */}
          {radarValues.map((v, i) => {
            const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
            const r = Math.min(v, 1.0) * 50;
            return (
              <circle
                key={i}
                cx={80 + r * Math.cos(angle)} cy={65 + r * Math.sin(angle)}
                r={3}
                fill={isOverBudget ? STATUS_ERROR : accentColor}
              />
            );
          })}
          {/* Axis labels */}
          {radarAxes.map((label, i) => {
            const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
            const lx = 80 + 62 * Math.cos(angle);
            const ly = 65 + 62 * Math.sin(angle);
            return (
              <text
                key={label}
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[11px] font-mono fill-[var(--text-muted)]"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Budget bar */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-text-muted">Total Power</span>
          <span style={{ color: isOverBudget ? STATUS_ERROR : accentColor }} className="font-bold">
            {powerBudget.total.toFixed(0)} / {budgetMax}
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-deep overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
            style={{ backgroundColor: isOverBudget ? STATUS_ERROR : budgetRatio > 0.8 ? STATUS_WARNING : accentColor }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>
        {isOverBudget && (
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: STATUS_ERROR }}>
            <AlertTriangle className="w-3 h-3" />
            Over budget by {((budgetRatio - 1) * 100).toFixed(0)}% — consider reducing magnitudes
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="mt-3 space-y-1">
        {[
          { label: 'Offense', value: powerBudget.offense, color: STATUS_ERROR },
          { label: 'Defense', value: powerBudget.defense, color: STATUS_INFO },
          { label: 'Utility', value: powerBudget.utility, color: ACCENT_EMERALD },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
            <span className="text-text-muted w-12">{row.label}</span>
            <div className="flex-1 h-1 rounded-full bg-surface-deep overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min((row.value / budgetMax) * 100, 100)}%`, backgroundColor: row.color }} />
            </div>
            <span className="font-bold w-8 text-right" style={{ color: row.color }}>{row.value.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
