'use client';

import { Gamepad2 } from 'lucide-react';
import { useCRUD } from '@/hooks/useCRUD';
import { STATUS_ERROR, qualityColor } from '@/lib/chart-colors';
import type { DirectorStats } from '@/lib/game-director-db';

const EMPTY: DirectorStats = {
  totalSessions: 0,
  completedSessions: 0,
  totalFindings: 0,
  criticalFindings: 0,
  avgScore: null,
  recentSessions: [],
};

/**
 * Mission Control playtest roll-up (ECW Phase 10-MC round 2 — folds in the
 * legacy Game Director overview). Reads `/api/game-director?action=stats` and
 * shows playtest throughput, average session score, and outstanding critical
 * findings — the "is the game holding up under play?" signal.
 */
export function PlaytestsCard() {
  const { data, isLoading } = useCRUD<DirectorStats>('/api/game-director?action=stats', EMPTY);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Gamepad2 className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Playtests</h2>
        {data.avgScore !== null && (
          <span className="ml-auto text-lg font-bold" style={{ color: qualityColor(data.avgScore) }}>
            {data.avgScore}
          </span>
        )}
      </header>

      {isLoading && data.totalSessions === 0 ? (
        <p className="text-xs text-text-muted/60">Loading playtests…</p>
      ) : data.totalSessions === 0 ? (
        <p className="text-xs text-text-muted/60">
          No playtest sessions yet. Run a Game Director session to populate playtest health.
        </p>
      ) : (
        <>
          <div className="text-xs text-text-muted mb-3">
            {data.completedSessions} of {data.totalSessions} sessions complete · {data.totalFindings} findings
          </div>
          {data.criticalFindings > 0 && (
            <div className="flex items-center gap-2 text-2xs font-mono" style={{ color: STATUS_ERROR }}>
              {data.criticalFindings} critical finding{data.criticalFindings === 1 ? '' : 's'} outstanding
            </div>
          )}
          <ul className="mt-1 space-y-1">
            {data.recentSessions.slice(0, 3).map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-2xs font-mono">
                <span className="flex-1 truncate text-text-muted">{s.name}</span>
                <span className="text-text-muted/60">{s.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
