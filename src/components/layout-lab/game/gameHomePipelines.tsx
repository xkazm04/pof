'use client';

/**
 * The Game home's pipeline table: one row per manifest pipeline (built first, then planned).
 * COVERAGE (entities vs the declared target) and READINESS (the best rung the /status model
 * reached) are two separate columns — never one blended number. Rendered through the shared
 * `DataTable` in row mode.
 */
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { READINESS_NAME } from '@/lib/status/readiness';
import { coverageText } from '@/lib/games/scope';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { GameHomeRow, RowReadiness } from './gameHomeData';

const LABELS = new Map(CATALOG_SECTIONS.map((s) => [s.catalogId, s.label]));

const FIT_WORD: Record<GameHomeRow['fit'], string> = {
  reuse: 'reuse',
  reskin: 'reskin',
  planned: 'planned',
  all: 'whole registry',
};

/** The readiness cell's words. `unmeasured` is never shown as R0. Exported for tests. */
export function readinessText(r: RowReadiness | null, row: Pick<GameHomeRow, 'fit' | 'registered'>): string {
  if (row.fit === 'planned') return 'not built';
  if (!row.registered) return 'not registered';
  if (!r || r.kind === 'loading') return 'loading…';
  if (r.kind === 'unknown') return 'unknown — read failed';
  return r.level === 'unmeasured' ? 'unmeasured' : `${r.level} · ${READINESS_NAME[r.level]}`;
}

/** The coverage cell's words: "3 / 10", "3 · no target declared", or "not built". Exported for tests. */
export function coverageCell(row: GameHomeRow): string {
  if (row.fit === 'planned') return 'not built';
  if (!row.registered) return 'not registered';
  return coverageText(row);
}

const COLUMNS = [
  { key: 'fit', label: 'Fit' },
  { key: 'note', label: 'Note' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'readiness', label: 'Readiness' },
];

export function GameHomePipelines({ t, rows, title, onRetry }: {
  t: LabTheme;
  rows: GameHomeRow[];
  title: string;
  onRetry: (catalogId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p data-testid="game-home-no-pipelines" style={{ fontSize: 'var(--lab-fs-sm)', color: t.muted }}>
        No pipelines in {title}&apos;s manifest yet.
      </p>
    );
  }
  const failed = rows.filter((r) => r.readiness?.kind === 'unknown');
  return (
    <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
      {failed.map((r) => (
        <InlineErrorRetry key={r.catalogId} dense
          message={`Couldn't read ${r.catalogId}'s artifacts — its readiness is unknown: ${r.readiness?.kind === 'unknown' ? r.readiness.error : ''}`}
          onRetry={() => onRetry(r.catalogId)} />
      ))}
      <DataTable
        t={t}
        testId="game-home-pipelines"
        header={['Pipeline', '']}
        columns={COLUMNS}
        missingText="—"
        rows={rows.map((r) => ({
          label: LABELS.get(r.catalogId) ?? r.catalogId,
          values: {
            fit: FIT_WORD[r.fit],
            note: r.note ?? '—',
            coverage: coverageCell(r),
            readiness: readinessText(r.readiness, r),
          },
        }))}
      />
    </div>
  );
}
