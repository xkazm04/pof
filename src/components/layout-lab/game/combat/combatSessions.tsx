'use client';

/**
 * The latest arena telemetry sessions (shared `DataTable`, one row per session file): the metrics the file recorded
 * (hit rate, damage taken, input latency, dodges, knockdowns, turn rate); a metric it did not record reads
 * "not recorded", never 0. A file with none of them shows its top-level values instead, so a schema this reader
 * does not know yet is still visible rather than silently empty.
 */
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import type { LabTheme } from '@/components/layout-lab/theme';
import { METRIC_LABEL, type SessionMetric, type TelemetrySession } from '@/lib/games/combatLab/combatTypes';
import { formatDuration } from '@/lib/format';

const KEYS = Object.keys(METRIC_LABEL) as SessionMetric['key'][];
/** Metrics only some kinds of session carry (a course run, a pit run): their column appears once a session has them. */
const NICHE = new Set<SessionMetric['key']>(['courseTime', 'pitTime', 'pitKills', 'pitWaves', 'coverStops']);
/** The arena logs floats like 4.199999999999996 and 720.000327; two decimals is all a designer reads. */
const round = (v: number) => Math.round(v * 100) / 100;

export function sessionRow(s: TelemetrySession): { label: string; values: Record<string, string | number | boolean> } {
  const values: Record<string, string | number | boolean> = { source: s.from.id, age: `${formatDuration(Math.round(s.ageMs / 1000) * 1000)} ago` };
  for (const k of KEYS) {
    const m = s.metrics.find((x) => x.key === k);
    values[k] = m ? round(m.value) : 'not recorded';
  }
  if (s.ttk.length > 0) values.ttkPoints = s.ttk.length;
  if (s.metrics.length === 0 && s.ttk.length === 0) Object.assign(values, s.other);
  return { label: s.file, values };
}

export function CombatSessions({ t, sessions, expected }: { t: LabTheme; sessions: TelemetrySession[]; expected: string }) {
  if (sessions.length === 0) {
    return <p data-testid="combat-sessions-empty" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>No telemetry session yet. Expected: {expected}.</p>;
  }
  const rows = sessions.map(sessionRow);
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r.values)))].filter((k) => k !== 'source' && k !== 'age' && !KEYS.includes(k as SessionMetric['key']) && k !== 'ttkPoints');
  const shown = KEYS.filter((k) => !NICHE.has(k) || sessions.some((s) => s.metrics.some((m) => m.key === k)));
  const columns = [
    { key: 'source' }, { key: 'age' },
    ...shown.map((k) => ({ key: k, label: METRIC_LABEL[k] })),
    { key: 'ttkPoints', label: 'TTK points' }, ...extra.map((key) => ({ key })),
  ];
  return (
    <div data-testid="combat-sessions" style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: columns.length * 112 }}>
        <DataTable t={t} columns={columns} rows={rows} missingText="—" caption={`${sessions.length} latest ${sessions.length === 1 ? 'session' : 'sessions'}, newest first`} />
      </div>
    </div>
  );
}
