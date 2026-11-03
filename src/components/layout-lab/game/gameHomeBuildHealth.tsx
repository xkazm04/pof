'use client';

/**
 * The Game home's "Build health" panel (ticket F-10): one row per `pof.godot-evidence/1` kind with
 * PoF's verdict, the detail and the evidence's age at read, then the bench metrics against the
 * STANDARDS §20 hard limits. Every state says what it is: loading, a failed read (retry), an
 * unbound game (the reason), and evidence that is absent, stale or failing. Server-read only.
 */
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { StatusLevel } from '@/lib/status-token';
import {
  ageText, benchReadings, type BenchReading, type BuildHealth, type BuildHealthAggregate, type BuildHealthRow, type BuildHealthState,
} from '@/lib/games/godot/buildHealthTypes';
import { useBuildHealth } from './gameHomeBuildHealthData';

/** A row state as a colorblind-safe tag (glyph + word). Exported for tests. */
export const STATE_TAG: Record<BuildHealthState, { level: StatusLevel; word: string }> = {
  pass: { level: 'ok', word: 'pass' },
  fail: { level: 'bad', word: 'fail' },
  stale: { level: 'warn', word: 'stale' },
  absent: { level: 'warn', word: 'absent' },
  deferred: { level: 'warn', word: 'deferred' },
};

const AGG_LEVEL: Record<BuildHealthAggregate['status'], StatusLevel> = { pass: 'ok', fail: 'bad', deferred: 'warn', unbound: 'warn' };

/** "3 pass · 1 fail · 2 stale · 2 absent" (zero buckets dropped). Exported for tests. */
export function aggregateText(a: BuildHealthAggregate): string {
  const parts = (['pass', 'fail', 'stale', 'absent', 'deferred'] as const).filter((k) => a[k] > 0).map((k) => `${a[k]} ${k}`);
  return parts.length ? parts.join(' · ') : 'no evidence kinds';
}

const sha7 = (s: string | null | undefined) => (s ? s.slice(0, 7) : null);
const cell = { fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-ink-deep)', overflowWrap: 'anywhere' as const };

function KindRow({ row, readAt, t }: { row: BuildHealthRow; readAt: string; t: LabTheme }) {
  const tag = STATE_TAG[row.state];
  const age = ageText(row.builtAt, readAt);
  return (
    <li data-testid={`build-health-row-${row.kind}`} data-state={row.state}
      style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 140px) 96px 1fr', gap: 'var(--lab-s3)', alignItems: 'baseline' }}>
      <MicroLabel mono tone="muted">{row.kind}</MicroLabel>
      <span><StatusTag level={tag.level} word={tag.word} /></span>
      <span style={{ display: 'grid', gap: 2 }}>
        <span style={cell}>{row.detail}</span>
        <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>
          {[age && `built ${age}`, row.commit && `at ${sha7(row.commit)}`, row.state !== 'pass' && row.reason].filter(Boolean).join(' · ')}
        </span>
      </span>
    </li>
  );
}

function benchValue(r: BenchReading): string {
  return r.value === undefined ? 'not reported' : `${r.value} ${r.unit}`;
}

const BENCH_TAG: Record<BenchReading['verdict'], { level: StatusLevel; word: string }> = {
  within: { level: 'ok', word: 'within' },
  over: { level: 'bad', word: 'over' },
  unbudgeted: { level: 'ok', word: 'recorded' },
  missing: { level: 'warn', word: 'missing' },
};

function BenchMetrics({ row, t }: { row: BuildHealthRow; t: LabTheme }) {
  const readings = benchReadings(row.metrics);
  return (
    <div data-testid="build-health-bench" style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
      <MicroLabel mono uppercase tone="muted">Bench vs STANDARDS §20{row.state === 'pass' ? '' : ` (evidence ${row.state})`}</MicroLabel>
      <ul style={{ display: 'grid', gap: 'var(--lab-s1)', listStyle: 'none', margin: 0, padding: 0 }}>
        {readings.map((r) => (
          <li key={r.key} data-testid={`build-health-metric-${r.key}`} data-verdict={r.verdict}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 140px) 96px 1fr', gap: 'var(--lab-s3)', alignItems: 'baseline' }}>
            <span style={cell}>{r.label}</span>
            <span><StatusTag level={BENCH_TAG[r.verdict].level} word={BENCH_TAG[r.verdict].word} /></span>
            <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
              <span style={cell}>{benchValue(r)}</span>{` · ${r.note}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bound({ data, t }: { data: BuildHealth; t: LabTheme }) {
  const bench = data.rows.find((r) => r.kind === 'bench' && r.metrics);
  const allAbsent = data.rows.length > 0 && data.aggregate.absent === data.rows.length;
  return (
    <div style={{ display: 'grid', gap: 'var(--lab-s3)' }}>
      <span style={{ display: 'inline-flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusTag level={AGG_LEVEL[data.aggregate.status]} word={data.aggregate.status} />
        <span data-testid="build-health-aggregate" style={cell}>{aggregateText(data.aggregate)}</span>
        <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>
          {data.root} · HEAD {sha7(data.head) ?? 'unknown'}
        </span>
      </span>
      {allAbsent && (
        <p data-testid="build-health-empty" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          No evidence written yet: the game&apos;s gates write build/evidence/&lt;kind&gt;.json under its root.
        </p>
      )}
      <ul style={{ display: 'grid', gap: 'var(--lab-s2)', listStyle: 'none', margin: 0, padding: 0 }}>
        {data.rows.map((r) => <KindRow key={r.kind} row={r} readAt={data.readAt} t={t} />)}
      </ul>
      {bench && <BenchMetrics row={bench} t={t} />}
    </div>
  );
}

export function GameHomeBuildHealth({ t, gameId, lane = null, onClearLane }: {
  t: LabTheme; gameId: string; lane?: string | null; onClearLane?: () => void;
}) {
  const { read, reread } = useBuildHealth(gameId, lane);
  return (
    <section data-testid="game-home-build-health" aria-labelledby="game-home-build-health-title" style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
      <span style={{ display: 'inline-flex', gap: 'var(--lab-s3)', alignItems: 'center' }}>
        <h3 id="game-home-build-health-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)' }}>Build health{lane ? ` · lane ${lane}` : ''}</h3>
        {lane && onClearLane && (
          <button type="button" className="focus-ring" data-testid="build-health-clear-lane" onClick={onClearLane}
            style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, textDecoration: 'underline' }}>Back to the game root</button>
        )}
        {read.kind === 'ok' && (
          <button type="button" className="focus-ring" data-testid="build-health-reread" onClick={reread}
            style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, textDecoration: 'underline' }}>Re-read</button>
        )}
      </span>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading build evidence…" />}
      {read.kind === 'error' && <InlineErrorRetry dense message={`build health unavailable (${read.message})`} onRetry={reread} />}
      {read.kind === 'ok' && read.data.binding === 'unbound' && (
        <span data-testid="build-health-unbound" style={{ display: 'inline-flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusTag level="warn" word="unbound" />
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{read.data.reason}</span>
        </span>
      )}
      {read.kind === 'ok' && read.data.binding === 'bound' && <Bound data={read.data} t={t} />}
    </section>
  );
}
