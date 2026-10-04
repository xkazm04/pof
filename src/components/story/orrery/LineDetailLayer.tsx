'use client';
/**
 * The fourth level — the one piece of genuinely new design in this port.
 *
 * The owner's words, after choosing variant A/3:
 *
 *   "I would create one additional nested layer on line click to display detail to understand
 *    situation, predecessor, impact. Keeping right side panel for metadata as is."
 *
 * So it answers those three questions, in that order, and nothing else:
 *
 *   SITUATION      where am I — the containment ladder root -> act -> quest -> conversation ->
 *                  this line, the line's position in its conversation, and whether anybody
 *                  actually reaches it.
 *   WHAT LED HERE  what led here — the traversal edges in, with their guard and their writes, and
 *                  then, quieter, where it goes on to.
 *   WHAT IT CHANGES  per write: the variable, and the fact that decides whether the write matters
 *                  at all — WHO READS IT. An empty reader set with no ending reading it is how a
 *                  decoration becomes visible, so it is stated, never left blank.
 *
 * ── Why it is a card in the panel and not a modal ───────────────────────────────────────────────
 * The owner chose this variant for its compactness and the smoothness of its navigation, and asked
 * for a NESTED layer. A modal would cover the wheel and break both. So this is one ring deeper
 * *inside* the inspector: it opens between the line's identity and the metadata the owner said to
 * keep as is, it pushes nothing off screen, the wheel stays live behind it, and the ladder at its
 * top makes the descent literal — each row is one ring further in, ending on the row you are
 * standing on. Dismissing it returns you to exactly the level you came from, focus included.
 *
 * Every value is derived by `buildLineDetail` from the document. Nothing here is authored, nothing
 * is defaulted, and the reading prose stays in the panel, where the winner already puts it.
 */

import { useEffect, useRef } from 'react';
import {
  CardHead,
  Chip,
  Note,
  RelRow,
  Rels,
  WriteChip,
  condText,
  nf,
  writeValue,
} from '@/components/story/orrery/panel/parts';
import { ReachBars } from '@/components/story/orrery/panel/ReachBars';
import type { LineDetail, NodeIx, OrreryModel, OrreryNode } from '@/lib/story/orrery';

export interface LineDetailLayerProps {
  model: OrreryModel;
  detail: LineDetail;
  onSelect: (i: NodeIx) => void;
  onClose: () => void;
}

/** How many readers / neighbours a block lists before it says how many more there are. */
const CAP = 8;

const kindOf = (n: OrreryNode): string => (n.virtual ? 'dataset' : n.cls && n.cls !== 'beat' ? `${n.cls} · ${n.kind}` : n.kind);

export function LineDetailLayer({ model, detail, onSelect, onClose }: LineDetailLayerProps) {
  const card = useRef<HTMLElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const R = model.R;
  const node = R[detail.i];

  // Focus moves INTO the layer when it opens and back out when it closes — descending a ring and
  // climbing out again, for the keyboard exactly as for the pointer.
  useEffect(() => {
    const previous = document.activeElement;
    restoreTo.current = previous instanceof HTMLElement ? previous : null;
    card.current?.focus();
    return () => {
      const el = restoreTo.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [detail.i]);

  const axis = model.raw.profile?.axis;
  const parent = node.par >= 0 ? R[node.par] : null;
  const sibs = parent ? parent.kids : [];
  const at = parent ? sibs.indexOf(detail.i) + 1 : 0;

  // One row per write, deduplicated: the same write can sit on several edges touching this line,
  // and the reader set is per variable, so a repeat would say the same thing twice.
  const writes = new Map<string, LineDetail['impact'][number]>();
  for (const w of detail.impact) {
    const key = `${w.variable}|${w.op}|${writeValue(w.value)}`;
    if (!writes.has(key)) writes.set(key, w);
  }

  return (
    <section
      data-role="orrery-detail"
      role="group"
      aria-label={`Line detail: ${node.title}`}
      tabIndex={-1}
      ref={card}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div data-role="orrery-ctl">
        <CardHead>Line detail</CardHead>
        <div data-role="orrery-spacer" />
        <button type="button" data-role="orrery-headerbtn" onClick={onClose}>
          Close <span data-role="orrery-kbd">Esc</span>
        </button>
      </div>

      {detail.flags ? (
        <Note tone="warn">&#9873; Audit: {[...new Set(detail.flags)].join(', ')}</Note>
      ) : null}

      {/* ---- 1. situation ------------------------------------------------------------- */}
      <CardHead>Situation</CardHead>
      <Rels label="Where this line sits">
        {detail.situation.map((a, q) => {
          const last = q === detail.situation.length - 1;
          return (
            <RelRow
              key={a.i}
              dir="out"
              glyph={last ? '◆' : '▸'}
              indent={q}
              current={last}
              title={last ? <b>{a.title}</b> : a.title}
              meta={
                last
                  ? `you are here · ring ${a.depth}`
                  : `${kindOf(a)}${a.kids.length ? ` · ${nf(a.w - 1)} inside` : ''}`
              }
              onActivate={last ? undefined : () => onSelect(a.i)}
            />
          );
        })}
      </Rels>
      <dl data-role="orrery-kv">
        {parent && !parent.virtual ? (
          <>
            <dt>Position</dt>
            <dd>
              {at > 0 ? `${at} of ${sibs.length}` : 'not listed'} in {parent.title}
            </dd>
          </>
        ) : null}
        <dt>Kind</dt>
        <dd>{kindOf(node)}</dd>
        {node.axis != null ? (
          <>
            <dt>{axis?.name ?? 'Axis'}</dt>
            <dd>
              {node.axis}
              {axis?.unit && axis.unit !== axis.name ? ` ${axis.unit}` : ''}
            </dd>
          </>
        ) : null}
        {node.lanes.length > 0 ? (
          <>
            <dt>Lanes</dt>
            <dd>{node.lanes.join(', ')}</dd>
          </>
        ) : null}
      </dl>
      {model.cohorts.length > 0 ? (
        <ReachBars model={model} i={detail.i} />
      ) : (
        <Note>This document carries no reach evidence, so nothing is known about who gets here.</Note>
      )}

      {/* ---- 2. predecessors --------------------------------------------------------- */}
      <CardHead>What led here</CardHead>
      {detail.predecessors.length > 0 ? (
        <Rels label="What leads to this line">
          {detail.predecessors.slice(0, CAP).map(({ node: from, edge }) => (
            <RelRow
              key={edge.id}
              dir="in"
              glyph={'←'}
              title={from.title}
              meta={
                <>
                  {edge.kind}
                  {edge.raw.optionId ? ` · ${edge.raw.optionId}` : ''}
                  {edge.raw.when ? ` · if ${condText(edge.raw.when)}` : ''}
                  {edge.raw.writes?.length ? (
                    <>
                      <br />
                      {edge.raw.writes.map((w, k) => (
                        <WriteChip key={`${w.var}-${k}`} name={w.var} op={w.op} value={w.value} />
                      ))}
                    </>
                  ) : null}
                </>
              }
              onActivate={() => onSelect(from.i)}
            />
          ))}
        </Rels>
      ) : (
        <Note tone="warn">
          No traversal edge arrives at this line.{' '}
          {parent && !parent.virtual
            ? `It is entered by being inside ${parent.title}, not by an edge of its own.`
            : 'Nothing reaches it.'}
        </Note>
      )}
      {detail.predecessors.length > CAP ? (
        <Note>&hellip; and {detail.predecessors.length - CAP} more leading here.</Note>
      ) : null}

      <Note>On from here</Note>
      {detail.successors.length > 0 ? (
        <Rels label="Where this line goes on to">
          {detail.successors.slice(0, CAP).map(({ node: to, edge }) => (
            <RelRow
              key={edge.id}
              dir="out"
              glyph={'→'}
              title={to.title}
              meta={
                <>
                  {edge.kind}
                  {edge.raw.optionId ? ` · ${edge.raw.optionId}` : ''}
                  {edge.raw.when ? ` · if ${condText(edge.raw.when)}` : ''}
                </>
              }
              onActivate={() => onSelect(to.i)}
            />
          ))}
        </Rels>
      ) : (
        <Note>
          Nothing leads on from this line
          {node.kind === 'ending' ? ' — it is an ending.' : '; it is where this thread stops.'}
        </Note>
      )}

      {/* ---- 3. impact --------------------------------------------------------------- */}
      <CardHead>What it changes</CardHead>
      {writes.size === 0 ? (
        <Note>
          This line writes nothing, so nothing downstream can depend on having passed through it.
        </Note>
      ) : (
        <>
          <Note>Writes on the edges into and out of this line, and who reads each one later.</Note>
          {[...writes.entries()].map(([key, w]) => (
            <div key={key}>
              <WriteChip name={w.variable} op={w.op} value={w.value} />
              {w.endingReads ? (
                <Chip tone="ok" title="An ending condition reads this variable">
                  an ending reads this
                </Chip>
              ) : null}
              {w.readBy.length > 0 ? (
                <Chip title="Guards forward of this line read this variable">
                  read by {w.readBy.length} later guard{w.readBy.length === 1 ? '' : 's'}
                </Chip>
              ) : !w.endingReads ? (
                <Chip tone="warn" title="No guard and no ending reads this variable after this point">
                  nothing reads this &middot; decoration
                </Chip>
              ) : null}
              {w.readBy.length > 0 ? (
                <Rels label={`What reads ${w.variable}`}>
                  {w.readBy.slice(0, CAP).map((r) => (
                    <RelRow
                      key={r}
                      dir="influence"
                      glyph={'◌'}
                      title={R[r].title}
                      meta={`reads ${w.variable} · ${kindOf(R[r])}`}
                      onActivate={() => onSelect(r)}
                    />
                  ))}
                </Rels>
              ) : null}
              {w.readBy.length > CAP ? (
                <Note>&hellip; and {w.readBy.length - CAP} more read it.</Note>
              ) : null}
            </div>
          ))}
        </>
      )}

      {detail.influences.length > 0 ? (
        <Rels label="Influence edges at this line">
          {detail.influences.map(({ node: other, direction }, q) => (
            <RelRow
              key={`${other.i}-${direction}-${q}`}
              dir="influence"
              glyph={'◌'}
              title={other.title}
              meta={direction === 'out' ? 'influences' : 'influenced by'}
              onActivate={() => onSelect(other.i)}
            />
          ))}
        </Rels>
      ) : null}
    </section>
  );
}
