'use client';
/**
 * The Inspect tab with nothing selected: what this document IS, and the two ways into it the winner
 * offers — its declared endings and its biggest decisions.
 *
 * The help card is the winner's `.wcard`. Its heading is a `CardHead`, NOT a `panelSect`: the style
 * contract resolves `panelSect` with `querySelector`, and nested in this card the same role measures
 * 309px instead of 339px — a 30px failure on a property nobody changed. The section heads below it
 * are the real `panelSect`s, and they are direct children of the panel body.
 */

import { CardHead, Note, RelRow, Rels, SectHead, condText, nf, pathText } from '@/components/story/orrery/panel/parts';
import type { NodeIx, OrreryModel } from '@/lib/story/orrery';

export interface OverviewBodyProps {
  model: OrreryModel;
  help: boolean;
  onDismissHelp: () => void;
  onSelect: (i: NodeIx) => void;
}

export function OverviewBody({ model, help, onDismissHelp, onSelect }: OverviewBodyProps) {
  const R = model.R;
  const raw = model.raw;
  const root = R[model.root];
  const nodes = R.length - 1;
  let decisions = 0;
  let reachRows = 0;
  for (let i = 0; i < nodes; i++) {
    if (R[i].ch) decisions++;
    if (R[i].reach) reachRows++;
  }

  return (
    <>
      {help ? (
        <div data-role="orrery-wcard" role="region" aria-label="How to read the wheel">
          <button
            type="button"
            data-role="orrery-wcard-close"
            onClick={onDismissHelp}
            aria-label="Dismiss help"
          >
            &times;
          </button>
          <CardHead>How to read the wheel</CardHead>
          <ul>
            <li>
              <b>Clockwise is story time.</b> Each ring is one level of containment (acts, quests,
              conversations, lines); a sector&rsquo;s width is how much story sits inside it.
            </li>
            <li>
              <b>Amber spikes on the rim are decisions.</b> Taller means the options change more
              state. A hollow dashed tick is a choice that changes nothing.
            </li>
            <li>
              <b>Click a sector to dive in</b>; click the centre or press Esc to climb out. Hatching
              means &ldquo;never measured&rdquo;, which is not zero.
            </li>
            <li>
              <b>Click a line to descend one more ring</b> &mdash; where it sits, what led there, and
              what it changes.
            </li>
          </ul>
          <button type="button" data-role="orrery-wcard-go" onClick={onDismissHelp}>
            Got it
          </button>
        </div>
      ) : null}

      <h2 data-role="orrery-panel-title">{raw.project || raw.graphId || root.title}</h2>
      <div data-role="orrery-mono">
        {raw.graphId} &middot; revision {raw.revision}
      </div>
      <dl data-role="orrery-kv">
        <dt>Nodes</dt>
        <dd>{nf(nodes)}</dd>
        <dt>Traversal edges</dt>
        <dd>{nf(model.tr.length)}</dd>
        <dt>Decisions</dt>
        <dd>{nf(decisions)}</dd>
        <dt>Endings</dt>
        <dd>{raw.endings.length} declared</dd>
        <dt>Variables</dt>
        <dd>{nf(raw.variables.length)}</dd>
        <dt>Axis</dt>
        <dd>
          {raw.profile.axis
            ? `${raw.profile.axis.name} ${raw.profile.axis.min}–${raw.profile.axis.max}`
            : 'none declared — order is topological'}
        </dd>
        <dt>Reach rows</dt>
        <dd>
          {nf(reachRows)} of {nf(nodes)} nodes
        </dd>
      </dl>
      {model.prov.generated ? (
        <Note tone="warn">
          Prose in this graph is generated filler, not writing. Topology, branching and guard density
          are the realistic part.
        </Note>
      ) : null}

      <SectHead>Endings</SectHead>
      {raw.endings.length === 0 ? (
        <Note>This document declares no endings.</Note>
      ) : (
        <Rels label="Declared endings">
          {raw.endings.map((e, q) => {
            const i = model.idx.get(e.node);
            if (i === undefined) return null;
            const bad = R[i].flags;
            return (
              <RelRow
                key={`${e.node}-${q}`}
                dir={bad ? 'in' : 'out'}
                glyph={bad ? '✕' : '●'}
                title={e.label || R[i].title}
                meta={
                  <>
                    {e.precedence != null ? `precedence ${e.precedence} · ` : ''}
                    {e.when ? condText(e.when) : 'no guard'}
                    {bad ? ` · ${bad.join(', ')}` : ''}
                  </>
                }
                onActivate={() => onSelect(i)}
              />
            );
          })}
        </Rels>
      )}

      <SectHead>Biggest decisions</SectHead>
      {model.topDecisions.length === 0 ? (
        <Note>No decision in this document moves state that anything reads.</Note>
      ) : (
        <Rels label="Biggest decisions">
          {model.topDecisions.slice(0, 8).map((i) => (
            <RelRow
              key={i}
              dir="out"
              glyph={'◆'}
              title={R[i].title}
              meta={`spread ${((R[i].ch?.spread ?? 0) * 100).toFixed(1)}% · ${pathText(model, R[i].par)}`}
              onActivate={() => onSelect(i)}
            />
          ))}
        </Rels>
      )}

      <Note>
        Keys: <span data-role="orrery-kbd">&larr;</span>
        <span data-role="orrery-kbd">&rarr;</span> siblings &middot;{' '}
        <span data-role="orrery-kbd">&darr;</span> into &middot;{' '}
        <span data-role="orrery-kbd">&uarr;</span> out &middot;{' '}
        <span data-role="orrery-kbd">Enter</span> dive &middot;{' '}
        <span data-role="orrery-kbd">Esc</span> up &middot;{' '}
        <span data-role="orrery-kbd">+</span>
        <span data-role="orrery-kbd">&minus;</span>
        <span data-role="orrery-kbd">0</span> zoom &middot;{' '}
        <span data-role="orrery-kbd">/</span> search
      </Note>
    </>
  );
}
