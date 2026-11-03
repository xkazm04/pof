'use client';

/**
 * Time to kill by weapon and range, MEASURED: the newest telemetry session that recorded any (the shared `ChartPanel`
 * bars: one row per weapon at a range, the fastest at each range highlighted). With no session it says so and where
 * the file is expected; it never draws a table-derived guess or a zero.
 */
import { ChartPanel, type BarsRow } from '@/components/layout-lab/steps/shared/ChartPanel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { TelemetrySession, TtkPoint } from '@/lib/games/combatLab/combatTypes';

/** Rows sorted by range then time; the fastest weapon at each range is highlighted. Exported for tests. */
export function ttkRows(points: TtkPoint[]): BarsRow[] {
  const best = new Map<number, number>();
  for (const p of points) best.set(p.rangeM, Math.min(best.get(p.rangeM) ?? Infinity, p.seconds));
  return [...points].sort((a, b) => a.rangeM - b.rangeM || a.seconds - b.seconds).map((p) => ({
    label: `${p.rangeM} m · ${p.weapon}`, color: best.get(p.rangeM) === p.seconds ? 'var(--lab-ink-deep)' : 'var(--lab-muted)', value: Math.round(p.seconds * 100) / 100, unit: 's', highlight: best.get(p.rangeM) === p.seconds,
  }));
}

export function CombatTtkChart({ t, sessions, expected }: { t: LabTheme; sessions: TelemetrySession[]; expected: string }) {
  const s = sessions.find((x) => x.ttk.length > 0);
  if (!s) {
    return (
      <p data-testid="combat-ttk-empty" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>
        {sessions.length === 0 ? 'No telemetry session yet' : `${sessions.length} telemetry ${sessions.length === 1 ? 'session' : 'sessions'}, none recorded a time to kill`}: no chart. Expected: {expected}.
      </p>
    );
  }
  const rows = ttkRows(s.ttk);
  return (
    <div data-testid="combat-ttk" style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
      <ChartPanel t={t} variant="bars" rows={rows} labelWidth={150} ariaLabel={`Measured time to kill in seconds by weapon and range, from ${s.file}`} />
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Measured in {s.file}, read from {s.from.label}; highlighted = fastest at that range. Lower is faster.</span>
    </div>
  );
}
