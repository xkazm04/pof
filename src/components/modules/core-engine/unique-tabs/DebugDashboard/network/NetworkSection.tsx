'use client';

import { motion } from 'framer-motion';
import { Wifi, Zap } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_10,
  withOpacity, OPACITY_90, OPACITY_80, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import {
  ACCENT, NET_BANDWIDTH, NET_REPLICATED_ACTORS, NET_RPC_FREQ,
  NET_SUGGESTIONS, PRIORITY_COLORS,
} from '../data';

export function NetworkSection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <SectionHeader label="NETWORK_REPLICATION_MONITOR" color={ACCENT} icon={Wifi} />
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Bandwidth + Actor table */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] mb-1">
                <span className="text-text-muted">BANDWIDTH</span>
                <span className="font-bold" style={{ color: `${withOpacity(ACCENT, OPACITY_90)}` }}>{NET_BANDWIDTH.current}/{NET_BANDWIDTH.max} {NET_BANDWIDTH.unit}</span>
              </div>
              <NeonBar pct={(NET_BANDWIDTH.current / NET_BANDWIDTH.max) * 100} color={ACCENT_CYAN} height={5} glow />
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">TOP REPLICATED ACTORS</div>
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted pb-1 border-b border-border">
                  <span>Actor</span><span className="text-center">Count</span><span className="text-center">B/s</span><span className="text-right">Priority</span>
                </div>
                {NET_REPLICATED_ACTORS.map((a) => (
                  <div key={a.actor} className="grid grid-cols-4 gap-2 text-xs font-mono py-0.5 hover:bg-surface-deep/50 transition-colors">
                    <span style={{ color: `${withOpacity(ACCENT, OPACITY_80)}` }}>{a.actor}</span>
                    <span className="text-center text-text-muted">{a.count}</span>
                    <span className="text-center text-text-muted">{(a.bytesPerSec / 1000).toFixed(1)}K</span>
                    <span className="text-right">
                      <span className="px-1 py-[1px] rounded text-xs uppercase" style={{ color: PRIORITY_COLORS[a.priority], backgroundColor: `${PRIORITY_COLORS[a.priority]}${OPACITY_10}` }}>
                        {a.priority}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: RPC frequency + Suggestions */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">RPC FREQUENCY (calls/sec)</div>
              <div className="space-y-1.5">
                {NET_RPC_FREQ.map((rpc) => {
                  const maxFreq = Math.max(...NET_RPC_FREQ.map(r => r.freq));
                  return (
                    <div key={rpc.name} className="flex items-center gap-1.5">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] w-28 text-right text-text-muted truncate">{rpc.name}</span>
                      <div className="flex-1">
                        <NeonBar pct={(rpc.freq / maxFreq) * 100} color={rpc.color} height={4} />
                      </div>
                      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: rpc.color }}>{rpc.freq}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">OPTIMIZATION SUGGESTIONS</div>
              <div className="space-y-1.5">
                {NET_SUGGESTIONS.map((sug, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs font-mono text-text-muted leading-relaxed">
                    <Zap className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: `${withOpacity(ACCENT, OPACITY_30)}` }} />
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
