'use client';
/**
 * The Audit tab: every group the model computed, with its count, its reason, and its items.
 *
 * Activating an item selects that node and switches back to Inspect — the winner's behaviour, and
 * the whole point of the tab: a finding you cannot walk to is a list, not a tool.
 *
 * Nothing here consults a list of known problems. The groups are computed from the document when it
 * loads, which is why the count can be zero and why a zero reads as a measured zero (green), not as
 * "not looked at".
 */

import { Note, RelRow, Rels, SectHead, pathText } from '@/components/story/orrery/panel/parts';
import type { AuditGroup, NodeIx, OrreryModel } from '@/lib/story/orrery';

/** The winner opens a group that has items and is short enough to read at a glance. */
const AUTO_OPEN_MAX = 12;
/** And lists this many items before it counts the rest. */
const ITEM_CAP = 60;

const tone = (g: AuditGroup, n: number): 'zero' | 'warn' | undefined =>
  n === 0 ? 'zero' : g.severity === 'error' ? undefined : 'warn';

export function AuditBody({
  model,
  onActivate,
}: {
  model: OrreryModel;
  /** Select the node AND return to Inspect. */
  onActivate: (i: NodeIx) => void;
}) {
  const R = model.R;
  return (
    <>
      <h2 data-role="orrery-panel-title">Audit</h2>
      <Note>
        Computed from the data when it loaded: reachability, variable declarations, writers, domains,
        guards, budgets, option wiring. No list of known problems is consulted. Flags also show as
        rose marks on the rim.
      </Note>
      <div>
        {model.audit.map((g) => {
          const n = g.items.length;
          return (
            <details key={g.id} open={n > 0 && n <= AUTO_OPEN_MAX}>
              <summary data-role="orrery-audit-group">
                <b>{g.title}</b>
                <span data-role="orrery-audit-count" data-tone={tone(g, n)}>
                  {n}
                </span>
              </summary>
              <div data-role="orrery-audit-why">{g.why}</div>
              {n > 0 ? (
                <ul data-role="orrery-audit-items">
                  {g.items.slice(0, ITEM_CAP).map((it, q) => (
                    <li key={`${g.id}-${it.i}-${q}`}>
                      {it.i >= 0 ? (
                        <button
                          type="button"
                          data-role="orrery-audit-item"
                          onClick={() => onActivate(it.i)}
                        >
                          {it.text}
                        </button>
                      ) : (
                        <div data-role="orrery-note">{it.text}</div>
                      )}
                    </li>
                  ))}
                  {n > ITEM_CAP ? (
                    <li>
                      <div data-role="orrery-note">&hellip; and {n - ITEM_CAP} more.</div>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </details>
          );
        })}
      </div>

      <SectHead>Biggest decisions</SectHead>
      {model.topDecisions.length === 0 ? (
        <Note>No decision in this document moves state that anything reads.</Note>
      ) : (
        <Rels label="Biggest decisions">
          {model.topDecisions.map((i) => (
            <RelRow
              key={i}
              dir="out"
              glyph={'◆'}
              title={R[i].title}
              meta={`spread ${((R[i].ch?.spread ?? 0) * 100).toFixed(1)}% · ${pathText(model, R[i].par)}`}
              onActivate={() => onActivate(i)}
            />
          ))}
        </Rels>
      )}
    </>
  );
}
