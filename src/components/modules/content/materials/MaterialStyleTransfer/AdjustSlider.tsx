export function AdjustSlider({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const isModified = value !== defaultValue;
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-28 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-amber-400 cursor-pointer"
      />
      <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 ${isModified ? 'text-amber-400' : 'text-text-muted'}`}>
        {value > 1 ? value.toFixed(1) : value.toFixed(2)}
      </span>
      {isModified && (
        <button onClick={onReset} className="text-2xs text-text-muted hover:text-text transition-colors">
          ×
        </button>
      )}
    </div>
  );
}
