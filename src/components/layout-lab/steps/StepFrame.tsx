'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import { labPanelStyle, type LabTheme } from '../theme';
import { STATUS_GLYPH, STATUS_WORD, statusColor, type StatusKind } from '../statusLanguage';
import { ProvenanceStrip } from './shared/ProvenanceStrip';
import type { SelectionSource } from './shared/genHistory';
import { getStepFact } from '@/lib/status/statusModel';

export interface Acceptance {
  /** The criterion this gate measures. */
  label: string;
  status: StatusKind;
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
 *
 * Provenance: when `catalogId` + `step` resolve an audited {@link StepFact}
 * (step-facts.json), a compact colorblind-safe PROVENANCE strip renders beneath the
 * acceptance header (engine · judge · checker-meaningfulness), so a shape-only "pass"
 * can't read as verified. Steps with no fact render exactly as before. Display only —
 * it never alters acceptance grading.
 *
 * Selection provenance: an L1 gallery step passes `selection` (auto-picked vs
 * human-chosen, from the step's `genHistory`), which the strip renders as
 * `SELECTION: AUTO` / `SELECTION: HUMAN`. Passing it renders the strip even when the
 * step has no audited fact — also display only.
 */
export function StepFrame({ t, acceptance, panels, onFix, catalogId, step, selection }: {
  t: LabTheme;
  acceptance: Acceptance;
  panels: StepPanel[];
  onFix?: (fixDirection?: string) => void;
  /** Catalog + step name — resolve the audited StepFact for the provenance strip. */
  catalogId?: string;
  step?: string;
  /** Selection provenance for an L1 gallery step (auto-picked vs human-chosen). Passing it
   *  renders the provenance strip even for a step with no audited fact. */
  selection?: SelectionSource;
}) {
  const sc = statusColor(acceptance.status, t);
  const fact = catalogId && step ? getStepFact(catalogId, step) : undefined;
  // Studio (glass) panels round to 12; Blueprint keeps sharp corners (borderRadius 0).
  const panelStyle = labPanelStyle(t, { borderRadius: t.glass ? 12 : 0 });
  const showFix = onFix != null && acceptance.status !== 'pass';

  // Re-entrancy guard for the one-click "Produce fix": a synchronous ref latch (the
  // CliProduce dispatch-guard pattern) drops any second click that lands while a
  // fix dispatch is in flight, so a double-click can't fire two generate()/produce()
  // dispatches for one intended action. `fixing` drives the disabled + label swap.
  const fixLatch = useRef(false);
  const [fixing, setFixing] = useState(false);
  const handleFix = async () => {
    if (fixLatch.current) return;
    fixLatch.current = true;
    setFixing(true);
    try {
      await Promise.resolve(onFix?.(acceptance.fixDirection));
    } finally {
      fixLatch.current = false;
      setFixing(false);
    }
  };

  return (
    <div>
      <div
        data-testid="acceptance-banner"
        data-status={acceptance.status}
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 18px', marginBottom: 20,
          transition: 'box-shadow 160ms ease-out',
          ...panelStyle,
          // Accent stripe via an inset box-shadow, NOT borderLeft — panelStyle sets the
          // `border` shorthand, and mixing it with a changing `borderLeft` longhand trips
          // React's shorthand-conflict warning (dev overlay) on every status change.
          boxShadow: `inset 4px 0 0 ${sc}`,
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

        {(fact || (selection && selection !== 'none')) && (
          <ProvenanceStrip t={t} fact={fact} selection={selection} />
        )}

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
                onClick={handleFix}
                disabled={fixing}
                className={t.fontMono}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px', fontSize: 14, fontWeight: 600,
                  cursor: fixing ? 'default' : 'pointer',
                  opacity: fixing ? 0.6 : 1,
                  background: t.glass ? t.accentBg : t.ink,
                  color: t.glass ? t.ink : t.onAccent,
                  border: `1px solid ${t.ink}`,
                  borderRadius: t.glass ? 6 : 0,
                }}
              >
                {fixing ? '⏳ Dispatching…' : '⚡ Produce fix'}
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        {panels.map((p) => (
          <section key={p.label} style={{ ...panelStyle, padding: 18 }}>
            <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink, marginBottom: 14, borderBottom: `1px solid ${t.line}`, paddingBottom: 8 }}>{p.label}</div>
            {p.node}
          </section>
        ))}
      </div>
    </div>
  );
}
