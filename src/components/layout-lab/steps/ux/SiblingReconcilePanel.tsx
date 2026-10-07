'use client';

import { useState, type ComponentType } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton } from '../controls';
import { DataTable } from '../shared/DataTable';
import { SIBLING_CAP, type PromptReach, type SiblingReconcile, type SiblingRow } from './siblingReconcile';
import type { LabStepArtifact } from '../../labPipelineStore';
import type { ViewDescriptor } from '@/lib/catalog/stepSpec';
import type { LabTheme } from '../../theme';

/** The step's own View renderer (`ViewPanel`), handed in so a sibling renders exactly as on its own step. */
export type SiblingView = ComponentType<{ t: LabTheme; view: ViewDescriptor; data: Record<string, unknown> }>;

export interface SiblingReconcilePanelProps {
  t: LabTheme;
  step: string;
  r: SiblingReconcile;
  keyField?: string;
  /** Each sibling step's declared View, by label (from the catalog pipeline). */
  views: Record<string, ViewDescriptor>;
  artifacts: Record<string, LabStepArtifact> | undefined;
  View: SiblingView;
  seeded: boolean;
  onSeed: () => void;
}

const REACH_WORD: Record<PromptReach, string> = {
  carried: '✓ in full',
  dropped: '✕ name only (cap)',
  absent: '— no output',
};

const COLUMNS = [
  { key: 'state', label: 'Output' },
  { key: 'named', label: 'Named here' },
  { key: 'keys', label: 'Keys shared' },
  { key: 'reach', label: 'In the prompt' },
];

const tableRows = (rows: SiblingRow[]) => rows.map((row) => ({
  label: row.label,
  values: {
    state: row.state,
    named: row.named ? '✓ named' : '✕ not named',
    keys: row.sharedKeys.length ? String(row.sharedKeys.length) : '—',
    reach: REACH_WORD[row.reach],
  },
}));

const list = (labels: string[]) => labels.join(', ');

/** One sibling's own View, rendered only while it is open, so a closed list costs nothing. */
function SiblingCompare({ t, row, view, data, View }: { t: LabTheme; row: SiblingRow; view: ViewDescriptor; data: Record<string, unknown>; View: SiblingView }) {
  const [open, setOpen] = useState(false);
  return (
    <details data-testid={`sibling-compare-${row.label}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{ borderTop: `1px solid ${t.line}`, padding: '6px 0' }}>
      <summary className={`focus-ring ${t.fontMono}`} style={{ cursor: 'pointer', fontSize: 14, color: t.text }}>
        Compare: {row.label}{row.named ? '' : ' · not named here'}
      </summary>
      {open && <div style={{ paddingTop: 8 }}><View t={t} view={view} data={data} /></div>}
    </details>
  );
}

/**
 * PROTOTYPE (`?ux=sibling-check`): the Localization string table set against the entity's
 * other steps, for the check a judge-blocked table needs before a re-produce. Which siblings
 * the table accounts for, which of its keys they share, what the produce prompt will actually
 * carry of each, and each sibling's own View one click away. Display plus one input action
 * (seed the Produce direction). It never grades, never dispatches and cannot move a verdict.
 */
export function SiblingReconcilePanel({ t, step, r, keyField, views, artifacts, View, seeded, onSeed }: SiblingReconcilePanelProps) {
  const unnamed = r.rows.filter((row) => row.produced && !row.named);
  const unseen = unnamed.filter((row) => row.reach === 'dropped').map((row) => row.label);
  const comparable = r.rows.filter((row) => row.produced && views[row.label] && views[row.label].kind !== 'gallery');
  const line = { fontSize: 14, lineHeight: 1.5, color: t.text } as const;
  const block = { display: 'grid', gap: 6 } as const;

  return (
    <div data-testid="sibling-check-desk" style={{ display: 'grid', gap: 16 }}>
      <div style={block}>
        <span data-testid="sibling-named" style={{ ...line, fontWeight: 600 }}>
          This {step} table names {r.named} of its {r.produced} produced sibling steps.
        </span>
        <span data-testid="sibling-reach" style={line}>
          The produce prompt carries {r.carried} of them in full.{' '}
          {r.dropped
            ? `${r.dropped} more are cut by its ${SIBLING_CAP.toLocaleString('en-US')}-character sibling section and reach the model by name only.`
            : 'None is cut by the sibling-section cap.'}
        </span>
        <span style={{ ...line, color: t.muted }}>
          {r.keys.length} keys in this table{keyField ? `’s ${keyField} list` : ''}. Keys shared counts the ones a sibling also cites, matched exactly.
        </span>
      </div>

      <DataTable t={t} testId="sibling-table" columns={COLUMNS} rows={tableRows(r.rows)} header={['Sibling step', '']} />

      {comparable.length > 0 && (
        <div style={block}>
          <MicroLabel mono uppercase tone="muted">Compare without leaving this step</MicroLabel>
          <div>
            {comparable.map((row) => (
              <SiblingCompare key={row.label} t={t} row={row} view={views[row.label]}
                data={artifacts?.[row.label]?.data ?? {}} View={View} />
            ))}
          </div>
        </div>
      )}

      <div style={{ ...block, borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
        <MicroLabel mono uppercase tone="muted">Next move</MicroLabel>
        {unnamed.length === 0 ? (
          <span data-testid="sibling-all-named" style={line}>Every produced sibling is named in this table.</span>
        ) : (
          <>
            <div>
              <LabButton t={t} testId="sibling-seed-direction" onClick={onSeed}>
                Seed a reconcile direction for the {unnamed.length} unnamed sibling{unnamed.length === 1 ? '' : 's'}
              </LabButton>
            </div>
            {seeded && (
              <span data-testid="sibling-seeded" role="status" style={{ ...line, color: t.ok }}>
                ✓ Placed in the Produce direction box. Read it there before you dispatch.
              </span>
            )}
            {unseen.length > 0 && (
              <span data-testid="sibling-unseen" style={{ ...line, color: t.warn }}>
                ⚠ {list(unseen)} {unseen.length === 1 ? 'is' : 'are'} cut from the prompt, so a re-produce sees only {unseen.length === 1 ? 'its name' : 'their names'}. Open {unseen.length === 1 ? 'it' : 'them'} under Compare and paste what this table must cover into the direction before you dispatch.
              </span>
            )}
            <span style={{ ...line, color: t.muted }}>Seeding fills the direction box only. Nothing is dispatched or graded here.</span>
          </>
        )}
      </div>
    </div>
  );
}
