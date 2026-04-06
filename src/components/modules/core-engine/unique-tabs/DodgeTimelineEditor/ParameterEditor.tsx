'use client';

import { motion } from 'framer-motion';
import { Settings2 } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET,
  withOpacity, OPACITY_25,
} from '@/lib/chart-colors';
import type { DodgeParams } from '../dodge-types';
import { PARAM_FIELDS, DEFAULT_PARAMS } from '../dodge-types';
import { BlueprintPanel, SectionHeader } from '../_design';

export function ParameterEditor({
  params,
  onUpdate,
  onReset,
}: {
  params: DodgeParams;
  onUpdate: (key: keyof DodgeParams, value: number) => void;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <div className="flex items-center gap-2">
          <SectionHeader icon={Settings2} label="Dodge Parameters" color={ACCENT_CYAN} />
          <button
            onClick={onReset}
            className="ml-auto text-xs font-mono text-text-muted hover:text-text transition-colors"
          >
            Reset Defaults
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
          {PARAM_FIELDS.map((f) => {
            const val = params[f.key];
            const pct = ((val - f.min) / (f.max - f.min)) * 100;
            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-24 truncate flex-shrink-0">
                  {f.label}
                </span>
                <div className="flex-1 relative h-4 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
                  <div
                    className="absolute h-1.5 rounded-full transition-all duration-150"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: f.color, boxShadow: `0 0 6px ${withOpacity(f.color, OPACITY_25)}` }}
                  />
                  <input
                    type="range" min={f.min} max={f.max} step={f.step} value={val}
                    onChange={(e) => onUpdate(f.key, parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none transition-all duration-150"
                    style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: f.color }}
                  />
                </div>
                <input
                  type="number" min={f.min} max={f.max} step={f.step} value={val}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onUpdate(f.key, Math.max(f.min, Math.min(f.max, v)));
                  }}
                  className="w-14 text-xs font-mono font-bold text-right px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                />
                <span className="text-xs font-mono text-text-muted/60 w-6 flex-shrink-0">{f.unit}</span>
              </div>
            );
          })}
        </div>

        {/* Quick stat readouts */}
        <div className="flex flex-wrap gap-3 mt-2.5 pt-2 border-t border-border/30 text-xs font-mono text-text-muted">
          <span>
            Max Speed:{' '}
            <span className="font-bold" style={{ color: ACCENT_CYAN, textShadow: `0 0 12px ${withOpacity(ACCENT_CYAN, OPACITY_25)}` }}>
              {(params.dodgeDistance / params.dodgeDuration).toFixed(0)} cm/s
            </span>
          </span>
          <span>
            I-Frame Window:{' '}
            <span className="font-bold" style={{ color: ACCENT_ORANGE, textShadow: `0 0 12px ${withOpacity(ACCENT_ORANGE, OPACITY_25)}` }}>
              {(params.iFrameDuration / params.dodgeDuration * 100).toFixed(0)}%
            </span>
          </span>
          <span>
            Cancel Window:{' '}
            <span className="font-bold" style={{ color: ACCENT_VIOLET, textShadow: `0 0 12px ${withOpacity(ACCENT_VIOLET, OPACITY_25)}` }}>
              {((params.cancelWindowEnd - params.cancelWindowStart) / params.dodgeDuration * 100).toFixed(0)}%
            </span>
          </span>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
