// ── Shared UI components ──

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

export function SliderField({
  label, value, min, max, step, onChange, suffix, displayValue,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string; displayValue?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">{label}</span>
        <span className="text-xs text-text-muted-hover tabular-nums">{displayValue ?? value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-border accent-blue-400 focus-ring"
      />
    </div>
  );
}

export function ActionButton({
  label, onClick, disabled, accentColor, icon,
}: {
  label: string; onClick: () => void; disabled: boolean; accentColor: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
      style={{
        backgroundColor: `${accentColor}24`,
        color: accentColor,
        border: `1px solid ${accentColor}38`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
