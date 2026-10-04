'use client';
/**
 * The Inspect tab for one node — the panel the owner said to keep **as is**, ported section for
 * section from the winner: identity, text, decision impact, the container census, the script of the
 * conversation it sits in, reach, connections.
 *
 * The one addition is the nested layer the owner asked for, and it is placed deliberately: AFTER
 * the identity (you must know what you clicked) and BEFORE the prose and the metadata (which are
 * unchanged, and still below it). Nothing is removed to make room for it.
 */

import { LineDetailLayer } from '@/components/story/orrery/LineDetailLayer';
import { Chip, Note, SectHead, Tag, pathText } from '@/components/story/orrery/panel/parts';
import { DecisionImpact, Inside } from '@/components/story/orrery/panel/ChoiceSection';
import { Connections } from '@/components/story/orrery/panel/Connections';
import { ReachBars } from '@/components/story/orrery/panel/ReachBars';
import { ScriptList } from '@/components/story/orrery/panel/ScriptList';
import type { LineDetail, NodeIx, OrreryModel } from '@/lib/story/orrery';

export interface InspectBodyProps {
  model: OrreryModel;
  i: NodeIx;
  /** The open detail layer, or null. Rendered only for the node it belongs to. */
  detail: LineDetail | null;
  onSelect: (i: NodeIx) => void;
  /** A line click: select it and descend one ring. */
  onOpenLine: (i: NodeIx) => void;
  onCloseDetail: () => void;
}

export function InspectBody({ model, i, detail, onSelect, onOpenLine, onCloseDetail }: InspectBodyProps) {
  const R = model.R;
  const n = R[i];
  const parent = n.par >= 0 ? R[n.par] : null;
  const words = n.text ? n.text.trim().split(/\s+/).length : 0;
  // The winner's rule for "this node is a line in a conversation": its parent's children are all
  // leaves, so the parent is a script and this is one of its rows.
  const inScript =
    parent && !parent.virtual && parent.kids.length > 1 && parent.kids.every((k) => R[k].kids.length === 0);

  return (
    <>
      <h2 data-role="orrery-panel-title">{n.title}</h2>
      <div data-role="orrery-mono">{n.id}</div>
      <div data-role="orrery-tags">
        <Tag kind={n.kind}>{n.kind}</Tag>
        {n.cls && n.cls !== 'beat' ? <Tag>{n.cls}</Tag> : null}
        {n.raw.status ? <Tag>status: {n.raw.status}</Tag> : null}
        {n.raw.authoring ? <Tag>{n.raw.authoring}</Tag> : null}
        {n.axis != null ? (
          <Tag>
            {model.raw.profile?.axis?.name ?? 'axis'} {n.axis}
          </Tag>
        ) : null}
      </div>
      {parent && !parent.virtual ? <Note>{pathText(model, parent.i)}</Note> : null}
      {n.flags ? <Note tone="warn">&#9873; Audit: {[...new Set(n.flags)].join(', ')}</Note> : null}

      {detail && detail.i === i ? (
        <LineDetailLayer model={model} detail={detail} onSelect={onSelect} onClose={onCloseDetail} />
      ) : null}

      {n.text ? (
        <>
          <SectHead>Text &middot; {words} words</SectHead>
          {model.prov.generated ? (
            <Note tone="warn">
              Generated filler &mdash; not authored writing. Shown only so layout and reading
              comfort can be judged.
            </Note>
          ) : null}
          <div
            data-role="orrery-reading"
            data-filler={model.prov.generated ? 'true' : undefined}
            tabIndex={0}
            aria-label="Node text"
          >
            {n.text}
          </div>
        </>
      ) : null}

      <DecisionImpact model={model} i={i} onSelect={onSelect} />
      <Inside model={model} i={i} onSelect={onSelect} onOpenLine={onOpenLine} />

      {inScript && parent ? (
        <>
          <SectHead>Script &middot; {parent.title}</SectHead>
          {model.prov.generated ? <Note tone="warn">Generated filler &mdash; not authored writing.</Note> : null}
          <ScriptList model={model} cid={parent.i} current={i} onOpen={onOpenLine} />
        </>
      ) : null}

      {model.cohorts.length > 0 ? (
        <>
          <SectHead>Reach{model.prov.provisional ? ' · provisional' : ''}</SectHead>
          <div data-role="orrery-tags">
            {model.prov.unverified ? (
              <Chip tone="warn" title="evidence.runs graphHash is null: reach rows are not pinned to a graph version">
                unverified &middot; graphHash null
              </Chip>
            ) : null}
            {model.prov.provisional ? (
              <Chip tone="warn" title="Transcribed from a design document that calls these figures provisional">
                provisional &middot; from a design doc
              </Chip>
            ) : null}
          </div>
          <ReachBars model={model} i={i} />
        </>
      ) : null}

      <Connections model={model} i={i} onSelect={onSelect} />
    </>
  );
}
