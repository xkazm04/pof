// ── Shared UI components ──

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

const LABEL_CLASS = 'text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold';
const FORM_CONTROLS = new Set(['input', 'select', 'textarea']);
const isControl = (n: ReactNode): n is ReactElement<{ id?: string }> =>
  isValidElement(n) && typeof n.type === 'string' && FORM_CONTROLS.has(n.type);

/**
 * A labelled field. A Field with exactly ONE direct form control (hint text beside it
 * is fine) binds its label to it
 * (`htmlFor` + the control's `id`), so clicking the label focuses the control.
 * Any other child (a chip grid) is a group the label names via `aria-labelledby`;
 * an orphan <label> would point at nothing.
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const kids = Children.toArray(children);
  if (kids.filter(isControl).length === 1) {
    return (
      <div>
        <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
        {kids.map((k) => (isControl(k) ? cloneElement(k, { id }) : k))}
      </div>
    );
  }
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className={LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}

export function SliderField({
  label, value, min, max, step, onChange, onRelease, suffix, displayValue,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  /**
   * The gesture ended (pointer up, key up, blur) — the commit boundary of a
   * drag. `onChange` fires per frame and must stay local; this is where the
   * write belongs. Optional so a slider rendered without a commit buffer
   * behaves exactly as it did before.
   */
  onRelease?: () => void;
  suffix?: string; displayValue?: number;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-2xs uppercase tracking-wider text-text-muted font-semibold">{label}</label>
        <span className="text-xs text-text-muted-hover tabular-nums">{displayValue ?? value}{suffix}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        onBlur={onRelease}
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50 focus-ring"
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
