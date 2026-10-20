'use client';

import type { LabTheme } from '../theme';
import type { ValidationIssue } from '@/lib/one-shot/validate-proposal';
import { issueRefineDirection } from '@/lib/one-shot/proposal-issues';

interface Props {
  t: LabTheme;
  issues: ValidationIssue[];
  /** Same cap as the free-text Refine (3 turns unless Force more). */
  refineDisabled: boolean;
  forceMore: boolean;
  onRefine: (direction: string, forceMore: boolean) => void;
}

/** What the validator found wrong with the proposal, with a one-click model-assisted fix. A warning, never a block. */
export function ProposalIssues({ t, issues, refineDisabled, forceMore, onRefine }: Props) {
  const direction = issueRefineDirection(issues);
  if (!direction) return null;
  return (
    <div data-testid="proposal-issues" style={{ border: `1px solid ${t.line}`, background: t.panel, padding: '12px 16px', marginBottom: 12 }}>
      <div className={t.fontMono} style={{ fontSize: 12, color: t.warn, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        Issues
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {issues.map((i, n) => (
          <div key={`${i.field}-${n}`} data-testid={`proposal-issue-${i.field}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className={t.fontMono} style={{ width: 88, flexShrink: 0, fontSize: 12, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.field}
            </span>
            <span style={{ fontSize: 13, color: t.text }}>{i.message}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => onRefine(direction, forceMore)}
        disabled={refineDisabled}
        className={t.fontMono}
        style={{
          fontSize: 12,
          padding: '5px 12px',
          cursor: refineDisabled ? 'not-allowed' : 'pointer',
          background: 'transparent',
          color: t.muted,
          border: `1px solid ${t.line}`,
          opacity: refineDisabled ? 0.5 : 1,
        }}
      >
        {`Fix ${issues.length} issue${issues.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
