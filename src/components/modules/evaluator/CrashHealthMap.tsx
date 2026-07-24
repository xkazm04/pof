'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { SEVERITY_TOKENS, STATUS_LOCKED } from '@/lib/chart-colors';
import { buildModuleHealth, layoutHealthMap } from '@/lib/crash-health/health-map';
import type { ModuleHealthNode } from '@/lib/crash-health/health-map';
import type { CrashReport, CrashPattern } from '@/types/crash-analyzer';

const VW = 640;
const VH = 420;

function nodeColor(maxSeverity: string): string {
  const tok = (SEVERITY_TOKENS as Record<string, { color: string }>)[maxSeverity];
  return tok?.color ?? STATUS_LOCKED;
}

/**
 * Spoken label for a bubble. Severity is encoded as hue in the map, so the
 * accessible name has to carry it in words — otherwise the whole risk ranking
 * is invisible to screen-reader and colorblind users (WCAG 1.4.1).
 */
function nodeLabel(node: ModuleHealthNode): string {
  const crashes = `${node.crashCount} crash${node.crashCount === 1 ? '' : 'es'}`;
  const systemic = node.systemicCount > 0 ? `, ${node.systemicCount} systemic pattern${node.systemicCount === 1 ? '' : 's'}` : '';
  return `${node.moduleId}: ${crashes}, worst severity ${node.maxSeverity}${systemic}`;
}

export function CrashHealthMap({ reports, patterns }: { reports: CrashReport[]; patterns: CrashPattern[] }) {
  const nodes = useMemo(() => buildModuleHealth({ reports, patterns }), [reports, patterns]);
  const positioned = useMemo(() => layoutHealthMap(nodes, { width: VW, height: VH }), [nodes]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = positioned.find((p) => p.node.moduleId === activeId)?.node ?? null;
  // The "breathing" pulse loops forever, so it must honour prefers-reduced-motion.
  const prefersReduced = useReducedMotion() ?? false;

  if (nodes.length === 0) {
    return (
      <div className="text-center py-10">
        <Activity className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
        <p className="text-sm text-text-muted">No crashes to map yet</p>
        <p className="text-2xs text-text-muted mt-1">
          Import a crash log and each affected module appears as a bubble — sized by crash count, coloured by worst severity.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        className="rounded-xl border border-border bg-surface-deep/40"
        role="group"
        aria-label="Module crash health map — select a module for its crash detail"
      >
        {positioned.map((p) => {
          const color = nodeColor(p.node.maxSeverity);
          const isActive = activeId === p.node.moduleId;
          const breathing = !prefersReduced && (p.node.systemicCount > 0 || p.node.maxSeverity === 'critical');
          return (
            <g
              key={p.node.moduleId}
              data-testid="health-node"
              transform={`translate(${p.x}, ${p.y})`}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={nodeLabel(p.node)}
              className="focus-ring-outline"
              onMouseEnter={() => setActiveId(p.node.moduleId)}
              onFocus={() => setActiveId(p.node.moduleId)}
              onClick={() => setActiveId(p.node.moduleId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveId(p.node.moduleId);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <motion.circle
                r={p.r}
                fill={color}
                fillOpacity={0.25}
                stroke={color}
                strokeWidth={isActive ? 3 : 1.5}
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

      {/* Detail for the hovered/focused bubble. Polite live region so keyboard
          users hear the module's patterns as they tab across the map. */}
      <div aria-live="polite">
        {active && (
          <div className="mt-3 rounded-lg border border-border bg-surface p-3" data-testid="health-card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-text">{active.moduleId}</span>
              <span className="text-xs font-mono" style={{ color: nodeColor(active.maxSeverity) }}>
                {active.crashCount} crash{active.crashCount === 1 ? '' : 'es'} · {active.maxSeverity}
              </span>
            </div>
            {active.topPatterns.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {active.topPatterns.map((pat) => (
                  <li key={pat.name} className="text-xs text-text-muted flex items-center gap-2">
                    <span className="flex-1 truncate" title={pat.name}>{pat.name}</span>
                    <span className="font-mono" title={`${pat.occurrences} occurrences`}>×{pat.occurrences}</span>
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
    </div>
  );
}
