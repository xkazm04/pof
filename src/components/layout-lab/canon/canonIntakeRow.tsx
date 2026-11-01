'use client';

import type { LabTheme } from '../theme';
import type { IntakeDecision, IntakeStatus, StoredIntakeProposal } from '@/lib/games/intake/types';
import type { StatusLevel } from '@/lib/status-token';
import { StatusTag } from '@/components/ui/StatusTag';
import { DataTable } from '../steps/shared/DataTable';
import { LabButton } from '../steps/controls';

const STATUS_LEVEL: Record<IntakeStatus, StatusLevel> = { pending: 'warn', accepted: 'ok', rejected: 'bad' };

/** What the reviewer needs to judge a proposal, as label · value rows (the payload, not the prose). */
function detailValues(p: StoredIntakeProposal): { columns: { key: string; label: string }[]; values: Record<string, unknown> } {
  if (p.kind === 'rule' && p.rule) {
    return {
      columns: [{ key: 'id', label: 'Rule id' }, { key: 'category', label: 'Category' }, { key: 'scope', label: 'Scope' }, { key: 'profile', label: 'Profile' }],
      values: { id: p.rule.id, category: p.rule.category, scope: p.rule.scope, profile: p.rule.profile },
    };
  }
  const e = p.entity;
  const data = e?.data && typeof e.data === 'object' && Object.keys(e.data).length > 0 ? e.data : null;
  return {
    columns: [{ key: 'entityId', label: 'Entity id' }, { key: 'catalogId', label: 'Catalog' }, { key: 'tags', label: 'Tags' }, { key: 'data', label: 'Data' }],
    values: { entityId: e?.entityId, catalogId: e?.catalogId, tags: e?.tags?.length ? e.tags : null, data },
  };
}

/** One proposal: title, status, the pitch quote it came from, its payload, and accept/reject while pending. */
export function CanonIntakeRow({ t, proposal, busy, onDecide }: {
  t: LabTheme;
  proposal: StoredIntakeProposal;
  busy: boolean;
  onDecide: (id: string, decision: IntakeDecision) => void;
}) {
  const title = proposal.kind === 'rule' ? proposal.rule?.title : proposal.entity?.name;
  const { columns, values } = detailValues(proposal);
  return (
    <article data-testid="canon-intake-row" data-id={proposal.id} data-status={proposal.status}
      style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: '14px 16px', background: t.panel, marginBottom: 10, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className={t.fontBody} style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep, flex: 1, minWidth: 180 }}>{title || proposal.id}</span>
        <StatusTag level={STATUS_LEVEL[proposal.status]} word={proposal.status} />
        {proposal.status === 'pending' && (
          <>
            <LabButton t={t} disabled={busy} onClick={() => onDecide(proposal.id, 'accept')} testId="canon-intake-accept">Accept</LabButton>
            <LabButton t={t} disabled={busy} onClick={() => onDecide(proposal.id, 'reject')} testId="canon-intake-reject">Reject</LabButton>
          </>
        )}
      </div>
      {proposal.kind === 'rule' && proposal.rule?.body && (
        <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{proposal.rule.body}</p>
      )}
      <blockquote data-testid="canon-intake-source" className={t.fontBody}
        style={{ margin: 0, padding: '6px 12px', borderLeft: `3px solid ${t.line}`, color: t.muted, fontSize: 14, fontStyle: 'italic' }}>
        {proposal.sourceSection}
      </blockquote>
      <DataTable t={t} columns={columns} values={values} missingText="—" />
    </article>
  );
}
