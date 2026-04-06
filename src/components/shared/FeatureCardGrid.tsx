'use client';

import type { ReactNode } from 'react';

interface FeatureCardGridProps {
  children: ReactNode;
  /** Accessible label for the grid group */
  label?: string;
}

/**
 * CSS grid container for FeatureCard components.
 * Auto-fill columns with min 160px, gap-3.
 */
export function FeatureCardGrid({ children, label }: FeatureCardGridProps) {
  return (
    <div
      role="group"
      aria-label={label ?? 'Feature cards'}
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
    >
      {children}
    </div>
  );
}
