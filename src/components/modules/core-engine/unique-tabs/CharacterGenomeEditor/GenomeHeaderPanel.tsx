'use client';

import { Download, Trash2, Share2 } from 'lucide-react';
import { ACCENT_EMERALD, ACCENT_CYAN, STATUS_ERROR, OVERLAY_WHITE,
  withOpacity, OPACITY_37, OPACITY_10, OPACITY_25, OPACITY_8, GLOW_MD,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import { RadarChart } from '../_shared';
import type { CharacterGenome } from '@/types/character-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { ACCENT, genomeToRadar } from './field-data';

/* ── Genome Header + Radar Overview ──────────────────────────────────── */

interface RadarOverlay { data: RadarDataPoint[]; color: string; label: string }

interface GenomeHeaderPanelProps {
  activeGenome: CharacterGenome;
  genomes: CharacterGenome[];
  resolvedActiveId: string;
  compareIds: string[];
  compareIdSet: Set<string>;
  radarOverlays: RadarOverlay[];
  onUpdateGenome: (id: string, updater: (g: CharacterGenome) => CharacterGenome) => void;
  onExport: (genome: CharacterGenome) => void;
  onDelete: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onClearCompare: () => void;
}

export function GenomeHeaderPanel({
  activeGenome, genomes, resolvedActiveId, compareIds, compareIdSet,
  radarOverlays, onUpdateGenome, onExport, onDelete, onToggleCompare, onClearCompare,
}: GenomeHeaderPanelProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
      <BlueprintPanel color={activeGenome.color} className="p-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeGenome.color, boxShadow: `${GLOW_MD} ${withOpacity(activeGenome.color, OPACITY_37)}` }} />
              <input type="text" value={activeGenome.name} onChange={(e) => onUpdateGenome(resolvedActiveId, (g) => ({ ...g, name: e.target.value }))}
                className="text-sm font-bold bg-transparent border-none text-text focus:outline-none px-0" />
            </div>
            <input type="text" value={activeGenome.description} onChange={(e) => onUpdateGenome(resolvedActiveId, (g) => ({ ...g, description: e.target.value }))}
              placeholder="Describe this archetype..." className="w-full text-xs font-mono bg-transparent border-none text-text-muted focus:outline-none placeholder:text-text-muted/40 px-0" />
            <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
              <span>v{activeGenome.version}</span>
              <span>by {activeGenome.author}</span>
              {(activeGenome.tags?.length ?? 0) > 0 && (
                <div className="flex gap-1">
                  {activeGenome.tags!.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${withOpacity(activeGenome.color, OPACITY_10)}`, color: activeGenome.color }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => onExport(activeGenome)} className="p-1.5 rounded-lg border transition-colors hover:brightness-110"
              style={{ borderColor: `${withOpacity(ACCENT_EMERALD, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_EMERALD, OPACITY_8)}`, color: ACCENT_EMERALD }} title="Export JSON">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(activeGenome, null, 2))}
              className="p-1.5 rounded-lg border transition-colors hover:brightness-110"
              style={{ borderColor: `${withOpacity(ACCENT_CYAN, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_8)}`, color: ACCENT_CYAN }} title="Copy JSON to clipboard">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(resolvedActiveId)} disabled={genomes.length <= 1}
              className="p-1.5 rounded-lg border transition-colors hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: `${withOpacity(STATUS_ERROR, OPACITY_25)}`, backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_8)}`, color: STATUS_ERROR }} title="Delete genome">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Compare:</span>
          <button onClick={onClearCompare} className="px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors"
            style={{ backgroundColor: compareIds.length === 0 ? `${withOpacity(ACCENT, OPACITY_10)}` : 'transparent', color: compareIds.length === 0 ? ACCENT : 'var(--text-muted)',
              border: `1px solid ${compareIds.length === 0 ? withOpacity(ACCENT, OPACITY_25) : withOpacity(OVERLAY_WHITE, OPACITY_8)}` }}>All</button>
          {genomes.filter((g) => g.id !== resolvedActiveId).map((g) => {
            const sel = compareIdSet.has(g.id);
            return (
              <button key={g.id} onClick={() => onToggleCompare(g.id)} className="px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors"
                style={{ backgroundColor: sel ? `${withOpacity(g.color, OPACITY_10)}` : 'transparent', color: sel ? g.color : 'var(--text-muted)',
                  border: `1px solid ${sel ? withOpacity(g.color, OPACITY_25) : withOpacity(OVERLAY_WHITE, OPACITY_8)}` }}>{g.name}</button>
            );
          })}
          {compareIds.length > 0 && <span className="text-xs font-mono text-text-muted/50 ml-1">{compareIds.length}/4</span>}
        </div>
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT} className="p-3 flex flex-col items-center justify-center">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Archetype Radar</div>
        <RadarChart data={genomeToRadar(activeGenome)} accent={activeGenome.color} overlays={radarOverlays} size={160} />
        <div className="flex flex-wrap gap-2 mt-2 justify-center">
          <span className="flex items-center gap-1 text-xs font-mono font-bold" style={{ color: activeGenome.color }}>
            <span className="w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: activeGenome.color, borderColor: activeGenome.color }} />
            {activeGenome.name}
          </span>
          {radarOverlays.map((o) => (
            <span key={o.label} className="flex items-center gap-1 text-xs font-mono" style={{ color: o.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color, opacity: 0.6 }} />{o.label}
            </span>
          ))}
        </div>
      </BlueprintPanel>
    </div>
  );
}
