'use client';

import { StatusTag } from '@/components/ui/StatusTag';
import type { StatusLevel } from '@/lib/status-token';
import type { EnemySourceReport } from '@/lib/combat/simulation-engine';

const TAG: Record<EnemySourceReport['source'], { level: StatusLevel; word: string }> = {
  bestiary: { level: 'ok', word: 'Catalog' },
  mixed: { level: 'warn', word: 'Mixed' },
  // Not a failure — but never let fixtures read as authored content.
  hardcoded: { level: 'warn', word: 'Fixtures' },
};

/**
 * Says WHERE the simulated enemies came from. A survival rate computed on
 * hardcoded fixtures and one computed on authored bestiary rows look identical,
 * so the provenance is stated on the panel, and every bestiary row the adapter
 * refused is named with its own reason instead of being silently defaulted.
 */
export function EnemySourcePanel({
  provenance, loading, error,
}: {
  provenance: EnemySourceReport;
  loading?: boolean;
  error?: string | null;
}) {
  const tag = TAG[provenance.source];
  return (
    <div
      data-enemy-source={provenance.source}
      className="px-2 py-1.5 rounded border border-border/30 bg-surface-deep text-xs font-mono space-y-1"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <StatusTag level={tag.level} word={tag.word} />
        <span className="text-text-muted">
          {loading ? 'Reading the bestiary catalog…' : provenance.summary}
        </span>
      </div>

      {error && (
        <div className="text-text-muted">
          Bestiary read failed: {error} — the sweep ran on the hardcoded fixtures.
        </div>
      )}

      {provenance.skipped.length > 0 && (
        <ul className="space-y-0.5">
          {provenance.skipped.map((s) => (
            <li key={s.entityId} data-skipped-entity={s.entityId} className="text-text-muted">
              &bull; skipped <span className="text-text">{s.entityId}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
