'use client';

import { ACCENT_CYAN, ACCENT_EMERALD } from '@/lib/chart-colors';
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';
import { ARCHETYPE_COLORS, ARCHETYPE_ICONS } from './types';

/* ── Archetype Palette ──────────────────────────────────────────────────── */

export function ArchetypePalette({ selectedArchetype, onSelectArchetype, placeLevel, onPlaceLevel, playerLevel, onPlayerLevel }: {
  selectedArchetype: string; onSelectArchetype: (id: string) => void;
  placeLevel: number; onPlaceLevel: (v: number) => void;
  playerLevel: number; onPlayerLevel: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5 shrink-0">
      <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Archetype</div>
      {ENEMY_ARCHETYPES.map((arch) => {
        const color = ARCHETYPE_COLORS[arch.id] ?? ACCENT_CYAN;
        const isActive = selectedArchetype === arch.id;
        return (
          <button key={arch.id} onClick={() => onSelectArchetype(arch.id)}
            className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-mono font-bold rounded-md border transition-colors text-left"
            style={{ borderColor: isActive ? color : 'var(--border)', backgroundColor: isActive ? `${color}15` : 'transparent', color: isActive ? color : 'var(--text-muted)' }}>
            <span className="w-4 h-4 rounded-sm flex items-center justify-center text-xs"
              style={{ backgroundColor: `${color}30`, color }}>{ARCHETYPE_ICONS[arch.id]}</span>
            {arch.name}
          </button>
        );
      })}
      <div className="h-px bg-border/30" />
      <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Level</div>
      <div className="flex items-center gap-1">
        <input type="range" min={1} max={20} value={placeLevel} onChange={(e) => onPlaceLevel(Number(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none bg-border cursor-pointer" style={{ accentColor: ACCENT_CYAN }} />
        <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: ACCENT_CYAN }}>{placeLevel}</span>
      </div>
      <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Player Lv</div>
      <div className="flex items-center gap-1">
        <input type="range" min={1} max={20} value={playerLevel} onChange={(e) => onPlayerLevel(Number(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none bg-border cursor-pointer" style={{ accentColor: ACCENT_EMERALD }} />
        <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: ACCENT_EMERALD }}>{playerLevel}</span>
      </div>
    </div>
  );
}

/* ── Ghost Legend ────────────────────────────────────────────────────────── */

export function GhostLegend({ selectedWave, totalWaves }: { selectedWave: number; totalWaves: number }) {
  return (
    <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-[0.15em] text-text-muted/60 pt-1 border-t border-border/20 flex-wrap">
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border-2 cursor-grab" style={{ borderColor: ACCENT_EMERALD, backgroundColor: `${ACCENT_EMERALD}20` }} />
        drag to reposition
      </span>
      {selectedWave > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border border-dashed border-text-muted/30" style={{ opacity: 0.45 }} />
          prev wave ghost
        </span>
      )}
      {selectedWave < totalWaves - 1 && (
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border border-dashed border-text-muted/30 animate-pulse" />
          next wave pulse
        </span>
      )}
    </div>
  );
}
