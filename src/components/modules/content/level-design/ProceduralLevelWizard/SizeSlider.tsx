// ── Size Slider ──

export function SizeSlider({
  label, value, min, max, step, onChange, color,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color: string;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative overflow-hidden group">
      {/* Animated scanline effect on hover */}
      <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 pointer-events-none" />

      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-[11px] font-bold text-violet-300 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-violet-900/30" style={{ color }}>{value}</span>
      </div>

      <div className="relative h-1.5 rounded-full bg-violet-900/30 overflow-hidden mt-1 backdrop-blur-sm shadow-inner z-10">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(currentColor,0.5)] bg-gradient-to-r from-violet-600 to-violet-400"
          style={{ width: `${percent}%`, color }}
        />
      </div>

      <div className="flex justify-between mt-1.5 opacity-50 relative z-10">
        <span className="text-[11px] font-mono text-violet-200">{min}</span>
        <span className="text-[11px] font-mono text-violet-200">{max}</span>
      </div>
    </div>
  );
}
