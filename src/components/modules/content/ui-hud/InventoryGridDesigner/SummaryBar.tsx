import { Send, Loader2 } from 'lucide-react';
import type { InventoryConfig, SlotTypeConfig, EquipmentSlotConfig } from '@/lib/prompts/inventory';
import { STATUS_STALE } from '@/lib/chart-colors';

export function SummaryBar({
  config,
  totalSlots,
  enabledSlots,
  enabledEquip,
  onGenerate,
  isGenerating,
}: {
  config: InventoryConfig;
  totalSlots: number;
  enabledSlots: SlotTypeConfig[];
  enabledEquip: EquipmentSlotConfig[];
  onGenerate: (config: InventoryConfig) => void;
  isGenerating: boolean;
}) {
  return (
    <div className="relative z-10 pt-6 mt-6 border-t border-violet-900/40">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono uppercase text-violet-400/80">
          <span className="bg-violet-950/40 px-2 py-1 rounded border border-violet-900/30">GRID: <span className="text-violet-200 font-bold">{config.gridCols}Ă—{config.gridRows} ({totalSlots})</span></span>
          <span className="bg-violet-950/40 px-2 py-1 rounded border border-violet-900/30">TYPES: <span className="text-violet-200 font-bold">{enabledSlots.length}</span></span>
          <span className="bg-violet-950/40 px-2 py-1 rounded border border-violet-900/30">EQUIP: <span className="text-violet-200 font-bold">{enabledEquip.length}</span></span>
          <span className="bg-violet-950/40 px-2 py-1 rounded border border-violet-900/30">INTERACT: <span className="text-violet-200 font-bold">{config.interactions.length}</span></span>
        </div>
      </div>
      <button
        onClick={() => onGenerate(config)}
        disabled={isGenerating}
        className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50 group outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#03030a]"
        style={{
          backgroundColor: 'rgba(167,139,250,0.15)',
          color: STATUS_STALE,
          border: '1px solid rgba(167,139,250,0.5)',
          boxShadow: '0 0 20px rgba(167,139,250,0.2), inset 0 0 10px rgba(167,139,250,0.1)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin drop-shadow-[0_0_8px_currentColor]" />
            COMPILING_SYSTEM...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform drop-shadow-[0_0_8px_currentColor]" />
            INITIALIZE_BUILD_SEQUENCE
          </>
        )}
      </button>
    </div>
  );
}
