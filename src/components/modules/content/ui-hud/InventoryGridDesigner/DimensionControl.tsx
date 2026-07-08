import { Plus, Minus } from 'lucide-react';

export function DimensionControl({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2 flex flex-col items-center">
      <div className="text-xs uppercase text-violet-400 font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)]">{label}</div>
      <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-lg border border-violet-900/60 shadow-inner">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="w-7 h-7 rounded-md bg-violet-950/40 border border-violet-900/40 flex items-center justify-center text-violet-400 hover:text-white hover:bg-violet-600/30 hover:border-violet-500/50 disabled:opacity-30 transition-all"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-[13px] font-bold text-white">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="w-7 h-7 rounded-md bg-violet-950/40 border border-violet-900/40 flex items-center justify-center text-violet-400 hover:text-white hover:bg-violet-600/30 hover:border-violet-500/50 disabled:opacity-30 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
