'use client';

import { forwardRef } from 'react';

type SurfaceLevel = 1 | 2 | 3;

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Depth variant: 1 = default surface, 2 = deep/recessed, 3 = elevated overlay */
  level?: SurfaceLevel;
  /** Adds hover:bg-surface-hover + hover:border-border-bright + transition-all */
  interactive?: boolean;
  /** Accent-colored left border (pass a Tailwind color class like "border-l-blue-400") */
  accent?: string;
}

const LEVEL_CLASSES: Record<SurfaceLevel, string> = {
  1: 'bg-surface border border-border rounded-lg',
  2: 'bg-surface-deep border border-border rounded-lg',
  3: 'bg-surface border border-border rounded-xl shadow-xl',
};

const INTERACTIVE_CLASSES = 'hover:bg-surface-hover hover:border-border-bright transition-all';

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  function SurfaceCard({ level = 1, interactive = false, accent, className = '', children, ...rest }, ref) {
    const classes = [
      LEVEL_CLASSES[level],
      interactive ? INTERACTIVE_CLASSES : '',
      accent ? `border-l-2 ${accent}` : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classes} {...rest}>
        {children}
      </div>
    );
  }
);
