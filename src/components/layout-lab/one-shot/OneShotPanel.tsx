'use client';

import { useState } from 'react';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { createOrchestrator } from '@/lib/one-shot/orchestrator';
import type { LabTheme } from '../theme';
import { DistributionView } from './DistributionView';
import { ProposalView } from './ProposalView';
import { RunLogView } from './RunLogView';

// One module-level orchestrator — shared across renders.
const orchestrator = createOrchestrator();

interface Props {
  t: LabTheme;
}

/**
 * Right-rail panel driven by useOneShotLabStore.panelOpen.
 * Phase routing: idle → catalog picker; analyzing/proposing/refining → DistributionView + ProposalView;
 * running/completed/failed → RunLogView.
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

  const [catalogInput, setCatalogInput] = useState('items');
  const [hintInput, setHintInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!panelOpen) return null;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 380,
    height: '100vh',
    background: t.panel,
    borderLeft: `1px solid ${t.line}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: `1px solid ${t.line}`,
    flexShrink: 0,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  };

  const handleStart = async () => {
    setError(null);
    try {
      await orchestrator.start(catalogInput.trim() || 'items', hintInput.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRefine = async (input: string, forceMore: boolean) => {
    setError(null);
    try {
      await orchestrator.refine(input, forceMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await orchestrator.approveAndRun();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const isIdle = phase === 'idle';
  const isAnalyzing = phase === 'analyzing' || phase === 'proposing' || phase === 'refining' || phase === 'awaitingRun';
  const isRunning = phase === 'running' || phase === 'completed' || phase === 'failed';

  return (
    <div role="dialog" aria-label="one-shot panel" style={panelStyle}>
      <div style={headerStyle}>
        <span className={t.fontMono} style={{ fontSize: 13, color: t.ink, fontWeight: 700 }}>
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

      <div style={bodyStyle}>
        {error && (
          <div
            className={t.fontMono}
            style={{ fontSize: 12, color: t.bad, border: `1px solid ${t.bad}`, padding: '8px 12px', marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        {/* Idle: catalog picker */}
        {isIdle && (
          <div>
            <label
              htmlFor="oneshot-catalog"
              className={t.fontMono}
              style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}
            >
              Catalog
            </label>
            <input
              id="oneshot-catalog"
              value={catalogInput}
              onChange={(e) => setCatalogInput(e.target.value)}
              aria-label="catalog"
              style={{
                width: '100%',
                fontSize: 14,
                padding: '7px 10px',
                background: t.panel,
                color: t.text,
                border: `1px solid ${t.line}`,
                outline: 'none',
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <label
              htmlFor="oneshot-hint"
              className={t.fontMono}
              style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}
            >
              Hint (optional)
            </label>
            <input
              id="oneshot-hint"
              value={hintInput}
              onChange={(e) => setHintInput(e.target.value)}
              placeholder="e.g. focus on under-represented archetypes"
              style={{
                width: '100%',
                fontSize: 14,
                padding: '7px 10px',
                background: t.panel,
                color: t.text,
                border: `1px solid ${t.line}`,
                outline: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => { void handleStart(); }}
              className={t.fontMono}
              style={{
                width: '100%',
                fontSize: 14,
                padding: '8px 16px',
                cursor: 'pointer',
                background: t.ink,
                color: t.onAccent,
                border: `1px solid ${t.ink}`,
                fontWeight: 600,
              }}
            >
              Analyze
            </button>
          </div>
        )}

        {/* Analyzing / proposing / refining */}
        {isAnalyzing && (
          <div>
            {(phase === 'analyzing') && (
              <div className={t.fontMono} style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>
                Scanning {catalogId}…
              </div>
            )}

            {/* DistributionView — shown once we have data (proposing/refining) */}
            {(phase === 'proposing' || phase === 'refining' || phase === 'awaitingRun') && (
              <div style={{ marginBottom: 16 }}>
                <DistributionView t={t} buckets={[]} total={0} />
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
              <div className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>
                Generating proposal…
              </div>
            )}
          </div>
        )}

        {/* Running / completed / failed */}
        {isRunning && (
          <RunLogView
            t={t}
            steps={stepResults}
            phase={phase}
            summary={lastSummary}
          />
        )}
      </div>
    </div>
  );
}
