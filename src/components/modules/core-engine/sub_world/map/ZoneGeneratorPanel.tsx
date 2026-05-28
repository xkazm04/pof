'use client';

import { useMemo, useState } from 'react';
import { Wand2, RefreshCw, Pin, Trash2 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_VIOLET, withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ZoneMapCanvas } from './MapCanvas';
import {
  generateZoneGraph, validateZoneGraph,
  type ZoneGraphParams, type ZoneTopology, type DifficultyCurve, type GeneratedZone,
} from '@/lib/world/zone-graph-generator';
import { useCRUD } from '@/hooks/useCRUD';
import type { ZoneGraphPin } from '@/types/procgen';

const ACCENT = ACCENT_VIOLET;
const TOPOLOGIES: ZoneTopology[] = ['linear', 'hub-and-spoke', 'metroidvania'];
const CURVES: DifficultyCurve[] = ['gentle', 'linear', 'steep'];
const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

export function ZoneGeneratorPanel() {
  const [params, setParams] = useState<ZoneGraphParams>({
    zoneCount: 6, branchiness: 0.4, topology: 'metroidvania', difficulty: 'linear', maxLevel: 30, seed: 1337,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const zones = useMemo(() => generateZoneGraph(params), [params]);
  const validation = useMemo(() => validateZoneGraph(zones), [zones]);
  const selected: GeneratedZone = zones.find((z) => z.id === selectedId) ?? zones[0];

  const { data: pins, mutate } = useCRUD<ZoneGraphPin[]>('/api/procgen/zone-pins', []);

  const set = <K extends keyof ZoneGraphParams>(k: K, v: ZoneGraphParams[K]) => setParams((p) => ({ ...p, [k]: v }));
  const reroll = () => setParams((p) => ({ ...p, seed: randomSeed() }));
  const pinCurrent = () =>
    mutate('/api/procgen/zone-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: params.seed, params, label: `${params.topology} ×${params.zoneCount}`, zoneCount: params.zoneCount, topology: params.topology }),
    });
  const restorePin = (pin: ZoneGraphPin) => setParams(pin.params);
  const removePin = (id: number) => mutate(`/api/procgen/zone-pins?id=${id}`, { method: 'DELETE' });

  const statusColor = validation.errors > 0 ? STATUS_ERROR : validation.warnings > 0 ? STATUS_WARNING : STATUS_SUCCESS;

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={Wand2} label="Procedural Zone Generator" color={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
        {/* Controls */}
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Zones: {params.zoneCount}</span>
            <input type="range" min={2} max={14} value={params.zoneCount} onChange={(e) => set('zoneCount', Number(e.target.value))} className="w-full" style={{ accentColor: ACCENT }} />
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Branchiness: {params.branchiness.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.05} value={params.branchiness} onChange={(e) => set('branchiness', Number(e.target.value))} className="w-full" style={{ accentColor: ACCENT }} />
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Topology</span>
            <select value={params.topology} onChange={(e) => set('topology', e.target.value as ZoneTopology)} className="w-full bg-surface-deep border border-border rounded px-2 py-1 text-text">
              {TOPOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Difficulty curve</span>
            <select value={params.difficulty} onChange={(e) => set('difficulty', e.target.value as DifficultyCurve)} className="w-full bg-surface-deep border border-border rounded px-2 py-1 text-text">
              {CURVES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={reroll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }}>
              <RefreshCw className="w-3 h-3" /> Reroll
            </button>
            <button onClick={pinCurrent} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }}>
              <Pin className="w-3 h-3" /> Pin
            </button>
            <span className="text-text-muted font-mono">seed {params.seed}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 space-y-2">
          <div className="w-full aspect-video bg-surface-deep/30 rounded-xl relative overflow-hidden border border-border/60 min-h-[200px]">
            <ZoneMapCanvas zones={zones} selectedZone={selected} onSelectZone={(z) => setSelectedId(z.id)} />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: statusColor }} data-testid="zone-gen-validation">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
            {validation.ok ? 'Progression-valid' : `${validation.errors} error(s)`} · {validation.warnings} warning(s)
          </div>
        </div>
      </div>

      {/* Seed gallery */}
      {pins.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Seed gallery</div>
          <div className="flex flex-wrap gap-2">
            {pins.map((pin) => (
              <span key={pin.id} className="flex items-center gap-1.5 text-xs bg-surface-hover px-2 py-1 rounded border border-border/40">
                <button onClick={() => restorePin(pin)} className="text-text hover:text-text" title="Restore this seed + params">
                  {pin.label || `seed ${pin.seed}`}
                </button>
                <button onClick={() => removePin(pin.id)} className="text-text-muted hover:text-text" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </BlueprintPanel>
  );
}
