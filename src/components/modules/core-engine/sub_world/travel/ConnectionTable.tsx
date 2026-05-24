'use client';

import { ArrowRightLeft, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import {
  STATUS_SUCCESS,
  ACCENT_VIOLET,
  OPACITY_8, OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ZONE_CONNECTIONS, TRANSITION_COLORS } from '../_shared/data';

export function ConnectionTable() {
  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <SectionHeader icon={ArrowRightLeft} label="Zone Connection Visualizer" color={ACCENT_VIOLET} />
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">From</th>
              <th className="text-center py-2 px-2" />
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">To</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Type</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Est. Time</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">NavMesh</th>
            </tr>
          </thead>
          <tbody>
            {ZONE_CONNECTIONS.map((conn, i) => {
              const typeColor = TRANSITION_COLORS[conn.transitionType];
              return (
                <tr key={i} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                  <td className="py-2 px-2 text-text">{conn.from}</td>
                  <td className="py-2 px-2 text-center">
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted inline-block" />
                  </td>
                  <td className="py-2 px-2 text-text">{conn.to}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: withOpacity(typeColor, OPACITY_8), color: typeColor, border: `1px solid ${withOpacity(typeColor, OPACITY_20)}` }}>
                      {conn.transitionType}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-text-muted">{conn.estTime}</td>
                  <td className="py-2 px-2 text-center">
                    {conn.navMeshContinuity ? (
                      <CheckCircle2 className="w-3.5 h-3.5 inline-block" style={{ color: STATUS_SUCCESS }} />
                    ) : (
                      <Circle className="w-3.5 h-3.5 inline-block text-text-muted opacity-40" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlueprintPanel>
  );
}
