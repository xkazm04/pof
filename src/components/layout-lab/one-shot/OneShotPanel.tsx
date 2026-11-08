'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { createOrchestrator } from '@/lib/one-shot/orchestrator';
import type { LabTheme } from '../theme';
import { AnalyzedView, DistributionDimensions, TargetLine } from './AnalyzedView';
import { ProposalView } from './ProposalView';
import { RunLogView } from './RunLogView';
import { CatalogPickerForm } from './CatalogPickerForm';
import { RunActions } from './RunActions';
import type { NextAction } from '@/lib/one-shot/next-actions';
import type { GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One module-level orchestrator — shared across renders.
const orchestrator = createOrchestrator();

interface Props {
  t: LabTheme;
}

/**
 * Right-rail panel driven by useOneShotLabStore.panelOpen. Gap-first phase routing:
 * idle → ranked gaps + catalog select; analyzed → every dimension, gaps clickable (nothing spent);
 * proposing/refining → target + distribution + ProposalView; running/completed/failed → RunLogView.
 * Every non-idle phase ends in RunActions (cancel / resume / retry failed / start over).
 */
export function OneShotPanel({ t }: Props) {
  const panelOpen = useOneShotLabStore((s) => s.panelOpen);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  const phase = useOneShotJobStore((s) => s.phase);
  const catalogId = useOneShotJobStore((s) => s.catalogId);
  const proposal = useOneShotJobStore((s) => s.proposal);
  const refinementTurns = useOneShotJobStore((s) => s.refinementTurns);
  const stepResults = useOneShotJobStore((s) => s.stepResults);
  const lastSummary = useOneShotJobStore((s) => s.lastSummary);
  const distribution = useOneShotJobStore((s) => s.distribution);
  const target = useOneShotJobStore((s) => s.target);

  const [catalogInput, setCatalogInput] = useState('items');
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // The drawer declares aria-modal, so it keeps that promise (as LabDrawer does): focus moves in
  // on open and returns to whatever opened it on close or unmount.
  useEffect(() => {
    if (!panelOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => { if (opener && opener.isConnected) opener.focus(); };
  }, [panelOpen]);

  if (!panelOpen) return null;

  const trapKeys = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); setPanelOpen(false); return; }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const within = panelRef.current.contains(active);
    if (e.shiftKey && (active === first || !within)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !within)) { e.preventDefault(); first.focus(); }
  };

  // Opaque surface (t.bg, not the translucent t.panel) + elevation, matching the
  // canonical LabDrawer treatment — otherwise the page bleeds through the panel and
  // the drawer visually collides with the content below.
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 380,
    maxWidth: '90vw',
    height: '100vh',
    background: t.bg,
    borderLeft: `1px solid ${t.line}`,
    boxShadow: '0 0 40px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    overflow: 'hidden',
  };

  // Each action reports its own failure; the orchestrator already returned the store to rest.
  const guarded = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const handleAnalyze = guarded(() => orchestrator.analyze(catalogInput));
  // A ranked gap from idle names its catalog: measure it, then propose aimed at that gap.
  const handlePickGap = (g: GapTarget, hint?: string) => guarded(async () => {
    if (useOneShotJobStore.getState().phase !== 'analyzed' || catalogId !== g.catalogId) await orchestrator.analyze(g.catalogId);
    await orchestrator.proposeFor(g, hint);
  })();
  const handlePropose = (hint?: string) => guarded(() => orchestrator.proposeFor(null, hint))();

  const handleRefine = (input: string, forceMore: boolean) => guarded(() => orchestrator.refine(input, forceMore))();
  const handleApprove = guarded(() => orchestrator.approveAndRun());
  const handleAction = (a: NextAction) => {
    setError(null);
    if (a === 'startOver') useOneShotJobStore.getState().reset();
    else if (a === 'cancel') orchestrator.cancel();
    else if (a === 'resume' || a === 'retryFailed') void guarded(() => orchestrator[a]())();
  };

  const isIdle = phase === 'idle';
  const isAnalyzing = phase === 'analyzing' || phase === 'proposing' || phase === 'refining' || phase === 'awaitingRun';
  const isRunning = phase === 'running' || phase === 'completed' || phase === 'failed';
  const showDistribution = phase === 'proposing' || phase === 'refining' || phase === 'awaitingRun';

  return (
    <>
      {/* Backdrop scrim: separates the drawer from the content below + click-away to close. */}
      <div
        data-testid="one-shot-backdrop"
        aria-hidden="true"
        onClick={() => setPanelOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199 }}
      />
      <div ref={panelRef} tabIndex={-1} onKeyDown={trapKeys} role="dialog" aria-modal="true" aria-label="one-shot panel" style={panelStyle}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: `1px solid ${t.line}`, flexShrink: 0,
        }}
      >
        <span className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.ink, fontWeight: 700 }}>
          One-shot · {phase}
        </span>
        <button
          onClick={() => setPanelOpen(false)}
          aria-label="close panel"
          className={t.fontMono}
          style={{ fontSize: 16, background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: '2px 6px' }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {error && (
          <div
            className={t.fontMono}
            style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad, border: `1px solid ${t.bad}`, padding: '8px 12px', marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        {isIdle && (
          <CatalogPickerForm
            t={t}
            catalogInput={catalogInput}
            onCatalogChange={setCatalogInput}
            onStart={() => { void handleAnalyze(); }}
            onPickGap={(g) => { void handlePickGap(g); }}
          />
        )}

        {phase === 'analyzed' && distribution && (
          <AnalyzedView
            t={t}
            distribution={distribution}
            onPick={(g, hint) => { void handlePickGap(g, hint); }}
            onPropose={(hint) => { void handlePropose(hint); }}
            onBack={() => useOneShotJobStore.getState().reset()}
          />
        )}

        {isAnalyzing && (
          <div>
            {phase === 'analyzing' && (
              <div className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, marginBottom: 16 }}>
                Scanning {catalogId}…
              </div>
            )}

            {showDistribution && <TargetLine t={t} target={target} />}
            {showDistribution && distribution && (
              <div style={{ marginBottom: 16 }}>
                <DistributionDimensions t={t} distribution={distribution} />
              </div>
            )}

            {proposal && (
              <ProposalView
                t={t}
                proposal={proposal}
                refinementTurns={refinementTurns}
                onRefine={(input, forceMore) => { void handleRefine(input, forceMore); }}
                onApprove={() => { void handleApprove(); }}
              />
            )}

            {!proposal && phase !== 'analyzing' && (
              <div className={t.fontMono} style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
                Generating proposal…
              </div>
            )}
          </div>
        )}

        {isRunning && (
          <RunLogView
            t={t}
            steps={stepResults}
            phase={phase}
            summary={lastSummary}
          />
        )}
        {!isIdle && phase !== 'analyzed' && <RunActions t={t} onAction={handleAction} />}
      </div>
      </div>
    </>
  );
}
