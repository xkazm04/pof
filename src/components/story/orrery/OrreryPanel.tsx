'use client';
/**
 * The right-hand inspector — Inspect / Audit — and the host of the nested line-detail layer.
 *
 * The owner's directive for this surface was explicit: **"Keeping right side panel for metadata as
 * is."** So it is a port, not a redesign: the winner's two tabs, its section order, its empty
 * states and its wording, expressed through the `data-role` hooks the theme layer styles. The only
 * thing added is the fourth level the owner asked for, and it opens INSIDE this panel's body
 * (`panel/InspectBody.tsx` places it) rather than over the wheel.
 *
 * ── Three props the stub did not have, and why they are optional ────────────────────────────────
 * `focus`, `onOpenDetail` and `help` are optional so the existing composition keeps compiling while
 * `OrreryView` (another package) is written:
 *
 *   `focus`         the winner inspects the re-rooted node when nothing is selected. Without it the
 *                   panel falls back to the document overview, which is honest but less useful.
 *   `onOpenDetail`  who owns the open detail layer. Given, the parent owns it (the wheel can open
 *                   the same layer by clicking a line on the rim); omitted, this panel owns it, so
 *                   a line click in the script list works today instead of waiting for a wiring.
 *   `help`          the help card's state, shared with the topbar's `?` button. Omitted, the panel
 *                   owns it and starts shown, exactly as the winner does.
 *
 * In every case the controlled value wins when it is supplied; there is never a second authority.
 */

import { useId, useState } from 'react';
import { AuditBody } from '@/components/story/orrery/panel/AuditBody';
import { InspectBody } from '@/components/story/orrery/panel/InspectBody';
import { OverviewBody } from '@/components/story/orrery/panel/OverviewBody';
import { buildLineDetail } from '@/lib/story/orrery';
import type { LineDetail, NodeIx, OrreryModel } from '@/lib/story/orrery';

export interface OrreryPanelProps {
  model: OrreryModel;
  selected: NodeIx;
  detail: LineDetail | null;
  tab: 'inspect' | 'audit';
  onTab: (t: 'inspect' | 'audit') => void;
  onSelect: (i: NodeIx) => void;
  onCloseDetail: () => void;
  /** The node the wheel is re-rooted on; inspected when nothing is selected. */
  focus?: NodeIx;
  /** Supplied: the parent owns the detail layer. Omitted: this panel owns it. */
  onOpenDetail?: (detail: LineDetail) => void;
  help?: boolean;
  onHelp?: (open: boolean) => void;
}

export function OrreryPanel({
  model,
  selected,
  detail,
  tab,
  onTab,
  onSelect,
  onCloseDetail,
  focus,
  onOpenDetail,
  help,
  onHelp,
}: OrreryPanelProps) {
  const bodyId = useId();
  const [ownDetail, setOwnDetail] = useState<LineDetail | null>(null);
  const [ownHelp, setOwnHelp] = useState(true);

  const openDetail = detail ?? ownDetail;
  const helpOpen = help ?? ownHelp;
  // `model.root` is the DISPLAY root, which is not `R.length - 1` on a document with a single
  // top-level node: there the virtual record is unused. One authority, read from the model.
  const root = model.root;

  // Which node the Inspect tab is about. The winner shows the overview at the root, and the
  // re-rooted node once you have dived into one.
  const shown = model.R[selected] !== undefined && selected >= 0 ? selected : focus != null && focus !== root ? focus : -1;

  const select = (i: NodeIx) => {
    // Walking away from the line closes the layer that explained it: the detail belongs to one line.
    setOwnDetail(null);
    onSelect(i);
  };

  const openLine = (i: NodeIx) => {
    onSelect(i);
    const built = buildLineDetail(model, i);
    if (!built) return;
    if (onOpenDetail) onOpenDetail(built);
    else setOwnDetail(built);
  };

  const closeDetail = () => {
    setOwnDetail(null);
    onCloseDetail();
  };

  const dismissHelp = () => {
    if (onHelp) onHelp(false);
    else setOwnHelp(false);
  };

  const fromAudit = (i: NodeIx) => {
    onTab('inspect');
    select(i);
  };

  return (
    <aside
      data-role="orrery-panel"
      aria-label="Inspector"
      onKeyDown={(e) => {
        // Escape climbs one ring back out of the detail layer, wherever focus sits inside the
        // panel. It must not reach the stage's own Escape (which climbs the wheel).
        if (e.key === 'Escape' && openDetail) {
          e.stopPropagation();
          closeDetail();
        }
      }}
    >
      <div data-role="orrery-tabs" role="tablist" aria-label="Inspector tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inspect'}
          aria-controls={bodyId}
          data-role={tab === 'inspect' ? 'orrery-tab-active' : 'orrery-tab-idle'}
          onClick={() => onTab('inspect')}
        >
          Inspect
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'audit'}
          aria-controls={bodyId}
          data-role={tab === 'audit' ? 'orrery-tab-active' : 'orrery-tab-idle'}
          onClick={() => onTab('audit')}
        >
          Audit <span data-role="orrery-tabcount">{model.auditTotal}</span>
        </button>
      </div>
      <div data-role="orrery-panelbody" id={bodyId} role="tabpanel" tabIndex={-1}>
        {tab === 'audit' ? (
          <AuditBody model={model} onActivate={fromAudit} />
        ) : shown >= 0 ? (
          <InspectBody
            model={model}
            i={shown}
            detail={openDetail}
            onSelect={select}
            onOpenLine={openLine}
            onCloseDetail={closeDetail}
          />
        ) : (
          <OverviewBody model={model} help={helpOpen} onDismissHelp={dismissHelp} onSelect={select} />
        )}
      </div>
    </aside>
  );
}
