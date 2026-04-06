'use client';

import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { ACCENT_RED, ACCENT_EMERALD } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { AGGRO_TABLE, AGGRO_EVENTS } from '../data';

export function AggroTable() {
  return (
    <BlueprintPanel color={ACCENT_RED} className="p-3">
      <SectionHeader icon={Swords} label="Aggro Table" color={ACCENT_RED} />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Threat bars */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Threat Values</div>
          {AGGRO_TABLE.map(entry => (
            <div key={entry.target} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{entry.target}</span>
                <span className="text-xs font-mono font-bold" style={{ color: entry.color }}>{entry.threat}</span>
              </div>
              <NeonBar pct={entry.threat} color={entry.color} glow />
              <div className="flex gap-2">
                {entry.breakdown.map(b => (
                  <span key={b.source} className="text-xs font-mono text-text-muted">
                    {b.source}={b.pct}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Aggro switch events */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Aggro Switch Log</div>
          <div className="space-y-1.5">
            {AGGRO_EVENTS.map((evt, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-surface-deep rounded border border-border/30 px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-text-muted text-xs">{evt.time}</span>
                  <span className="font-bold" style={{ color: ACCENT_RED }}>{evt.from}</span>
                  <span className="text-text-muted">&rarr;</span>
                  <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{evt.to}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{evt.reason}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
