import { Shield } from 'lucide-react';
import type { InventoryConfig, EquipmentSlotConfig } from '@/lib/prompts/inventory';
import { EQUIP_POSITIONS } from './constants';

export function EquipSection({
  config,
  toggleEquipSlot,
  enabledEquip,
}: {
  config: InventoryConfig;
  toggleEquipSlot: (id: string) => void;
  enabledEquip: EquipmentSlotConfig[];
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-violet-950/20 border border-violet-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase text-violet-200 mb-1">Equipment Slot Configuration</h4>
          <p className="text-xs font-mono text-violet-400/60 leading-relaxed uppercase tracking-wider">
            Enable or disable specific anatomical hardpoints for equipable assets. Mapped to EEquipmentSlot definitions.
          </p>
        </div>
      </div>

      {/* Visual equipment preview */}
      <div className="p-8 bg-black/60 border border-violet-900/50 rounded-2xl shadow-[0_0_30px_rgba(167,139,250,0.1)_inset] relative text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 blur-[80px] pointer-events-none" />

        <div className="relative w-full max-w-[320px] h-[260px] mx-auto z-10">
          {/* Body silhouette */}
          <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <path
              d="M50 10 C50 10 42 16 42 26 L42 50 L35 60 L35 85 M50 10 C50 10 58 16 58 26 L58 50 L65 60 L65 85 M42 26 L22 32 M58 26 L78 32"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(79,70,229,0.5))' }}
            />
            {/* Head circle */}
            <circle cx="50" cy="7" r="4" fill="none" stroke="#a78bfa" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px rgba(79,70,229,0.5))' }} />
          </svg>

          {config.equipmentSlots.map((slot) => {
            const pos = EQUIP_POSITIONS[slot.id];
            if (!pos) return null;
            const isEnabled = slot.enabled;
            return (
              <button
                key={slot.id}
                onClick={() => toggleEquipSlot(slot.id)}
                className="absolute w-[44px] h-[44px] rounded-lg border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 group overflow-hidden"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  borderColor: isEnabled ? 'rgba(52,211,153,0.6)' : 'rgba(49,46,129,0.5)',
                  backgroundColor: isEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(0,0,0,0.6)',
                  boxShadow: isEnabled ? '0 0 15px rgba(52,211,153,0.2), inset 0 0 10px rgba(52,211,153,0.1)' : 'none',
                }}
                title={`${slot.label}`}
              >
                {isEnabled && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent pointer-events-none" />
                )}
                <span
                  className="text-[11px] font-bold uppercase tracking-wider relative z-10 transition-colors"
                  style={{ color: isEnabled ? '#6ee7b7' : 'rgba(156,163,175,0.5)' }}
                >
                  {pos.label.slice(0, 4)}
                </span>
                <span
                  className={`text-[11px] font-mono leading-none px-1.5 py-0.5 rounded ${isEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-violet-900/30 text-violet-400/50'}`}
                >
                  {isEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-violet-950/30 border border-violet-900/40 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-xs uppercase font-bold text-violet-200">
            ACTIVE_SLOTS: {enabledEquip.length}
          </span>
        </div>
      </div>
    </div>
  );
}
