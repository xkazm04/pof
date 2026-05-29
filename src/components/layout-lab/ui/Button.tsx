import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'solid' | 'ghost' | 'accent';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  active?: boolean;
  mono?: boolean;
  ariaLabel?: string;
}

/** Themed button. `active` reflects a toggled/selected state (aria-pressed + accent fill). */
export function Button({ children, onClick, variant = 'ghost', active, mono, disabled, ariaLabel, style, className, ...rest }: ButtonProps) {
  const bg =
    active || variant === 'accent' ? 'var(--lab-accent)'
    : variant === 'solid' ? 'var(--lab-accent-bg)'
    : 'transparent';
  const color = active || variant === 'accent' ? 'var(--lab-on-accent)' : 'var(--lab-ink)';
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active ? true : undefined}
      className={`focus-ring${className ? ' ' + className : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s2)',
        padding: 'var(--lab-s2) var(--lab-s4)', fontSize: 'var(--lab-fs-xs)',
        fontFamily: mono ? 'var(--lab-font-mono)' : 'var(--lab-font-body)',
        cursor: 'pointer',
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
