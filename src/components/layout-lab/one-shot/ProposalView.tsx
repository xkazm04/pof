'use client';

import { useState } from 'react';
import type { LabTheme } from '../theme';
import type { OneShotProposal } from '@/stores/oneShotJobStore';

interface Props {
  t: LabTheme;
  proposal: OneShotProposal;
  refinementTurns: number;
  onRefine: (input: string, forceMore: boolean) => void;
  onApprove: () => void;
}

/**
 * Proposal name + rationale + JSON data + refine textarea + Run pipeline button.
 * Textarea is disabled when refinementTurns >= 3 and !forceMore.
 */
export function ProposalView({ t, proposal, refinementTurns, onRefine, onApprove }: Props) {
  const [refineInput, setRefineInput] = useState('');
  const [forceMore, setForceMore] = useState(false);
  const atCap = refinementTurns >= 3;
  const refineDisabled = atCap && !forceMore;

  const handleRefine = () => {
    if (!refineInput.trim()) return;
    onRefine(refineInput.trim(), forceMore);
    setRefineInput('');
  };

  const panelStyle: React.CSSProperties = {
    border: `1px solid ${t.line}`,
    background: t.panel,
    padding: '12px 16px',
    marginBottom: 12,
  };

  return (
    <div>
      {/* name + rationale */}
      <div style={panelStyle}>
        <div className={t.fontMono} style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          Proposal
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.inkDeep, marginBottom: 6 }}>{proposal.name}</div>
        <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>{proposal.rationale}</div>
      </div>

      {/* JSON data */}
      <details style={{ marginBottom: 12 }}>
        <summary className={t.fontMono} style={{ fontSize: 12, color: t.muted, cursor: 'pointer', userSelect: 'none' }}>
          Raw data
        </summary>
        <pre
          className={t.fontMono}
          style={{
            fontSize: 12,
            color: t.text,
            background: t.panel,
            border: `1px solid ${t.line}`,
            padding: '10px 12px',
            overflow: 'auto',
            maxHeight: 200,
            margin: '6px 0 0',
          }}
        >
          {JSON.stringify(proposal.data, null, 2)}
        </pre>
      </details>

      {/* refine textarea */}
      <div style={{ marginBottom: 8 }}>
        <label className={t.fontMono} style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}>
          Refine direction {refinementTurns > 0 && `(${refinementTurns}/3 used)`}
        </label>
        <textarea
          value={refineInput}
          onChange={(e) => setRefineInput(e.target.value)}
          disabled={refineDisabled}
          placeholder={refineDisabled ? 'Refinement cap reached — enable Force more to continue' : 'Describe changes…'}
          style={{
            width: '100%',
            minHeight: 72,
            resize: 'vertical',
            fontSize: 13,
            padding: '8px 10px',
            background: t.panel,
            color: refineDisabled ? t.muted : t.text,
            border: `1px solid ${t.line}`,
            outline: 'none',
            fontFamily: 'inherit',
            opacity: refineDisabled ? 0.5 : 1,
          }}
        />
      </div>

      {/* force-more checkbox at cap */}
      {atCap && (
        <label className={t.fontMono} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.warn, marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={forceMore} onChange={(e) => setForceMore(e.target.checked)} />
          Force more refinements (beyond cap)
        </label>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleRefine}
          disabled={refineDisabled || !refineInput.trim()}
          className={t.fontMono}
          style={{
            fontSize: 13,
            padding: '7px 14px',
            cursor: refineDisabled || !refineInput.trim() ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: t.muted,
            border: `1px solid ${t.line}`,
            opacity: refineDisabled || !refineInput.trim() ? 0.5 : 1,
          }}
        >
          Refine
        </button>
        <button
          onClick={onApprove}
          className={t.fontMono}
          style={{
            fontSize: 13,
            padding: '7px 16px',
            cursor: 'pointer',
            background: t.ink,
            color: t.onAccent,
            border: `1px solid ${t.ink}`,
            fontWeight: 600,
          }}
        >
          Run pipeline
        </button>
      </div>
    </div>
  );
}
