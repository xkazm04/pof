import type { SlotTypeConfig } from '@/lib/prompts/inventory';

export function SlotTypeToggle({ slot, onToggle }: { slot: SlotTypeConfig; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left shadow-inner hover:brightness-110"
      style={{
        borderColor: slot.enabled ? `${slot.color}60` : 'rgba(49,46,129,0.4)',
        backgroundColor: slot.enabled ? `${slot.color}15` : 'rgba(0,0,0,0.4)',
        boxShadow: slot.enabled ? `inset 0 0 15px ${slot.color}10` : 'none',
      }}
    >
      <div
        className="w-4 h-4 rounded-md flex-shrink-0 transition-all duration-300 shadow-[inset_0_0_4px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: slot.enabled ? slot.color : 'rgba(30,27,75,0.8)',
          boxShadow: slot.enabled ? `0 0 10px ${slot.color}80` : 'none',
        }}
      />
      <span
        className="text-[11px] font-bold uppercase transition-colors drop-shadow-md"
        style={{ color: slot.enabled ? 'white' : 'rgba(156,163,175,0.6)', textShadow: slot.enabled ? `0 0 8px ${slot.color}80` : 'none' }}
      >
        {slot.label}
      </span>
    </button>
  );
}
