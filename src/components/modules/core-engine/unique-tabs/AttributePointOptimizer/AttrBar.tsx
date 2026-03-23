'use client';

import { motion } from 'framer-motion';
import { NeonBar } from './design';

/* ── Attribute Bar ────────────────────────────────────────────────────────── */

interface AttrBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  perPoint: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
}

export function AttrBar({ label, value, max, color, icon: Icon, perPoint, onChange, disabled }: AttrBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color, filter: `drop-shadow(0 0 4px ${color}80)` }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{perPoint}</span>
          <motion.span
            key={value}
            initial={{ scale: 1.2, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-sm font-mono font-bold tabular-nums"
            style={{ color, textShadow: `0 0 10px ${color}40` }}
          >
            {value}
          </motion.span>
        </div>
      </div>
      {onChange ? (
        <input
          title={label}
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: color }}
        />
      ) : (
        <NeonBar pct={pct} color={color} height={6} glow />
      )}
    </div>
  );
}
