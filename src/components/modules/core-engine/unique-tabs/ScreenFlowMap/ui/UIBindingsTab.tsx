'use client';

import { useState } from 'react';
import { Smartphone, GitBranch, Link2, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_PINK, ACCENT_CYAN, ACCENT_CYAN_LIGHT, OVERLAY_WHITE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { InteractivePill } from '@/components/ui/InteractivePill';
import {
  BREAKPOINTS, BREAKPOINT_PILLS, BREAKPOINT_WIDGETS,
  SM_NODES, SM_EDGES, INPUT_MODE_COLORS,
  WIDGET_BINDINGS, ANIM_CATALOG,
} from '../data';
import type { InputMode } from '../data';

const ACCENT = ACCENT_PINK;

export function UIBindingsTab() {
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(1);
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>('Game');

  return (
    <motion.div key="ui" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader label="Responsive Breakpoints" color={ACCENT} icon={Smartphone} />
          <div className="mb-2.5">
            <InteractivePill items={BREAKPOINT_PILLS} activeIndex={selectedBreakpoint} onChange={setSelectedBreakpoint} accent={ACCENT} layoutId="breakpoint-pill" />
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-2 text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted px-2 pb-1 border-b border-border/30">
              <span>Widget</span><span>MinRes</span><span>Scale</span><span>Status</span>
            </div>
            {BREAKPOINT_WIDGETS.map((w, i) => {
              const minIdx = BREAKPOINTS.findIndex(b => b.label === w.minRes);
              const isActive = selectedBreakpoint >= minIdx;
              const statusColor = w.status === 'ok' ? STATUS_SUCCESS : w.status === 'warn' ? STATUS_WARNING : STATUS_ERROR;
              return (
                <motion.div key={w.widget} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="grid grid-cols-4 gap-2 text-xs font-mono px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors"
                  style={{ opacity: isActive ? 1 : 0.4 }}>
                  <span className="text-text font-medium truncate">{w.widget}</span>
                  <span className="text-text-muted">{w.minRes}</span>
                  <span className="text-text-muted">{w.scaleMode}</span>
                  <span>
                    <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-bold border"
                      style={{ backgroundColor: `${withOpacity(statusColor, OPACITY_10)}`, color: statusColor, borderColor: `${withOpacity(statusColor, OPACITY_20)}` }}>
                      {w.status === 'ok' ? 'OK' : w.status === 'warn' ? 'WARN' : 'FAIL'}
                    </span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </BlueprintPanel>

        <BlueprintPanel color={ACCENT} className="p-3">
          <SectionHeader label="Input Mode SM" color={ACCENT} icon={GitBranch} />
          <div className="flex justify-center mb-2.5 min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
            <svg width={280} height={160} viewBox="0 0 280 160" className="overflow-visible">
              <style>{`g.sm-node:focus { outline: none; } g.sm-node:focus-visible .focus-ring { opacity: 0.6; }`}</style>
              {(() => {
                const positions: Record<InputMode, { x: number; y: number }> = { Game: { x: 80, y: 50 }, UI: { x: 240, y: 50 }, GameAndUI: { x: 160, y: 170 } };
                return (
                  <>
                    {SM_EDGES.map((edge, i) => {
                      const from = positions[edge.from];
                      const to = positions[edge.to];
                      const mx = (from.x + to.x) / 2;
                      const my = (from.y + to.y) / 2;
                      const isActive = currentInputMode === edge.from;
                      const dx = to.x - from.x;
                      const dy = to.y - from.y;
                      const len = Math.sqrt(dx * dx + dy * dy) || 1;
                      const offsetSign = i % 2 === 0 ? 1 : -1;
                      const perpX = (-dy / len) * 8 * offsetSign;
                      const perpY = (dx / len) * 8 * offsetSign;
                      return (
                        <g key={`sm-edge-${i}`}>
                          <line x1={from.x + perpX} y1={from.y + perpY} x2={to.x + perpX} y2={to.y + perpY}
                            stroke={isActive ? INPUT_MODE_COLORS[edge.from] : withOpacity(OVERLAY_WHITE, OPACITY_10)}
                            strokeWidth={isActive ? 2 : 1} strokeDasharray="4 3" markerEnd="url(#sm-arrow)" />
                          <text x={mx + perpX} y={my + perpY - 4} textAnchor="middle"
                            className="text-xs font-mono"
                            fill={isActive ? INPUT_MODE_COLORS[edge.from] : 'var(--text-muted)'}>{edge.trigger}</text>
                        </g>
                      );
                    })}
                    <defs>
                      <marker id="sm-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
                      </marker>
                    </defs>
                    {SM_NODES.map((node) => {
                      const pos = positions[node.id];
                      const color = INPUT_MODE_COLORS[node.id];
                      const isActive = currentInputMode === node.id;
                      return (
                        <g key={node.id}
                          onClick={() => setCurrentInputMode(node.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentInputMode(node.id); } }}
                          tabIndex={0} role="button" aria-label={`Switch to ${node.label} input mode`}
                          className="sm-node cursor-pointer">
                          <circle className="focus-ring" cx={pos.x} cy={pos.y} r={(isActive ? 32 : 28) + 5}
                            fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 3" opacity={0}
                            style={{ transition: 'opacity 0.15s' }} />
                          <circle cx={pos.x} cy={pos.y} r={isActive ? 32 : 28}
                            fill={`${color}${isActive ? '30' : '15'}`} stroke={color}
                            strokeWidth={isActive ? 3 : 1.5}
                            style={{ filter: isActive ? `drop-shadow(0 0 12px ${color})` : 'none', transition: 'all 0.2s' }} />
                          <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                            className="text-xs font-mono font-bold pointer-events-none" fill={color}>{node.label}</text>
                          {isActive && <circle cx={pos.x} cy={pos.y} r={36} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity={0.4} />}
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="text-center text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Current Mode: <span className="font-bold" style={{ color: INPUT_MODE_COLORS[currentInputMode] }}>{currentInputMode}</span>
            <span className="ml-2 opacity-60">(click nodes to switch)</span>
          </div>
        </BlueprintPanel>
      </div>

      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader label="Widget Binding Inspector" color={ACCENT} icon={Link2} />
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-2 py-2 text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Widget</th>
                <th className="text-left px-2 py-2 text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Attribute</th>
                <th className="text-left px-2 py-2 text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Method</th>
                <th className="text-left px-2 py-2 text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Frequency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {WIDGET_BINDINGS.map((w, i) => (
                <motion.tr key={w.widget} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="hover:bg-surface-hover/30 transition-colors group">
                  <td className="px-2 py-2"><span className="text-text font-bold">{w.widget}</span></td>
                  <td className="px-2 py-2"><span className="px-1.5 py-0.5 bg-surface-deep rounded border border-border/40 text-xs text-text-muted">{w.attribute}</span></td>
                  <td className="px-2 py-2"><span className="text-xs" style={{ color: w.updateMethod === 'Delegate' ? STATUS_SUCCESS : w.updateMethod === 'Poll' ? STATUS_WARNING : ACCENT_CYAN }}>{w.updateMethod}</span></td>
                  <td className="px-2 py-2 flex items-center gap-2">
                    <span className="text-text-muted text-xs">{w.frequency}</span>
                    {w.isStale && <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-mono uppercase tracking-[0.15em] font-bold border" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10), color: STATUS_WARNING, borderColor: withOpacity(STATUS_WARNING, OPACITY_20) }}>Stale</span>}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader label="Animation/Transition Catalog" color={ACCENT} icon={PlayCircle} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ANIM_CATALOG.map((anim, i) => (
            <motion.div key={anim.widget} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              className="bg-surface/50 rounded-lg border border-border/40 p-3 hover:border-border/80 transition-colors">
              <div className="text-xs font-bold text-text mb-2 truncate">{anim.widget}</div>
              <div className="flex flex-col gap-1.5 text-xs font-mono text-text-muted">
                <div className="flex justify-between"><span>Open:</span><span style={{ color: ACCENT_CYAN_LIGHT }}>{anim.openAnim}</span></div>
                <div className="flex justify-between"><span>Close:</span><span style={{ color: ACCENT_PINK }}>{anim.closeAnim}</span></div>
                <div className="h-px w-full bg-border/30 my-0.5" />
                <div className="flex justify-between"><span>Timing:</span><span>{anim.duration} @ {anim.easing}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
