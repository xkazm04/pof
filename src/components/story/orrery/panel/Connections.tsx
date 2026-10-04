'use client';
/**
 * The selected node's edges — out, in, and the influence layer — in the winner's one list.
 *
 * `contains` never appears: containment is the wheel's rings, not a connection, and the model has
 * already excluded it. An empty list says WHY it is empty, because "no edges here" and "its
 * children carry the edges" are different facts about a container.
 */

import { Note, RelRow, Rels, SectHead, WriteChips, condText } from '@/components/story/orrery/panel/parts';
import type { NodeIx, OrreryEdge, OrreryModel } from '@/lib/story/orrery';

/** The winner lists 18 rows before it counts the rest. */
const CAP = 18;

interface Item {
  glyph: string;
  dir: 'out' | 'in' | 'influence';
  to: NodeIx;
  edge: OrreryEdge;
  label: string;
}

export function Connections({
  model,
  i,
  onSelect,
}: {
  model: OrreryModel;
  i: NodeIx;
  onSelect: (i: NodeIx) => void;
}) {
  const R = model.R;
  const n = R[i];
  const items: Item[] = [];
  for (const e of model.out[i]) {
    items.push({ glyph: '→', dir: 'out', to: e.to, edge: e, label: e.kind + (e.raw.optionId ? ` · ${e.raw.optionId}` : '') });
  }
  for (const e of model.inn[i]) {
    items.push({ glyph: '←', dir: 'in', to: e.from, edge: e, label: e.kind + (e.raw.optionId ? ` · ${e.raw.optionId}` : '') });
  }
  for (const e of model.infl) {
    if (e.from === i) {
      items.push({ glyph: '◌', dir: 'influence', to: e.to, edge: e, label: `influences${e.raw.label ? ` · ${e.raw.label}` : ''}` });
    } else if (e.to === i) {
      items.push({ glyph: '◌', dir: 'influence', to: e.from, edge: e, label: `influenced by${e.raw.label ? ` · ${e.raw.label}` : ''}` });
    }
  }

  if (items.length === 0) {
    return (
      <>
        <SectHead>Connections</SectHead>
        <Note>
          No traversal edges at this node
          {n.kids.length ? ' itself; its children carry the edges.' : '.'}
        </Note>
      </>
    );
  }

  return (
    <>
      <SectHead>Connections &middot; {items.length}</SectHead>
      <Rels label="Relations of the selected node">
        {items.slice(0, CAP).map((it, q) => (
          <RelRow
            key={`${it.edge.id}-${it.dir}-${q}`}
            dir={it.dir}
            glyph={it.glyph}
            title={R[it.to].title}
            meta={
              <>
                {it.label}
                {it.edge.raw.when ? ` · if ${condText(it.edge.raw.when)}` : ''}
                {it.edge.raw.writes?.length && n.kind !== 'choice' ? (
                  <>
                    <br />
                    <WriteChips writes={it.edge.raw.writes} />
                  </>
                ) : null}
              </>
            }
            onActivate={() => onSelect(it.to)}
          />
        ))}
      </Rels>
      {items.length > CAP ? <Note>&hellip; and {items.length - CAP} more.</Note> : null}
    </>
  );
}
