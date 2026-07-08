'use client';

import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_15,
} from '@/lib/chart-colors';
import { safeDivide } from '@/lib/math-utils';
import type { ComboSection } from './types';
import { WINDOW_ORDER } from './constants';

export function MontageTimeline({ sections }: { sections: ComboSection[] }) {
  const totalDuration = sections.reduce((s, sec) => s + sec.duration, 0);

  return (
    <div className="space-y-2">
      {sections.map((sec, i) => {
        const widthPct = safeDivide(sec.duration, totalDuration) * 100;
        const sortedWindows = [...sec.windows].sort((a, b) =>
          WINDOW_ORDER.indexOf(a.name as typeof WINDOW_ORDER[number]) - WINDOW_ORDER.indexOf(b.name as typeof WINDOW_ORDER[number])
        );

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-2xs font-mono font-bold text-text w-24 truncate">{sec.label}</span>
              <span className="text-2xs text-text-muted">{sec.duration}s</span>
              <span className="text-2xs font-mono" style={{ color: STATUS_ERROR }}>{sec.damage} dmg</span>
              {sec.motionWarpTarget && (
                <span className="text-2xs px-1 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_15}`, color: ACCENT_EMERALD }}>Warp</span>
              )}
              <span className="text-2xs text-text-muted ml-auto">{sec.rootMotionDistance}cm</span>
            </div>
            <div className="relative rounded-md overflow-hidden" style={{ width: `${widthPct}%`, minWidth: 120 }}>
              {/* Background track */}
              <div className="h-6 bg-surface-deep rounded-md relative overflow-hidden">
                {/* Notify windows */}
                {sortedWindows.map((win, wi) => (
                  <div
                    key={wi}
                    className="absolute top-0 h-full rounded-sm opacity-60 hover:opacity-90 transition-opacity cursor-default"
                    style={{
                      left: `${win.start * 100}%`,
                      width: `${win.width * 100}%`,
                      backgroundColor: win.color,
                    }}
                    title={`${win.name}: ${(win.start * sec.duration).toFixed(3)}s – ${((win.start + win.width) * sec.duration).toFixed(3)}s`}
                  >
                    <span className="text-[11px] font-mono font-bold text-white px-0.5 truncate block leading-6">
                      {win.name.replace('Detection', '').replace('Spawn', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
      {/* Legend */}
      <div className="flex gap-3 pt-1">
        {[
          { name: 'ComboWindow', color: ACCENT_CYAN },
          { name: 'HitDetection', color: STATUS_ERROR },
          { name: 'VFX', color: STATUS_WARNING },
          { name: 'MotionWarp', color: ACCENT_EMERALD },
        ].map(l => (
          <div key={l.name} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.6 }} />
            <span className="text-2xs text-text-muted">{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
