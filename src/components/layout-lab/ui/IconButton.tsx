import type { ReactNode } from 'react';

interface IconButtonProps { children: ReactNode; onClick?: () => void; ariaLabel: string; active?: boolean; disabled?: boolean; }

export function IconButton({ children, onClick, ariaLabel, active, disabled }: IconButtonProps) {
  return (
    <button
      type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={active ? true : undefined} disabled={disabled}
      className="focus-ring"
      style={{
        width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', cursor: 'pointer',
        background: active ? 'var(--lab-accent)' : 'transparent',
        color: active ? 'var(--lab-on-accent)' : 'var(--lab-ink)',
        transition: 'background-color var(--lab-dur-fast) var(--lab-ease)',
      }}
    >
      {children}
    </button>
  );
}
