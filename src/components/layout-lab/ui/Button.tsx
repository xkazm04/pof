import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'solid' | 'ghost' | 'accent';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  active?: boolean;
  /** Single-select member (segmented view switch): the chosen option gets aria-current and the accent fill; the others carry no state. Use `active` only for an independent on/off toggle. */
  current?: boolean;
  mono?: boolean;
  ariaLabel?: string;
}

/** Themed button. `active` reflects a toggled/selected state (aria-pressed true/false + accent fill). */
export function Button({ children, onClick, variant = 'ghost', active, mono, disabled, ariaLabel, current, style, className, 'aria-label': ariaLabelAttr, ...rest }: ButtonProps) {
  const filled = active || current;
  const bg =
    filled || variant === 'accent' ? 'var(--lab-accent)'
    : variant === 'solid' ? 'var(--lab-accent-bg)'
    : 'transparent';
  const color = filled || variant === 'accent' ? 'var(--lab-on-accent)' : 'var(--lab-ink)';
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? ariaLabelAttr}
      // A caller that passes `active` (true OR false) declares a toggle, so both states are
      // announced; omitting it keeps a plain action button (no aria-pressed at all).
      aria-pressed={active}
      aria-current={current ? 'true' : undefined}
      className={`focus-ring${className ? ' ' + className : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s2)',
        padding: 'var(--lab-s2) var(--lab-s4)', fontSize: 'var(--lab-fs-xs)',
        fontFamily: mono ? 'var(--lab-font-mono)' : 'var(--lab-font-body)',
        // Honest disablement: the inline background/colour would otherwise paint a disabled
        // button identical to an enabled one (same cue as steps/controls LabButton).
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(disabled ? { opacity: 0.55 } : {}),
        border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)',
        background: bg, color, whiteSpace: 'nowrap',
        transition: 'background-color var(--lab-dur-fast) var(--lab-ease), color var(--lab-dur-fast) var(--lab-ease)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
