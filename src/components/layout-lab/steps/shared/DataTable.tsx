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
  /** Key·value mode: one row per column, read from this flat record. */
  values?: Record<string, unknown>;
  /**
   * ROW mode: a real multi-column table — one row per record, columns as the header.
   * Takes precedence over `values`. This is the shape most produce bodies actually write
   * (a list of tier/beat/binding records, or a keyed group of them), which a key·value
   * table could only ever render as a column of `— missing`. `label` (the group key, when
   * the rows came from a keyed object) renders as a leading row-label column.
   */
  rows?: { label?: string; values: Record<string, unknown> }[];
  /** Optional `[keyHeader, valueHeader]` header row (uppercased, accent surface). */
  header?: [string, string];
  /** Text for a null/undefined value. Default `— missing`. */
  missingText?: string;
  /** Optional caption rendered above the table (e.g. a "synced from UE5" note). */
  caption?: ReactNode;
  /** Test hook applied to the table container. */
  testId?: string;
}

/** Render one cell value: lists join, nested records serialize compactly, scalars stringify. */
function cellText(raw: unknown, unit?: string): string {
  const body = Array.isArray(raw)
    ? raw.map((x) => (x != null && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' · ')
    : raw != null && typeof raw === 'object'
      ? JSON.stringify(raw)
      : String(raw);
  return unit ? `${body} ${unit}` : body;
}

export function DataTable({ t, columns, values, rows, header, missingText = '— missing', caption, testId }: DataTableProps) {
  if (rows) {
    const showLabels = rows.some((r) => r.label != null);
    const grid = `${showLabels ? 'minmax(90px, 0.8fr) ' : ''}repeat(${columns.length}, minmax(0, 1fr))`;
    return (
      <div style={{ display: 'grid', gap: caption ? 10 : 0 }}>
        {caption && (
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>
            {caption}
          </div>
        )}
        <div data-testid={testId} style={{ border: `1px solid ${t.line}`, overflowX: 'auto' }}>
          <div className={t.fontMono} style={{ display: 'grid', gridTemplateColumns: grid, background: t.accentBg, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDeep, padding: '7px 12px', gap: 12 }}>
            {showLabels && <span>{header?.[0] ?? ''}</span>}
            {columns.map((c) => <span key={c.key}>{c.label ?? c.key}</span>)}
          </div>
          {rows.map((r, i) => (
            <div key={r.label ?? i} style={{ display: 'grid', gridTemplateColumns: grid, padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15, gap: 12, alignItems: 'baseline' }}>
              {showLabels && <span className={t.fontMono} style={{ color: t.text }}>{r.label ?? ''}</span>}
              {columns.map((c) => {
                const raw = r.values[c.key];
                return (
                  <span key={c.key} className={t.fontMono} style={{ color: raw != null ? t.inkDeep : t.warn, fontWeight: raw != null ? 600 : 400, overflowWrap: 'anywhere' }}>
                    {raw != null ? cellText(raw, c.unit) : missingText}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const flat = values ?? {};
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
          const raw = flat[c.key];
          const present = raw != null;
          return (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
              <span style={{ color: t.text }}>{c.label ?? c.key}</span>
              <span className={t.fontMono} style={{ color: present ? t.inkDeep : t.warn, fontWeight: 600 }}>
                {present ? cellText(raw, c.unit) : missingText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
