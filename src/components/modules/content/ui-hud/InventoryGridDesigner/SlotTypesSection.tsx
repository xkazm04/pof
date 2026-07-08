import { Package, Zap } from 'lucide-react';
import type { InventoryConfig } from '@/lib/prompts/inventory';
import { SlotTypeToggle } from './SlotTypeToggle';
import { RARITY_COLORS } from './constants';

export function SlotTypesSection({
  config,
  toggleSlotType,
}: {
  config: InventoryConfig;
  toggleSlotType: (id: string) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-violet-950/20 border border-violet-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase text-violet-200 mb-1">Supported Asset Classifications</h4>
          <p className="text-xs font-mono text-violet-400/60 leading-relaxed uppercase tracking-wider">
            Define the permissible item typologies managed by this grid. Mapped directly to EItemType enumerations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {config.slotTypes.map((slot) => (
          <SlotTypeToggle
            key={slot.id}
            slot={slot}
            onToggle={() => toggleSlotType(slot.id)}
          />
        ))}
      </div>

      {/* Rarity configuration */}
      <div className="mt-8 p-6 bg-black/40 border border-violet-900/40 rounded-2xl shadow-inner">
        <div className="text-xs uppercase text-violet-400 font-bold mb-4 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Rarity Tiers Mapping
        </div>
        <div className="flex flex-wrap gap-2.5">
          {config.itemRarities.map((rarity) => (
            <span
              key={rarity}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase border shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]"
              style={{
                color: RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)',
                borderColor: `${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}40`,
                backgroundColor: `${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}15`,
                textShadow: `0 0 10px ${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}`,
              }}
            >
              {rarity}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
