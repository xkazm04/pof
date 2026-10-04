'use client';
/**
 * A conversation as a script — the winner's own list of the lines inside a container whose children
 * are all leaves. It is also the list the owner's directive points at: **"one additional nested
 * layer on line click"**. Activating a row is that click, so it both selects the line and opens the
 * detail layer one ring deeper.
 */

import type { NodeIx, OrreryModel } from '@/lib/story/orrery';

/** The winner caps the list at 80 rows; the wheel's arrow keys walk the rest in story order. */
const CAP = 80;

export function ScriptList({
  model,
  cid,
  current,
  onOpen,
}: {
  model: OrreryModel;
  cid: NodeIx;
  current: NodeIx;
  onOpen: (i: NodeIx) => void;
}) {
  const R = model.R;
  const kids = R[cid].kids;
  return (
    <ol data-role="orrery-script">
      {kids.slice(0, CAP).map((k, q) => {
        const n = R[k];
        return (
          <li key={k}>
            <button
              type="button"
              data-role="orrery-script-row"
              aria-current={k === current ? 'true' : undefined}
              onClick={() => onOpen(k)}
            >
              <span data-role="orrery-script-no">{q + 1}</span>
              <span>
                {n.kind === 'choice' ? <span data-role="orrery-script-check">&#9670; </span> : null}
                {n.text ? n.text : <i>{n.title}</i>}
              </span>
            </button>
          </li>
        );
      })}
      {kids.length > CAP ? (
        <li>
          <div data-role="orrery-note">
            &hellip; and {kids.length - CAP} more lines (the arrow keys walk them in story order).
          </div>
        </li>
      ) : null}
    </ol>
  );
}
