// ── Size Slider ──

interface SizeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color: string;
  /**
   * Why this parameter does nothing for the CURRENT algorithm. When set, the
   * slider is disabled and the reason is rendered — a control that cannot move
   * anything must say so rather than accept a drag and discard it.
   */
  disabledReason?: string | null;
  testId?: string;
}

export function SizeSlider({
  label, value, min, max, step, onChange, color, disabledReason = null, testId,
}: SizeSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const disabled = !!disabledReason;
  const reasonId = testId ? `${testId}-reason` : undefined;

  return (
    <div
      data-testid={testId}
      data-disabled={disabled ? 'true' : 'false'}
      className={`px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative overflow-hidden group ${disabled ? 'opacity-60' : ''}`}
    >
      {/* Animated scanline effect on hover */}
      <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 pointer-events-none" />

      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-violet-900/30" style={{ color }}>
          {disabled ? 'n/a' : value}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-violet-900/30 overflow-hidden mt-1 backdrop-blur-sm shadow-inner z-10">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-describedby={disabled ? reasonId : undefined}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className={`absolute inset-0 w-full h-full opacity-0 z-20 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        />
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(currentColor,0.5)] bg-gradient-to-r from-violet-600 to-violet-400"
          style={{ width: `${disabled ? 0 : percent}%`, color }}
        />
      </div>

      {disabled ? (
        <p id={reasonId} data-testid={reasonId} className="text-xs text-violet-300/70 mt-2 leading-relaxed relative z-10">
          {disabledReason}
        </p>
      ) : (
        <div className="flex justify-between mt-1.5 opacity-50 relative z-10">
          <span className="text-xs font-mono text-violet-200">{min}</span>
          <span className="text-xs font-mono text-violet-200">{max}</span>
        </div>
      )}
    </div>
  );
}
