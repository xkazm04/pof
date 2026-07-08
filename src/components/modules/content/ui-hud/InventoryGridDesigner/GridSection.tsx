import type { Dispatch, SetStateAction } from 'react';
import { Check } from 'lucide-react';
import type { InventoryConfig, SlotTypeConfig, EquipmentSlotConfig } from '@/lib/prompts/inventory';
import { DimensionControl } from './DimensionControl';
import { EQUIP_POSITIONS, RARITY_COLORS } from './constants';

export function GridSection({
  config,
  setConfig,
  setCols,
  setRows,
  enabledSlots,
  enabledEquip,
  totalSlots,
}: {
  config: InventoryConfig;
  setConfig: Dispatch<SetStateAction<InventoryConfig>>;
  setCols: (v: number) => void;
  setRows: (v: number) => void;
  enabledSlots: SlotTypeConfig[];
  enabledEquip: EquipmentSlotConfig[];
  totalSlots: number;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Dimension controls */}
      <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-violet-900/30 backdrop-blur-md shadow-lg w-fit">
        <DimensionControl label="Columns" value={config.gridCols} onChange={setCols} min={2} max={12} />
        <span className="text-violet-500/50 text-xl font-light">Ă—</span>
        <DimensionControl label="Rows" value={config.gridRows} onChange={setRows} min={2} max={8} />
        <div className="ml-4 flex flex-col items-center">
          <span className="text-[11px] uppercase text-violet-400/60 font-bold mb-1">Total Capacity</span>
          <div className="flex items-center justify-center bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 rounded-lg text-violet-200 font-bold tracking-wider shadow-[inset_0_0_10px_rgba(167,139,250,0.1)]">
            {totalSlots} SLOTS
          </div>
        </div>
      </div>

      {/* Grid preview */}
      <div className="p-6 bg-black/60 border border-violet-900/50 rounded-2xl shadow-[0_0_30px_rgba(167,139,250,0.1)_inset] relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px] pointer-events-none" />

        <div className="text-xs uppercase text-violet-400 mb-6 font-bold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
          Live Matrix Preview
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          {/* Inventory grid */}
          <div className="p-4 bg-black/40 rounded-xl border border-violet-900/40 shadow-inner relative group">
            <div className="absolute inset-0 border border-violet-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_20px_rgba(167,139,250,0.1)]" />
            <div
              className="grid gap-1.5 relative z-10"
              style={{
                gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
                width: config.gridCols * 36 + (config.gridCols - 1) * 6,
              }}
            >
              {Array.from({ length: totalSlots }, (_, i) => {
                const slotType = enabledSlots[i % enabledSlots.length];
                return (
                  <div
                    key={i}
                    className="w-[36px] h-[36px] rounded-lg border transition-all duration-300 flex items-center justify-center relative group/slot overflow-hidden"
                    style={{
                      borderColor: slotType ? `${slotType.color}50` : 'rgba(49,46,129,0.4)',
                      backgroundColor: slotType ? `${slotType.color}15` : 'rgba(0,0,0,0.5)',
                      boxShadow: slotType ? `inset 0 0 10px ${slotType.color}20` : 'inset 0 0 10px rgba(49,46,129,0.1)',
                    }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover/slot:opacity-100 transition-opacity bg-white/5 pointer-events-none" />
                    {i < 3 && (
                      <div
                        className="w-5 h-5 rounded-md shadow-[0_0_10px_currentColor] transition-transform group-hover/slot:scale-110"
                        style={{
                          backgroundColor: RARITY_COLORS[config.itemRarities[i]] ?? 'var(--text-muted)',
                          color: RARITY_COLORS[config.itemRarities[i]] ?? 'var(--text-muted)'
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipment silhouette */}
          <div className="relative w-[160px] h-[160px] bg-black/40 rounded-xl border border-violet-900/40 flex-shrink-0 shadow-inner overflow-hidden flex items-center justify-center p-2">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.15)_0%,transparent_70%)] pointer-events-none" />
            {/* Body silhouette line */}
            <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <path
                d="M50 15 C50 15 42 20 42 30 L42 55 L35 65 L35 85 M50 15 C50 15 58 20 58 30 L58 55 L65 65 L65 85 M42 30 L25 35 M58 30 L75 35"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 4px rgba(79,70,229,0.6))' }}
              />
            </svg>
            {enabledEquip.map((slot) => {
              const pos = EQUIP_POSITIONS[slot.id];
              if (!pos) return null;
              return (
                <div
                  key={slot.id}
                  className="absolute w-[24px] h-[24px] rounded-md border border-amber-500/60 bg-amber-500/20 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.3)_inset] group/equip cursor-help"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={slot.label}
                >
                  <span className="text-[11px] text-amber-300 font-bold leading-none select-none uppercase">
                    {pos.label.slice(0, 3)}
                  </span>
                  <div className="absolute inset-0 border border-amber-400/50 rounded-md animate-ping opacity-20 pointer-events-none" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stack config */}
      <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-violet-900/30 backdrop-blur-md shadow-lg w-fit">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center w-5 h-5">
            <input
              type="checkbox"
              checked={config.stackable}
              onChange={(e) => setConfig((c) => ({ ...c, stackable: e.target.checked }))}
              className="peer appearance-none w-5 h-5 border border-violet-900/60 rounded bg-black/50 checked:bg-violet-500/20 checked:border-violet-500 transition-all outline-none cursor-pointer shadow-inner"
            />
            <Check className="w-3 h-3 text-violet-400 absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity drop-shadow-[0_0_2px_rgba(167,139,250,0.8)]" />
          </div>
          <span className="text-[11px] font-bold uppercase text-violet-200 group-hover:text-white transition-colors">Stackable Assets</span>
        </label>

        {config.stackable && (
          <div className="flex items-center gap-3 pl-6 border-l border-violet-900/40">
            <span className="text-xs font-bold uppercase text-violet-400/80">Stack Limit:</span>
            <input
              type="number"
              value={config.maxStackSize}
              onChange={(e) => setConfig((c) => ({ ...c, maxStackSize: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) }))}
              className="w-20 px-3 py-1.5 bg-black/50 border border-violet-900/60 rounded-lg text-[11px] font-mono text-violet-200 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/50 transition-all shadow-inner text-center"
            />
          </div>
        )}
      </div>
    </div>
  );
}
