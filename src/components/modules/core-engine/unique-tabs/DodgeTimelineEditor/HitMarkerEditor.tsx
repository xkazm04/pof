'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_ERROR,
  withOpacity, OPACITY_25, OPACITY_8, OPACITY_37,
} from '@/lib/chart-colors';
import type { DodgePhases, HitMarker } from '../dodge-types';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { PlayheadStats } from './types';

export function HitMarkerEditor({
  hitMarkers,
  phases,
  stats,
  onAdd,
  onRemove,
  onUpdate,
}: {
  hitMarkers: HitMarker[];
  phases: DodgePhases;
  stats: PlayheadStats;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof HitMarker, value: string | number) => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <BlueprintPanel color={STATUS_ERROR} className="p-3">
        <div className="flex items-center gap-2">
          <SectionHeader icon={AlertTriangle} label="Incoming Hit Timing" color={STATUS_ERROR} />
          <button
            onClick={onAdd}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors"
            style={{ borderColor: `${withOpacity(STATUS_ERROR, OPACITY_25)}`, backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_8)}`, color: STATUS_ERROR }}
          >
            <Plus className="w-3 h-3" />
            Add Hit
          </button>
        </div>

        <div className="space-y-1.5">
          {hitMarkers.map((hit) => {
            const dodged = hit.time >= phases.invuln.start && hit.time < phases.invuln.end;
            return (
              <div key={hit.id} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dodged ? ACCENT_EMERALD : STATUS_ERROR, boxShadow: `0 0 4px ${withOpacity(dodged ? ACCENT_EMERALD : STATUS_ERROR, OPACITY_37)}` }}
                />
                <input
                  type="text" value={hit.label}
                  onChange={(e) => onUpdate(hit.id, 'label', e.target.value)}
                  className="w-28 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                />
                <span className="text-xs text-text-muted">@</span>
                <input
                  type="number" value={hit.time} min={0} max={phases.totalTimeline} step={0.01}
                  onChange={(e) => onUpdate(hit.id, 'time', parseFloat(e.target.value) || 0)}
                  className="w-16 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none text-right"
                />
                <span className="text-xs text-text-muted">s</span>
                <input
                  type="number" value={hit.damage} min={0} max={999} step={1}
                  onChange={(e) => onUpdate(hit.id, 'damage', parseInt(e.target.value) || 0)}
                  className="w-14 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none text-right"
                />
                <span className="text-xs text-text-muted">dmg</span>
                <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] ml-auto" style={{ color: dodged ? ACCENT_EMERALD : STATUS_ERROR, textShadow: `0 0 12px ${withOpacity(dodged ? ACCENT_EMERALD : STATUS_ERROR, OPACITY_25)}` }}>
                  {dodged ? 'DODGED' : 'HIT'}
                </span>
                <button onClick={() => onRemove(hit.id)} className="text-text-muted hover:text-text transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {hitMarkers.length === 0 && (
            <p className="text-xs text-text-muted/50 py-2 text-center">No hit markers -- add one to simulate incoming attacks</p>
          )}
        </div>

        {hitMarkers.length > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 text-xs font-mono text-text-muted">
            <span>Total hits: <span className="font-bold text-text">{hitMarkers.length}</span></span>
            <span>Dodged: <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{stats.dodgedHits}</span></span>
            <span>Took damage: <span className="font-bold" style={{ color: STATUS_ERROR }}>{stats.totalHits - stats.dodgedHits}</span></span>
            <span>Damage avoided: <span className="font-bold" style={{ color: ACCENT_EMERALD }}>
              {hitMarkers.filter((h) => h.time >= phases.invuln.start && h.time < phases.invuln.end).reduce((sum, h) => sum + h.damage, 0)}
            </span></span>
          </div>
        )}
      </BlueprintPanel>
    </motion.div>
  );
}
