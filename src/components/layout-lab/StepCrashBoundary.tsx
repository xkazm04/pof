'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RawArtifactDisclosure } from './steps/shared/RawArtifactDisclosure';
import { Button } from './ui/Button';
import { labPanelStyle, type LabTheme } from './theme';
import { logger } from '@/lib/logger';
import { useErrorDiagnosticsStore } from '@/stores/errorDiagnosticsStore';

/** What an "adopt server truth" attempt actually did — never a silent no-op. */
export type AdoptOutcome = 'adopted' | 'no-server-artifact';

/**
 * Panel-scoped containment INSIDE a step (the data-driven View / gallery panels of
 * `ArchetypeStep`, which coerce arbitrary artifact `data` into charts, tables and graphs).
 *
 * Deliberately narrower than {@link StepCrashBoundary} and deliberately never wrapped
 * around the acceptance banner: a genuine `fail` must always reach the operator, and the
 * Raw artifact panel — the one surface that can explain the crash — stays usable.
 */
export class PanelCrashBoundary extends Component<{ t: LabTheme; panel: string; step?: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) {
    logger.error(`[PanelCrashBoundary] ${this.props.step ?? '?'} · ${this.props.panel} panel crashed:`, error);
  }

  render() {
    const { t, panel, children } = this.props;
    const { error } = this.state;
    if (!error) return children;
    return (
      <div data-testid="panel-crash-note" data-crash-panel={panel} role="alert" style={{ display: 'grid', gap: 'var(--lab-s1)', fontSize: 'var(--lab-fs-xs)' }}>
        <span className={t.fontMono} style={{ color: t.bad, fontWeight: 700 }}>✕ This {panel} panel crashed while rendering</span>
        <span style={{ color: t.text, lineHeight: 1.5 }}>
          {error.name}: {error.message} — the step ran; this panel could not draw what it stored. The
          acceptance verdict above is untouched by this; open <strong>Raw artifact</strong> below to
          see the payload verbatim.
        </span>
      </div>
    );
  }
}

export interface StepCrashBoundaryProps {
  t: LabTheme;
  /** The step whose canvas this boundary owns. Named on the failure card. */
  step: string;
  catalogLabel?: string;
  catalogId?: string;
  entityName?: string;
  /** The stored artifact for this step, surfaced verbatim via RawArtifactDisclosure. */
  artifact?: { data?: Record<string, unknown>; ueAssets?: string[]; status?: string; tier?: string; reason?: string };
  /** Escape hatch: replace this step’s local artifact with the server’s. Must REPORT what it did. */
  onAdoptServer?: () => AdoptOutcome;
  children: ReactNode;
}

interface State { error: Error | null; attempts: number; adopt: AdoptOutcome | null }

/**
 * Crash containment for ONE step canvas.
 *
 * The `/layout` lab is the homepage, and step `data` is typed `unknown` — hydrated straight
 * from SQLite, written by other Claude sessions, the MCP submit path and headless drains. A
 * single throw in any of the ~350 step renderers used to take down the whole application
 * shell. This contains it to the canvas: the tree, rail, header and search stay mounted.
 *
 * Deliberately NOT a swallow-and-continue. The card is loud, it NAMES the step and the
 * catalog/entity it failed on, it states that a render crash is **not** an acceptance
 * verdict (so a contained crash can never be read as a pass — or as a genuine `fail`), and
 * it exposes the offending artifact verbatim plus two escapes: re-render, or adopt the
 * server’s copy of the step.
 */
export class StepCrashBoundary extends Component<StepCrashBoundaryProps, State> {
  state: State = { error: null, attempts: 0, adopt: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = `${this.props.catalogLabel ?? this.props.catalogId ?? 'lab'} · ${this.props.entityName ?? '—'} · ${this.props.step}`;
    logger.error(`[StepCrashBoundary] ${where} crashed while rendering:`, error, info.componentStack);
    useErrorDiagnosticsStore.getState().logError(`Lab step · ${where}`, error);
  }

  private retry = () => this.setState((s) => ({ error: null, attempts: s.attempts + 1, adopt: null }));

  private adopt = () => {
    const outcome = this.props.onAdoptServer?.() ?? 'no-server-artifact';
    // Adopting replaced the data the crash came from, so re-render immediately; a no-op
    // must NOT clear the card (that would look like a fix that never happened).
    if (outcome === 'adopted') this.setState((s) => ({ error: null, attempts: s.attempts + 1, adopt: outcome }));
    else this.setState({ adopt: outcome });
  };

  render() {
    const { t, step, catalogLabel, catalogId, entityName, artifact, onAdoptServer, children } = this.props;
    const { error, attempts, adopt } = this.state;
    if (!error) return children;

    const where = [catalogLabel ?? catalogId, entityName].filter(Boolean).join(' · ');
    const stack = (error.stack ?? '').split('\n').slice(1, 7).map((l) => l.trim()).join('\n');

    return (
      <div
        data-testid="step-crash-card"
        data-crash-step={step}
        role="alert"
        style={{
          ...labPanelStyle(t, { borderRadius: t.glass ? 12 : 0 }),
          padding: 'var(--lab-s6)',
          display: 'grid',
          gap: 'var(--lab-s4)',
          boxShadow: `inset 4px 0 0 ${t.bad}`,
        }}
      >
        <div style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
          <span className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.bad, fontWeight: 700 }}>
            ✕ Step crashed while rendering
          </span>
          <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-lg)', fontWeight: 700, color: t.inkDeep }}>{step}</h3>
          {where && (
            <span className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{where}</span>
          )}
        </div>

        {/* The honesty clause: containment must never read as a verdict. */}
        <p data-testid="step-crash-not-a-verdict" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', lineHeight: 1.6, color: t.text }}>
          This is a rendering failure, <strong>not an acceptance verdict</strong>. This step’s real
          status is <strong>unknown</strong> until it renders again — nothing here is a pass, a fail,
          or an empty step. The rest of the lab is still live: the catalog tree, the pipeline rail and
          the header above are unaffected, so you can move to another step or catalog.
        </p>

        <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
          <span className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad, wordBreak: 'break-word' }}>
            {error.name}: {error.message}
          </span>
          {stack && (
            <details style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
              <summary className={t.fontMono} style={{ cursor: 'pointer', color: t.muted, fontSize: 'var(--lab-fs-xs)', listStyle: 'revert' }}>
                Stack (top frames)
              </summary>
              <pre className={t.fontMono} style={{ margin: 0, padding: 'var(--lab-s3)', fontSize: 13, lineHeight: 1.5, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap' }}>
                {stack}
              </pre>
            </details>
          )}
        </div>

        {/* Exactly what this step has stored — the payload the renderer choked on. */}
        <RawArtifactDisclosure
          t={t}
          data={artifact?.data ?? {}}
          ueAssets={artifact?.ueAssets}
          verdict={artifact?.status ? { status: artifact.status, tier: artifact.tier, reason: artifact.reason } : undefined}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--lab-s2)' }}>
          <Button variant="accent" mono onClick={this.retry} data-testid="step-crash-retry">
            ↻ Re-render this step
          </Button>
          {onAdoptServer && (
            <Button mono onClick={this.adopt} data-testid="step-crash-adopt">
              ⇩ Adopt server truth for this step
            </Button>
          )}
          {attempts > 0 && (
            <span className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
              re-rendered {attempts}× — it crashed again, so the stored artifact is the problem, not the render.
            </span>
          )}
        </div>

        {adopt === 'no-server-artifact' && (
          <span data-testid="step-crash-adopt-outcome" className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>
            Nothing changed — the server holds no artifact for this step, so there is no server copy to
            adopt. Re-produce the step (or reset the entity) to replace what is stored here.
          </span>
        )}
      </div>
    );
  }
}
