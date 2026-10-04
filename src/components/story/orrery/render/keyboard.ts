/**
 * Keyboard navigation, as a pure function from (view, selection, key) to an intent.
 *
 * Separating the intent from the effect is what makes accessibility testable here: a test can assert
 * that Right from the last sibling stays put, that Down from a leaf does nothing, that Escape from
 * the root still means "up", without a canvas, a layout pass or a fake pointer. The component's job
 * is then only to carry out the intent.
 *
 * A screen reader gets the GRAPH, not the geometry: the moves below are tree moves — between
 * siblings, into children, out to the parent — never "left on screen". On the dial, where there is
 * no containment to walk, siblings are the items sharing a lane in axis order, which is the dial's
 * own reading direction.
 */

import type { NodeIx, OrreryModel } from '@/lib/story/orrery';
import { isHubDocked, type StageView } from '@/components/story/orrery/render/hitTest';

export type KeyIntent =
  | { kind: 'none' }
  | { kind: 'select'; i: NodeIx }
  /** Enter / Space on a node: descend into a container, open a leaf's detail. */
  | { kind: 'activate'; i: NodeIx }
  /** Escape / Backspace, and Up from the top of the tree. */
  | { kind: 'up' }
  | { kind: 'zoom'; factor: number }
  | { kind: 'fit' }
  /** Home: back to the whole story. */
  | { kind: 'home' };

/** Multiplicative zoom step for `+` and `-`. Matches the buttons so both feel the same. */
export const KEY_ZOOM_STEP = 1.6;

/**
 * The lane this node is DRAWN in, or `null` when it is not on the dial.
 *
 * It reads the item's placed lane rather than re-deriving one from the node's declared lanes:
 * `layoutFlat` falls back to the first track for a node whose declared lanes earned none, so
 * re-deriving would disagree with the picture for exactly those nodes and the arrow keys would skip
 * them.
 */
export function laneIdOf(model: OrreryModel, i: NodeIx): string | null {
  const flat = model.flat;
  if (!flat) return null;
  const item = flat.items.get(i);
  if (item) return flat.lanes[item.lane] ?? null;
  for (const l of model.R[i]?.lanes ?? []) if (flat.lanes.includes(l)) return l;
  return null;
}

/** Items the arrows step through from `i`. */
export function siblingsOf(view: StageView, i: NodeIx): NodeIx[] {
  const { model, root } = view;
  const n = model.R[i];
  if (!n) return [];
  if (model.flat) {
    // Only a node that is NOT on a track is a hub dock here: an entry keeps its axis position.
    if (isHubDocked(model, i)) return [...model.dockEnds];
    const lane = laneIdOf(model, i);
    const same: NodeIx[] = [];
    for (const [j] of model.flat.items) {
      if (laneIdOf(model, j) === lane) same.push(j);
    }
    same.sort((x, y) => (model.R[x].axis ?? 0) - (model.R[y].axis ?? 0) || x - y);
    return same;
  }
  if (n.dock) {
    return model.dockEnds.includes(i) ? [...model.dockEnds] : [...(model.R[root].docks ?? [])];
  }
  const parent = n.par >= 0 ? model.R[n.par] : null;
  return parent ? [...parent.kids] : [i];
}

/** The dial's first item in axis order — where Right starts when nothing is selected. */
function firstOnDial(model: OrreryModel): NodeIx {
  let best = -1;
  if (!model.flat) return best;
  for (const [i] of model.flat.items) {
    if (model.R[i].kind === 'container') continue;
    if (best < 0 || (model.R[i].axis ?? 0) < (model.R[best].axis ?? 0)) best = i;
  }
  return best;
}

/** Where navigation starts when nothing is selected yet. */
function entryPoint(view: StageView): NodeIx {
  const { model, focus } = view;
  if (model.flat) return firstOnDial(model);
  return model.R[focus]?.kids[0] ?? -1;
}

/**
 * Translate one key press. Returns `{ kind: 'none' }` for anything this surface does not own, so the
 * caller knows not to swallow the event.
 */
export function resolveKey(view: StageView, selected: NodeIx, key: string): KeyIntent {
  const { model, focus, root } = view;
  const cur = selected >= 0 && selected < model.R.length ? selected : -1;

  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    if (cur < 0) {
      const start = entryPoint(view);
      return start >= 0 ? { kind: 'select', i: start } : { kind: 'none' };
    }
    const sibs = siblingsOf(view, cur);
    const at = sibs.indexOf(cur);
    const next = at + (key === 'ArrowRight' ? 1 : -1);
    return next >= 0 && next < sibs.length ? { kind: 'select', i: sibs[next] } : { kind: 'none' };
  }

  if (key === 'ArrowDown') {
    if (cur < 0) {
      const start = entryPoint(view);
      return start >= 0 ? { kind: 'select', i: start } : { kind: 'none' };
    }
    const kids = model.R[cur].kids;
    return kids.length > 0 ? { kind: 'select', i: kids[0] } : { kind: 'none' };
  }

  if (key === 'ArrowUp') {
    if (cur < 0) return { kind: 'up' };
    const n = model.R[cur];
    if (model.flat) {
      return n.par >= 0 && model.flat.items.has(n.par) ? { kind: 'select', i: n.par } : { kind: 'up' };
    }
    if (isHubDocked(model, cur)) return { kind: 'select', i: root };
    if (n.par >= 0 && n.par !== focus && !model.R[n.par].virtual) return { kind: 'select', i: n.par };
    return { kind: 'up' };
  }

  if (key === 'Enter' || key === ' ') {
    return cur >= 0 ? { kind: 'activate', i: cur } : { kind: 'none' };
  }
  if (key === 'Escape' || key === 'Backspace') return { kind: 'up' };
  if (key === '+' || key === '=') return { kind: 'zoom', factor: KEY_ZOOM_STEP };
  if (key === '-' || key === '_') return { kind: 'zoom', factor: 1 / KEY_ZOOM_STEP };
  if (key === '0') return { kind: 'fit' };
  if (key === 'Home') return { kind: 'home' };
  return { kind: 'none' };
}
