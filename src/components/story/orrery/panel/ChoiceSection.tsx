'use client';
/**
 * Two of the inspector's sections, both of them verdicts the model already reached:
 *
 *   `DecisionImpact` — what a choice actually does, in the winner's own words per class. The port
 *     carries the model's SIX classes instead of the prototype's four: `ending-shaping` and
 *     `decoration` were folded into "real" and "cosmetic" in the prototype, and they are the two a
 *     designer most needs told apart — the one that decides an ending, and the one that decides
 *     nothing.
 *   `Inside` — the census of a container, so a ring reads as a quantity and not just a sector.
 */

import { Note, RelRow, Rels, SectHead, WriteChips, condText, nf } from '@/components/story/orrery/panel/parts';
import { ScriptList } from '@/components/story/orrery/panel/ScriptList';
import type { ChoiceClass, NodeIx, OrreryModel } from '@/lib/story/orrery';

const VERDICT: Record<ChoiceClass, string> = {
  'ending-shaping':
    'Ending-shaping: an option moves a variable that an ending condition reads. This decision helps pick the ending.',
  consequential: 'A real choice: the options change state that a later guard reads.',
  routing: 'Destination-only: the options write the same state but land in different places.',
  decoration: 'Decoration: the options write state that nothing downstream reads.',
  false: 'FALSE choice: every option writes the same state AND lands in the same place.',
  single: 'Not a choice: fewer than two options are wired to an edge.',
};

const WARN = new Set<ChoiceClass>(['decoration', 'false', 'single']);

/** The winner lists at most this many children before it says how many more there are. */
const KID_CAP = 40;

export function DecisionImpact({
  model,
  i,
  onSelect,
}: {
  model: OrreryModel;
  i: NodeIx;
  onSelect: (i: NodeIx) => void;
}) {
  const c = model.R[i].ch;
  if (!c) return null;
  return (
    <>
      <SectHead>Decision impact</SectHead>
      <div
        data-role="orrery-note"
        data-tone={WARN.has(c.cls) ? 'warn' : undefined}
        style={{ fontSize: 'var(--or-fs-row)', color: WARN.has(c.cls) ? undefined : 'var(--or-ink)' }}
      >
        {VERDICT[c.cls]}
      </div>
      <dl data-role="orrery-kv">
        <dt>Spread</dt>
        <dd>
          {(c.spread * 100).toFixed(1)}% of the written variables&rsquo; domain width
          {model.spreadRef > 0 ? ` · reference ${(model.spreadRef * 100).toFixed(1)}%` : ''}
        </dd>
        <dt>Options</dt>
        <dd>
          {c.wiredCount} wired of {c.optionCount} &rarr;{' '}
          {c.diverges ? 'different destinations' : 'one destination'}
        </dd>
      </dl>
      <Rels label="Options of this decision">
        {model.out[i]
          .filter((e) => e.kind === 'option')
          .map((e) => (
            <RelRow
              key={e.id}
              dir="out"
              glyph={'↳'}
              title={
                <>
                  <b>{e.raw.optionId || 'option'}</b> &rarr; {model.R[e.to].title}
                </>
              }
              meta={
                <>
                  {e.raw.writes?.length ? <WriteChips writes={e.raw.writes} /> : 'writes nothing'}
                  {e.raw.when ? ` · if ${condText(e.raw.when)}` : ''}
                </>
              }
              onActivate={() => onSelect(e.to)}
            />
          ))}
      </Rels>
    </>
  );
}

export function Inside({
  model,
  i,
  onSelect,
  onOpenLine,
}: {
  model: OrreryModel;
  i: NodeIx;
  onSelect: (i: NodeIx) => void;
  onOpenLine: (i: NodeIx) => void;
}) {
  const R = model.R;
  const n = R[i];
  if (n.kids.length === 0) return null;

  const byClass = new Map<string, number>();
  for (const k of n.kids) {
    const kid = R[k];
    const key = kid.cls && kid.cls !== 'beat' ? kid.cls : kid.kind;
    byClass.set(key, (byClass.get(key) ?? 0) + 1);
  }
  const allLeaves = n.kids.every((k) => R[k].kids.length === 0);

  return (
    <>
      <SectHead>Inside</SectHead>
      <dl data-role="orrery-kv">
        <dt>Nodes</dt>
        <dd>{nf(n.w - 1)} below</dd>
        <dt>Children</dt>
        <dd>
          {[...byClass.entries()].map(([k, v], q) => `${q > 0 ? ', ' : ''}${v} ${k}`).join('')}
        </dd>
        {n.nChoice > 0 ? (
          <>
            <dt>Decisions</dt>
            <dd>
              {nf(n.nChoice)} ({nf(n.nChoice - n.nFalse - n.nCos)} real
              {n.nCos ? `, ${n.nCos} destination-only or decorative` : ''}
              {n.nFalse ? `, ${n.nFalse} false or unwired` : ''})
            </dd>
          </>
        ) : null}
        {n.nFlag > 0 ? (
          <>
            <dt>Audit</dt>
            <dd>
              {nf(n.nFlag)} flagged node{n.nFlag > 1 ? 's' : ''} below
            </dd>
          </>
        ) : null}
      </dl>
      {allLeaves && n.kids.length > 1 ? (
        <ScriptList model={model} cid={i} current={-1} onOpen={onOpenLine} />
      ) : (
        <>
          <Rels label="Children of this node">
            {n.kids.slice(0, KID_CAP).map((k) => (
              <RelRow
                key={k}
                dir="out"
                glyph={'▸'}
                title={R[k].title}
                meta={`${R[k].kind}${R[k].kids.length ? ` · ${nf(R[k].w - 1)} inside` : ''}`}
                onActivate={() => onSelect(k)}
              />
            ))}
          </Rels>
          {n.kids.length > KID_CAP ? (
            <Note>
              &hellip; and {nf(n.kids.length - KID_CAP)} more (the arrow keys walk them in story
              order).
            </Note>
          ) : null}
        </>
      )}
    </>
  );
}
