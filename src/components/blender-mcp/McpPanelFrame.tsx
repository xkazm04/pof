'use client';

import { type ReactNode } from 'react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';

interface McpPanelFrameProps {
  /** Left-side title text (rendered as semantic heading). */
  title: ReactNode;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Optional status pill / chip rendered next to the title. */
  status?: ReactNode;
  /** Right-side action slot (buttons, toggles, etc.). */
  actions?: ReactNode;
  /** Hex accent used for tint, border, and corner glow. Defaults to violet. */
  accent?: string;
  /** Disable the soft corner glow (use for very dense embeds). */
  glow?: boolean;
  /** Body padding preset. `none` lets children own the gutter (e.g. viewport). */
  bodyPadding?: 'none' | 'sm' | 'md';
  /** Body content. */
  children?: ReactNode;
  /** Optional className extension on the outer container. */
  className?: string;
}

const BODY_PADDING: Record<NonNullable<McpPanelFrameProps['bodyPadding']>, string> = {
  none: '',
  sm: 'px-3 py-2',
  md: 'p-3',
};

export function McpPanelFrame({
  title,
  icon,
  status,
  actions,
  accent = ACCENT_VIOLET,
  glow = true,
  bodyPadding = 'md',
  children,
  className = '',
}: McpPanelFrameProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: 'var(--surface-card)',
        border: `1px solid ${accent}30`,
        boxShadow: `0 10px 20px -10px rgba(0,0,0,0.5), inset 0 0 10px -5px ${accent}1f`,
      }}
    >
      {/* Diagonal sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.04)] to-transparent pointer-events-none" />

      {/* Corner glow */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full pointer-events-none opacity-40"
          style={{ backgroundColor: `${accent}30` }}
        />
      )}

      {/* Header row */}
      <div
        className="relative z-10 flex items-center justify-between gap-3 px-3 py-2"
        style={{ borderBottom: `1px solid ${accent}1a` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="shrink-0 text-text-muted" aria-hidden="true">
              {icon}
            </span>
          )}
          <h3 className="text-sm font-semibold text-text leading-tight truncate">
            {title}
          </h3>
          {status}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
        )}
      </div>

      {/* Body */}
      <div className={`relative z-10 ${BODY_PADDING[bodyPadding]}`}>
        {children}
      </div>
    </div>
  );
}
