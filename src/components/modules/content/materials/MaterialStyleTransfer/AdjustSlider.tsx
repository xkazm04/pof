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
  const format = (v: number) => (v > 1 ? v.toFixed(1) : v.toFixed(2));
  const display = format(value);
  // A bare number tells a screen-reader user nothing about the scale, nor whether
  // this value still matches what the analysis inferred.
  const valueText = `${display} of ${min} to ${max}${
    isModified ? `, adjusted from the analyzed ${format(defaultValue)}` : ', as analyzed'
  }`;
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
        aria-label={label}
        aria-valuetext={valueText}
        className="focus-ring flex-1 h-1 accent-amber-400 cursor-pointer"
      />
      <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 ${isModified ? 'text-amber-400' : 'text-text-muted'}`}>
        {display}
      </span>
      {isModified && (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Reset ${label} to the analyzed value ${format(defaultValue)}`}
          className="focus-ring text-2xs text-text-muted hover:text-text transition-colors"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
