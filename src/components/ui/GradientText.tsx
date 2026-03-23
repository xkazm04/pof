'use client';

import type { ReactNode } from 'react';
import { MODULE_COLORS, ACCENT_CYAN } from '@/lib/chart-colors';

interface GradientTextProps {
  children: ReactNode;
  /** Start color — defaults to core blue */
  from?: string;
  /** End color — defaults to cyan */
  to?: string;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';
}

export function GradientText({
  children,
  from = MODULE_COLORS.core,
  to = ACCENT_CYAN,
  className = '',
  as: Tag = 'span',
}: GradientTextProps) {
  return (
    <Tag
      className={`bg-clip-text text-transparent font-bold ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        WebkitBackgroundClip: 'text',
      }}
    >
      {children}
    </Tag>
  );
}
