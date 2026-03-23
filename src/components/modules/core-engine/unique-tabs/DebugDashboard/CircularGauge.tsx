'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, NeonBar } from '../_design';
import { ACCENT } from './data';

/* ── Circular Gauge ────────────────────────────────────────────────────── */

export function CircularGauge({ label, current, target, unit }: {
  label: string; current: number; target: number; unit: string;
}) {
  const pct = Math.min(current / target, 1);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const color = pct < 0.75 ? STATUS_SUCCESS : pct < 0.95 ? STATUS_WARNING : STATUS_ERROR;
  const statusLabel = pct < 0.75 ? 'NOMINAL' : pct < 0.95 ? 'WARNING' : 'CRITICAL';

  return (
    <BlueprintPanel color={ACCENT} className="flex flex-col items-center px-2 py-3 gap-2">
      <div className="relative">
        <svg width="48" height="48" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} fill="none" stroke={`${ACCENT}08`} strokeWidth="4" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" transform="rotate(-90 30 30)"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out', filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-xs font-mono font-bold" style={{ color }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>

      <div className="text-center w-full z-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] mb-0.5" style={{ color: `${ACCENT}cc` }}>{label}</div>
        <div className="text-sm font-mono" style={{ color: `${ACCENT}ee`, textShadow: `0 0 8px ${ACCENT}50` }}>
          {current.toFixed(unit === 'ms' ? 1 : 0)}<span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: `${ACCENT}50` }}>{unit}</span>
        </div>
        <div className="mt-1.5">
          <NeonBar pct={pct * 100} color={color} height={3} glow />
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-[2px] rounded border"
            style={{ backgroundColor: `${color}${OPACITY_10}`, color, borderColor: `${color}${OPACITY_30}` }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Copy Button ───────────────────────────────────────────────────────── */

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded transition-all border shrink-0"
      style={{
        backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`,
        color: copied ? STATUS_SUCCESS : ACCENT,
        borderColor: copied ? STATUS_SUCCESS : `${ACCENT}${OPACITY_30}`,
        boxShadow: copied ? `0 0 10px ${STATUS_SUCCESS}40` : 'none',
      }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'COPIED' : 'EXEC'}
    </button>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */

export function Sparkline({ data, color, width = 60, height = 16 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
    </svg>
  );
}
