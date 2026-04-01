'use client';

import { Cloud, Wifi, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_INFO, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from './design';
import { ACCENT } from './data';
import { CLOUD_SYNC } from './data-panels';

export function CloudSyncSection() {
  const statusColor = CLOUD_SYNC.status === 'synced' ? STATUS_SUCCESS
    : CLOUD_SYNC.status === 'syncing' ? STATUS_INFO
    : CLOUD_SYNC.status === 'conflict' ? STATUS_ERROR : STATUS_WARNING;

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="CLOUD_SYNC_STATUS" icon={Cloud} color={ACCENT} />
        <div className="flex items-center gap-2">
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: statusColor }}>
            {CLOUD_SYNC.status}
          </span>
        </div>
      </div>

      <div className="p-3 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GlowStat
            label="Last Sync"
            value={new Date(CLOUD_SYNC.lastSync).toLocaleTimeString()}
            color={ACCENT}
            delay={0}
          />
          <GlowStat
            label="Conflicts"
            value={CLOUD_SYNC.conflicts}
            color={CLOUD_SYNC.conflicts === 0 ? STATUS_SUCCESS : STATUS_ERROR}
            delay={0.05}
          />
          <GlowStat
            label="Queue"
            value={`${CLOUD_SYNC.queueSize} pending`}
            unit={`${CLOUD_SYNC.latency}ms`}
            color={ACCENT}
            delay={0.1}
          />
          <GlowStat
            label="Bandwidth"
            value={CLOUD_SYNC.bandwidthUsed}
            unit={`/ ${CLOUD_SYNC.bandwidthLimit}`}
            color={ACCENT}
            delay={0.15}
          />
        </div>

        {/* Provider info bar */}
        <div className="mt-3 flex items-center gap-3 px-3 py-2 border border-border/10 rounded-lg font-mono text-xs" style={{ backgroundColor: `${ACCENT}06` }}>
          <Wifi className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Provider:</span>
          <span className="text-cyan-300">{CLOUD_SYNC.provider}</span>
          <span className="ml-auto text-text-muted">Protocol: WebSocket TLS</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
