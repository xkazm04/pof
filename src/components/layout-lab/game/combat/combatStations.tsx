'use client';

/**
 * The arena's stations: one row per lane's `arena_stations/<lane>.json`, so the owner sees which lane has plugged
 * in what and how much it exposes. A count the file does not carry reads `— not in file`, never 0; no files at all
 * says where they are expected.
 */
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import { StatusTag } from '@/components/ui/StatusTag';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { StationsRead } from '@/lib/games/combatLab/combatTypes';

const COLUMNS = [
  { key: 'station' }, { key: 'area' }, { key: 'spawns' }, { key: 'props' }, { key: 'tuning keys' }, { key: 'measurements' }, { key: 'lane' }, { key: 'file' },
];

export function CombatStations({ t, stations }: { t: LabTheme; stations: StationsRead }) {
  const rows = stations.items.map((s) => ({
    values: s.unreadable ? { station: `${s.file} (unreadable JSON)`, area: 'unreadable', lane: s.from.label, file: s.file } : {
      station: s.name ?? s.id ?? s.file,
      area: s.area, spawns: s.spawns, props: s.props, 'tuning keys': s.tuningKeys, measurements: s.measurements, lane: s.from.label, file: s.file,
    },
  }));
  return (
    <section data-testid="combat-stations" data-count={rows.length} aria-label="Arena stations" style={{ display: 'grid', gap: 'var(--lab-s2)', minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.inkDeep, display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        Arena stations
        {rows.length === 0 && <StatusTag level="warn" word="none yet" />}
      </h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{stations.expected}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 6 * 110 }}>
            <DataTable t={t} testId="combat-grid-stations" columns={COLUMNS} rows={rows} missingText="— not in file" caption={`${rows.length} ${rows.length === 1 ? 'station' : 'stations'} in ${stations.dir}`} />
          </div>
        </div>
      )}
    </section>
  );
}
