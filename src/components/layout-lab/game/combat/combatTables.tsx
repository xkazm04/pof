'use client';

/**
 * The game tables the combat lanes write (weapons, enemy archetypes, powers) as shared `DataTable`s, each captioned with
 * the source it was read from. A table that is not there says where it is expected; one that cannot be read says why.
 * Never a fake empty grid.
 */
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import { StatusTag } from '@/components/ui/StatusTag';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CombatTable } from '@/lib/games/combatLab/combatTypes';

const TITLE: Record<CombatTable['key'], string> = { weapons: 'Weapons', enemies: 'Enemy archetypes', powers: 'Ghost powers' };

export function CombatTableBlock({ t, table }: { t: LabTheme; table: CombatTable }) {
  return (
    <section data-testid={`combat-table-${table.key}`} data-state={table.state} aria-label={TITLE[table.key]} style={{ display: 'grid', gap: 'var(--lab-s2)', minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.inkDeep, display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        {TITLE[table.key]}
        {table.state === 'missing' && <StatusTag level="warn" word="not written yet" />}
        {table.state === 'invalid' && <StatusTag level="bad" word="unreadable" />}
      </h3>
      {table.state !== 'ok' ? (
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{table.reason}</p>
      ) : (
        <div style={{ overflowX: 'auto', display: 'grid', gap: 'var(--lab-s1)' }}>
          <span data-testid={`combat-source-${table.key}`} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{table.file} · read from {table.from?.label}</span>
          <div style={{ minWidth: Math.min(table.columns.length, 6) * 110 }}>
            <DataTable t={t} testId={`combat-grid-${table.key}`} columns={table.columns.map((key) => ({ key }))} rows={table.rows}
              caption={`${table.rows.length} ${table.rows.length === 1 ? 'row' : 'rows'}${table.hiddenColumns ? ` · ${table.hiddenColumns} more columns not shown` : ''}`} />
          </div>
        </div>
      )}
    </section>
  );
}
