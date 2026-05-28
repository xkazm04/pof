import type { ReactNode, HTMLAttributes } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevation?: 0 | 1 | 2 | 3;
  radius?: 'sm' | 'md' | 'lg';
  padded?: boolean;
  glass?: boolean;
}

/** A themed surface: bg/border/radius/elevation all from --lab-* tokens. */
export function Panel({ children, elevation = 0, radius = 'md', padded, glass, style, className, ...rest }: PanelProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--lab-panel)',
        border: '1px solid var(--lab-line)',
        borderRadius: `var(--lab-r-${radius})`,
        boxShadow: elevation ? `var(--lab-elev-${elevation})` : 'none',
        ...(glass ? { backdropFilter: 'blur(var(--lab-glass-blur))' } : {}),
        ...(padded ? { padding: 'var(--lab-s5)' } : {}),
        transition: 'background-color var(--lab-dur) var(--lab-ease), border-color var(--lab-dur) var(--lab-ease)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
