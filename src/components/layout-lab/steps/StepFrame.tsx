'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LabTheme } from '../theme';

export type AcceptanceStatus = 'pass' | 'pending' | 'fail';
export interface Acceptance { label: string; status: AcceptanceStatus; detail: string }

/**
 * The View / Produce / Acceptance scaffold every pipeline step renders into.
 * Acceptance is a derived gate (banner on top); View (left, wide) shows the step's
 * current state; Produce (right) is the CLI + user-input panel.
 */
export function StepFrame({ t, acceptance, view, produce }: { t: LabTheme; acceptance: Acceptance; view: ReactNode; produce: ReactNode }) {
  const sc = acceptance.status === 'pass' ? t.ok : acceptance.status === 'fail' ? t.bad : t.warn;
  const panel = (extra?: CSSProperties): CSSProperties => ({ background: t.panel, border: `1px solid ${t.line}`, ...(t.glass ? { backdropFilter: 'blur(12px)', borderRadius: 12 } : {}), ...extra });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', marginBottom: 18, borderLeft: `3px solid ${sc}`, ...panel() }}>
        <span className={t.fontMono} style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.muted }}>Acceptance</span>
        <span style={{ fontSize: 14, color: t.text }}>{acceptance.label}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{acceptance.detail}</span>
          <span className={t.fontMono} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: sc, border: `1px solid ${sc}`, padding: '3px 8px', borderRadius: t.glass ? 6 : 0 }}>{acceptance.status.toUpperCase()}</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <section style={panel({ padding: 18 })}>
          <SectionLabel t={t}>View</SectionLabel>
          {view}
        </section>
        <section style={panel({ padding: 18 })}>
          <SectionLabel t={t}>Produce</SectionLabel>
          {produce}
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ t, children }: { t: LabTheme; children: ReactNode }) {
  return <div className={t.fontMono} style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.ink, marginBottom: 14, borderBottom: `1px solid ${t.line}`, paddingBottom: 8 }}>{children}</div>;
}
