'use client';

import { HardDrive, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { FILE_SIZE_SECTIONS, TOTAL_BYTES, COMPRESSION_RATIO, ACCENT, formatBytes } from './data';

export function FileSizeBreakdown() {
  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="FILE_SIZE_BREAKDOWN" icon={HardDrive} color={ACCENT} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{formatBytes(TOTAL_BYTES)} total</span>
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {/* Treemap-style rectangles */}
        <div className="flex gap-1 h-16 rounded-lg overflow-hidden">
          {FILE_SIZE_SECTIONS.map((sec) => {
            const pct = (sec.bytes / TOTAL_BYTES) * 100;
            return (
              <motion.div
                key={sec.label}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="relative group cursor-default overflow-hidden"
                style={{ backgroundColor: `${sec.color}30`, borderLeft: `2px solid ${sec.color}` }}
                title={`${sec.label}: ${formatBytes(sec.bytes)} (${pct.toFixed(1)}%)`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: `${sec.color}15` }} />
                {pct > 12 && (
                  <div className="p-1.5 font-mono text-xs leading-tight relative z-10">
                    <div className="font-bold truncate" style={{ color: sec.color }}>{sec.label}</div>
                    <div className="text-text-muted">{formatBytes(sec.bytes)}</div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Section details */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {FILE_SIZE_SECTIONS.map((sec) => (
            <div key={sec.label} className="border border-border/10 rounded-lg p-2 font-mono text-xs" style={{ backgroundColor: `${ACCENT}06` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: sec.color }} />
                <span className="text-cyan-300 font-bold truncate text-xs uppercase tracking-[0.15em]">{sec.label}</span>
              </div>
              <div className="text-cyan-100">{formatBytes(sec.bytes)}</div>
              <div className="text-text-muted">{((sec.bytes / TOTAL_BYTES) * 100).toFixed(1)}%</div>
              {sec.subsections && (
                <div className="mt-1.5 pt-1.5 border-t border-border/10 space-y-0.5">
                  {sec.subsections.map(sub => (
                    <div key={sub.label} className="flex justify-between text-text-muted">
                      <span className="truncate">{sub.label}</span>
                      <span>{formatBytes(sub.bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Compression ratio */}
        <div className="flex items-center gap-3 px-2 py-2 border border-border/10 rounded-lg font-mono text-xs" style={{ backgroundColor: `${ACCENT}06` }}>
          <Archive className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Compression</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${ACCENT}12` }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${COMPRESSION_RATIO * 100}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full rounded-full"
              style={{ backgroundColor: ACCENT_EMERALD }}
            />
          </div>
          <span className="text-cyan-300">{formatBytes(Math.round(TOTAL_BYTES * COMPRESSION_RATIO))}</span>
          <span className="text-emerald-400 font-bold">{((1 - COMPRESSION_RATIO) * 100).toFixed(0)}% saved</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
