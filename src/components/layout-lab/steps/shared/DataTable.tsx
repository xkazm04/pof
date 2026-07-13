'use client';

import type { ReactNode } from 'react';
import type { LabTheme } from '../../theme';

/**
 * Shared attribute / manifest table (CLAUDE.md → Shared Component Manifest).
 *
 * Renders a keyed `values` object as a two-column (label · value) list: a present
 * value is shown in `inkDeep` with its optional `unit`; a `null`/`undefined` value
 * is flagged in `warn` with `missingText`. Extracted from two hand-rolled copies —
 * the generic `ArchetypeStep` `table` view and the bespoke Items `Attributes` step —
 * so every catalog's attribute/manifest table reads the same.
 *
 * Presentational + framework-light: the caller decides which columns and where the
 * values come from (persisted artifact data, a UE-synced struct, …).
 */
export interface DataColumn {
  /** Key read from `values`. */
  key: string;
  /** Row label (defaults to `key`). */
  label?: string;
  /** Optional unit appended after a present value (e.g. `hp`, `instr`). */
  unit?: string;
}

export interface DataTableProps {
  t: LabTheme;
  columns: DataColumn[];
  values: Record<string, unknown>;
  /** Optional `[keyHeader, valueHeader]` header row (uppercased, accent surface). */
  header?: [string, string];
  /** Text for a null/undefined value. Default `— missing`. */
  missingText?: string;
  /** Optional caption rendered above the table (e.g. a "synced from UE5" note). */
  caption?: ReactNode;
  /** Test hook applied to the table container. */
  testId?: string;
}

export function DataTable({ t, columns, values, header, missingText = '— missing', caption, testId }: DataTableProps) {
  return (
    <div style={{ display: 'grid', gap: caption ? 10 : 0 }}>
      {caption && (
        <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>
          {caption}
        </div>
      )}
      <div data-testid={testId} style={{ border: `1px solid ${t.line}` }}>
        {header && (
          <div className={t.fontMono} style={{ display: 'grid', gridTemplateColumns: '1fr auto', background: t.accentBg, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDeep, padding: '7px 12px' }}>
            <span>{header[0]}</span><span>{header[1]}</span>
          </div>
        )}
        {columns.map((c) => {
          const raw = values[c.key];
          const present = raw != null;
          return (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
              <span style={{ color: t.text }}>{c.label ?? c.key}</span>
              <span className={t.fontMono} style={{ color: present ? t.inkDeep : t.warn, fontWeight: 600 }}>
                {present ? `${String(raw)}${c.unit ? ' ' + c.unit : ''}` : missingText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
