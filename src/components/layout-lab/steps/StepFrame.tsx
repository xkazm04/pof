'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LabTheme } from '../theme';

export type AcceptanceStatus = 'pass' | 'pending' | 'fail';
export interface Acceptance { label: string; status: AcceptanceStatus; detail: string }
export interface StepPanel { label: string; node: ReactNode }

/**
 * View / Produce / Acceptance scaffold. Acceptance is a derived gate (full-width
 * banner on top). Panels (the View halves + Produce) flow in a responsive grid:
 * side-by-side on wide screens, stacked on narrow — room to grow as UE data does.
 * All type is >= 14px (text-sm floor).
 */
export function StepFrame({ t, acceptance, panels }: { t: LabTheme; acceptance: Acceptance; panels: StepPanel[] }) {
  const sc = acceptance.status === 'pass' ? t.ok : acceptance.status === 'fail' ? t.bad : t.warn;
  const panelStyle = (): CSSProperties => ({ background: t.panel, border: `1px solid ${t.line}`, ...(t.glass ? { backdropFilter: 'blur(12px)', borderRadius: 12 } : {}) });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '14px 18px', marginBottom: 20, borderLeft: `4px solid ${sc}`, ...panelStyle() }}>
        <span className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted }}>Acceptance</span>
        <span style={{ fontSize: 15, color: t.text }}>{acceptance.label}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{acceptance.detail}</span>
          <span className={t.fontMono} style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: sc, border: `1px solid ${sc}`, padding: '4px 10px', borderRadius: t.glass ? 6 : 0 }}>{acceptance.status.toUpperCase()}</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        {panels.map((p) => (
          <section key={p.label} style={{ ...panelStyle(), padding: 18 }}>
            <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink, marginBottom: 14, borderBottom: `1px solid ${t.line}`, paddingBottom: 8 }}>{p.label}</div>
            {p.node}
          </section>
        ))}
      </div>
    </div>
  );
}
