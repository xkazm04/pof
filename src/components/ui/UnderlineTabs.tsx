'use client';

import type { ComponentType, ReactNode } from 'react';

/**
 * One tab in an {@link UnderlineTabs} strip.
 *
 * `accent` is a CSS color string (from `@/lib/chart-colors`) used for both the
 * active icon tint and the underline bar. When omitted, the group-level `accent`
 * applies — so a single-color strip needs no per-tab accent.
 */
export interface UnderlineTab<T extends string = string> {
  id: T;
  label: string;
  /** Rendered as a count pill (`text-2xs`) when defined; `0` still renders. Omit for count-less tabs. */
  count?: number;
  /** Optional leading Lucide icon, tinted with the tab/group accent when active. */
  icon?: ComponentType<{ className?: string }>;
  /** Per-tab accent (CSS color) overriding the group `accent` for the active icon + underline bar. */
  accent?: string;
}

interface UnderlineTabsProps<T extends string> {
  tabs: UnderlineTab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Default accent (CSS color) for the active underline + icon when a tab has no own `accent`. */
  accent?: string;
  /** Accessible name for the tablist. */
  ariaLabel?: string;
  /** Optional trailing content pinned to the far right of the strip (e.g. a mode toggle). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Unified underline-style tab strip for dashboard sub-navigation.
 *
 * Consolidates the hand-rolled `SubTab` (CrashAnalyzerView) and `LibraryTabButton`
 * (PatternLibraryView) into one primitive so sibling evaluator views share the
 * same visual rhythm: `px-4 py-2` tabs, a count pill, and an `h-0.5` accent bar
 * under the active tab. Accents are CSS colors (from `@/lib/chart-colors`), so a
 * strip can be single-color (one group `accent`) or per-tab colored.
 *
 * Example:
 * ```tsx
 * <UnderlineTabs
 *   ariaLabel="Crash analyzer views"
 *   accent={ACCENT_ROSE}
 *   active={viewTab}
 *   onChange={setViewTab}
 *   tabs={[
 *     { id: 'crashes', label: 'Crash Reports', count: reports.length },
 *     { id: 'health', label: 'Health Map' },
 *   ]}
 *   trailing={<PlainModeToggle …/>}
 * />
 * ```
 */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  accent,
  ariaLabel,
  trailing,
  className = '',
}: UnderlineTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex items-center gap-1 border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const barColor = tab.accent ?? accent;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`focus-ring relative flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {Icon && (
              <span className="inline-flex" style={isActive && barColor ? { color: barColor } : undefined}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded text-2xs ${
                  isActive ? 'bg-surface-hover text-text' : 'bg-surface-deep text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={barColor ? { backgroundColor: barColor } : undefined}
              />
            )}
          </button>
        );
      })}
      {trailing && <div className="ml-auto pb-1">{trailing}</div>}
    </div>
  );
}
