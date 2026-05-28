'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import type { LabTheme } from '../theme';

export type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';

const STATUS_GLYPH: Record<AcceptanceStatus, string> = { pass: '✓', fail: '✕', pending: '○', deferred: '⏸' };
const STATUS_WORD: Record<AcceptanceStatus, string> = { pass: 'passed', fail: 'failed', pending: 'pending', deferred: 'deferred' };

export interface Acceptance {
  /** The criterion this gate measures. */
  label: string;
  status: AcceptanceStatus;
  /** Terse, jargon-heavy numeric detail (e.g. `price/power 1.34×`). */
  detail: string;
  tier?: string;
  reason?: string;
  /** Plain-language one-liner explaining what the status means in human terms. */
  why?: string;
  /** Plain-language imperative — the suggested next action (e.g. "Lower its gold cost"). */
  suggestion?: string;
  /** Optional preset direction text to seed a one-click fix dispatch. */
  fixDirection?: string;
}
export interface StepPanel { label: string; node: ReactNode }

/**
 * View / Produce / Acceptance scaffold. Acceptance is a derived gate (full-width
 * banner on top). Panels (the View halves + Produce) flow in a responsive grid:
 * side-by-side on wide screens, stacked on narrow — room to grow as UE data does.
 * All type is >= 14px (text-sm floor).
 *
 * Motion: the Acceptance banner runs a one-shot highlight pulse (~700ms)
 * whenever the status word changes. It's driven by an AnimatePresence keyed on
 * the status (no setState, no refs in render) — `initial={false}` suppresses
 * the pulse on first paint so unchanged statuses don't flash.
 *
 * Plain-language pairing: when `acceptance.why` is present, the banner renders
 * a second row beneath the terse numeric detail with the human-readable cause
 * plus a `suggestion` imperative — translation-ready (strings authored per-step).
 * If `onFix` is provided and the status is not `pass`, a "Produce fix" button
 * appears that re-runs the step's Produce (optionally seeded by `fixDirection`).
 */
export function StepFrame({ t, acceptance, panels, onFix }: {
  t: LabTheme;
  acceptance: Acceptance;
  panels: StepPanel[];
  onFix?: (fixDirection?: string) => void;
}) {
  const sc = acceptance.status === 'pass' ? t.ok : acceptance.status === 'fail' ? t.bad : acceptance.status === 'deferred' ? t.muted : t.warn;
  const panelStyle = (): CSSProperties => ({ background: t.panel, border: `1px solid ${t.line}`, ...(t.glass ? { backdropFilter: 'blur(12px)', borderRadius: 12 } : {}) });
  const showFix = onFix != null && acceptance.status !== 'pass';

  return (
    <div>
      <div
        data-testid="acceptance-banner"
        data-status={acceptance.status}
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 18px', marginBottom: 20,
          borderLeft: `4px solid ${sc}`,
          transition: 'border-color 160ms ease-out',
          ...panelStyle(),
        }}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={`pulse-${acceptance.status}`}
            data-testid="acceptance-banner-pulse"
            aria-hidden="true"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              boxShadow: `0 0 0 2px ${sc}`,
              borderRadius: t.glass ? 12 : 0,
            }}
          />
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, position: 'relative' }}>
          <span className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted }}>Acceptance</span>
          <span style={{ fontSize: 15, color: t.text }}>{acceptance.label}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{acceptance.detail}</span>
            <span
              role="img"
              aria-label={`${acceptance.label}: ${STATUS_WORD[acceptance.status]}${acceptance.tier ? `, tier ${acceptance.tier}` : ''}`}
              className={t.fontMono}
              style={{
                fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
                color: sc, border: `1px solid ${sc}`, padding: '4px 10px',
                borderRadius: t.glass ? 6 : 0,
                transition: 'color 160ms ease-out, border-color 160ms ease-out',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <span aria-hidden="true">{STATUS_GLYPH[acceptance.status]}</span>
              {acceptance.status.toUpperCase()}{acceptance.tier ? ` · ${acceptance.tier}` : ''}
            </span>
          </span>
        </div>

        {acceptance.why && (
          <div
            data-testid="acceptance-explanation"
            style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, position: 'relative' }}
          >
            <span style={{ fontSize: 15, color: t.text, lineHeight: 1.55 }}>
              {acceptance.why}
              {acceptance.suggestion && (
                <>
                  <span style={{ color: t.muted, margin: '0 8px' }}>·</span>
                  <span data-testid="acceptance-suggestion" style={{ color: t.muted }}>{acceptance.suggestion}</span>
                </>
              )}
            </span>
            {showFix && (
              <button
                data-testid="acceptance-produce-fix"
                onClick={() => onFix?.(acceptance.fixDirection)}
                className={t.fontMono}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  background: t.glass ? t.accentBg : t.ink,
                  color: t.glass ? t.ink : t.onAccent,
                  border: `1px solid ${t.ink}`,
                  borderRadius: t.glass ? 6 : 0,
                }}
              >
                ⚡ Produce fix
              </button>
            )}
          </div>
        )}
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
