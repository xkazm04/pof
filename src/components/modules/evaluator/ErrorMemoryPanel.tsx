'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, CircleCheck, CircleDot, Loader2 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { tryApiFetch } from '@/lib/api-utils';
import { CATEGORY_LABELS } from '@/lib/prompt-context';
import { SEVERITY_TOKENS, type SeverityLevel } from '@/lib/chart-colors';
import type { ErrorMemoryStats } from '@/lib/error-memory-db';

/**
 * Plain-language Error Memory dashboard — turns the silent learning loop
 * (`error_memory` table + prompt-context injection) into a visible, reassuring
 * surface so users can see what mistakes the assistant has internalized.
 *
 * Reuses CATEGORY_LABELS from prompt-context, the SAME humanized vocabulary that
 * shows up inside generated prompts, so the dashboard and the assistant speak
 * with one voice.
 */

// Maps the raw category key (from error_memory.category) to a severity bucket
// so the frequency bar gets a consistent canonical hue. Unknown categories fall
// back to "medium" amber.
const CATEGORY_SEVERITY: Record<string, SeverityLevel> = {
  'unresolved-external': 'critical',
  'linker-duplicate': 'critical',
  'gc-issue': 'critical',
  'missing-include': 'high',
  'missing-module-dep': 'high',
  'type-mismatch': 'high',
  'uclass-macro': 'medium',
  'forward-declaration': 'medium',
  'access-specifier': 'medium',
  'generated-header': 'medium',
  'syntax': 'low',
  'msvc-version': 'low',
  'other': 'low',
};

function severityFor(category: string): SeverityLevel {
  return CATEGORY_SEVERITY[category] ?? 'medium';
}

function labelFor(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

interface Props {
  /** Optional override — when supplied, the panel renders this and skips the fetch (useful for tests + Storybook). */
  initialStats?: ErrorMemoryStats;
}

export function ErrorMemoryPanel({ initialStats }: Props) {
  const [stats, setStats] = useState<ErrorMemoryStats | null>(initialStats ?? null);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  // Loading defaults to true when no initialStats — the effect only sets state
  // once the fetch resolves, so we never trigger a same-frame cascade.
  useEffect(() => {
    if (initialStats) return;
    let cancelled = false;
    tryApiFetch<ErrorMemoryStats>('/api/error-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-stats' }),
    }).then((r) => {
      if (cancelled) return;
      if (r.ok) { setStats(r.data); setError(null); }
      else { setStats(null); setError(r.error); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [initialStats]);

  return (
    <SurfaceCard level={2} className="p-4" aria-label="Error Memory">
      <header className="flex items-center gap-2 mb-3">
        <Brain size={16} className="text-text-muted" />
        <h3 className="text-sm font-mono uppercase tracking-[0.15em] text-text">Error Memory</h3>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-text-muted py-4">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {error && !loading && (
        <p role="alert" className="text-xs text-text-muted py-4">Couldn&apos;t load error memory: {error}</p>
      )}

      {!loading && !error && stats && <ErrorMemoryBody stats={stats} />}
    </SurfaceCard>
  );
}

function ErrorMemoryBody({ stats }: { stats: ErrorMemoryStats }) {
  const isEmpty = stats.totalErrors === 0 && stats.uniqueFingerprints === 0;
  if (isEmpty) {
    return (
      <p data-testid="error-memory-empty" className="text-xs text-text-muted py-3 leading-relaxed">
        These are mistakes the assistant now avoids — nothing recorded yet.
      </p>
    );
  }

  const maxCount = Math.max(1, ...stats.topCategories.map((c) => c.count));

  return (
    <div className="space-y-3">
      <div role="list" aria-label="Error Memory stats" className="grid grid-cols-3 gap-2">
        <StatTile label="total" value={stats.totalErrors} />
        <StatTile label="unique" value={stats.uniqueFingerprints} />
        <StatTile label="unresolved" value={stats.unresolvedCount} accent={stats.unresolvedCount > 0} />
      </div>

      <ul role="list" aria-label="Top error categories" className="space-y-1.5">
        {stats.topCategories.map((c) => {
          const severity = severityFor(c.category);
          const token = SEVERITY_TOKENS[severity];
          const widthPct = Math.max(2, Math.round((c.count / maxCount) * 100));
          const fullyResolved = c.unresolved === 0;
          return (
            <li
              key={c.category}
              data-category={c.category}
              data-severity={severity}
              data-resolved={fullyResolved ? 'true' : 'false'}
              className="flex items-center gap-2 text-xs"
            >
              <span
                title={fullyResolved ? 'All resolved' : `${c.unresolved} unresolved`}
                aria-label={fullyResolved ? 'All resolved' : `${c.unresolved} unresolved`}
              >
                {fullyResolved
                  ? <CircleCheck size={12} className="flex-shrink-0" style={{ color: SEVERITY_TOKENS.positive.color }} />
                  : <CircleDot size={12} className="flex-shrink-0" style={{ color: token.color }} />}
              </span>
              <span className="text-text flex-shrink-0 truncate max-w-[140px]">
                <DecoratedCrashText text={labelFor(c.category)} />
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: token.bg }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: token.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <span className="font-mono text-text-muted w-8 text-right">{c.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div role="listitem" className="rounded-md border border-border/40 bg-surface-deep/40 px-2 py-1.5">
      <div className="text-2xs font-mono uppercase tracking-[0.1em] text-text-muted">{label}</div>
      <div className={`font-mono text-base font-semibold ${accent ? 'text-amber-400' : 'text-text'}`} data-stat={label}>
        {value}
      </div>
    </div>
  );
}
