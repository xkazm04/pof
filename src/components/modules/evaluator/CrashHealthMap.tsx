'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SEVERITY_TOKENS, STATUS_LOCKED } from '@/lib/chart-colors';
import { buildModuleHealth, layoutHealthMap } from '@/lib/crash-health/health-map';
import type { CrashReport, CrashPattern } from '@/types/crash-analyzer';

const VW = 640;
const VH = 420;

function nodeColor(maxSeverity: string): string {
  const tok = (SEVERITY_TOKENS as Record<string, { color: string }>)[maxSeverity];
  return tok?.color ?? STATUS_LOCKED;
}

export function CrashHealthMap({ reports, patterns }: { reports: CrashReport[]; patterns: CrashPattern[] }) {
  const nodes = useMemo(() => buildModuleHealth({ reports, patterns }), [reports, patterns]);
  const positioned = useMemo(() => layoutHealthMap(nodes, { width: VW, height: VH }), [nodes]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = positioned.find((p) => p.node.moduleId === activeId)?.node ?? null;

  if (nodes.length === 0) {
    return <div className="text-center py-10 text-sm text-text-muted">No crash data to map yet.</div>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="rounded-xl border border-border bg-surface-deep/40" role="img" aria-label="Module crash health map">
        {positioned.map((p) => {
          const color = nodeColor(p.node.maxSeverity);
          const breathing = p.node.systemicCount > 0 || p.node.maxSeverity === 'critical';
          return (
            <g
              key={p.node.moduleId}
              data-testid="health-node"
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setActiveId(p.node.moduleId)}
              onClick={() => setActiveId(p.node.moduleId)}
              style={{ cursor: 'pointer' }}
            >
              <motion.circle
                r={p.r}
                fill={color}
                fillOpacity={0.25}
                stroke={color}
                strokeWidth={activeId === p.node.moduleId ? 3 : 1.5}
                animate={breathing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={breathing ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
                style={{ transformOrigin: 'center' }}
              />
              <text textAnchor="middle" dy={p.r + 12} fontSize={11} className="font-mono" fill="var(--text-muted)">
                {p.node.moduleId.replace(/^arpg-/, '')}
              </text>
              <text textAnchor="middle" dy={4} fontSize={12} fontWeight={700} fill="var(--text)">
                {p.node.crashCount}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3" data-testid="health-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">{active.moduleId}</span>
            <span className="text-xs font-mono" style={{ color: nodeColor(active.maxSeverity) }}>
              {active.crashCount} crash{active.crashCount === 1 ? '' : 'es'} · {active.maxSeverity}
            </span>
          </div>
          {active.topPatterns.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {active.topPatterns.map((pat) => (
                <li key={pat.name} className="text-xs text-text-muted flex items-center gap-2">
                  <span className="flex-1 truncate">{pat.name}</span>
                  <span className="font-mono">×{pat.occurrences}</span>
                  {pat.isSystemic && <span className="text-2xs px-1 rounded" style={{ color: nodeColor('critical') }}>systemic</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-muted italic">No recurring patterns in this module.</p>
          )}
        </div>
      )}
    </div>
  );
}
