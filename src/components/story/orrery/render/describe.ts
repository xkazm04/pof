/**
 * What the wheel SAYS about a node — to a screen reader through the live region, and to a pointer
 * through the tooltip. Pure strings from the model, no DOM.
 *
 * Rule 8 of the brief: a screen reader gets the graph, not the geometry. Nothing announced here
 * mentions an angle, a ring or a pixel. It names the node, where it sits in the story, what is
 * inside it, what it connects to, whether its reach was measured — and, if the audit flagged it,
 * why.
 */

import type { ChoiceClass, OrreryModel, OrreryNode, NodeIx } from '@/lib/story/orrery';

/** How each choice class reads out loud. The port's own class names, not the prototype's. */
const CHOICE_SPOKEN: Record<ChoiceClass, string> = {
  'ending-shaping': 'a choice that shapes which ending you reach',
  consequential: 'a choice something later reads',
  routing: 'a choice of route only',
  decoration: 'a choice that writes nothing anything reads',
  false: 'a FALSE choice: every option does the same thing',
  single: 'an unwired choice',
};

/** The same, compressed for a tooltip. */
const CHOICE_SHORT: Record<ChoiceClass, string> = {
  'ending-shaping': 'ending-shaping choice',
  consequential: 'consequential choice',
  routing: 'routing choice',
  decoration: 'decorative choice',
  false: 'FALSE choice',
  single: 'unwired choice',
};

const plural = (n: number, word: string) => `${n} ${n === 1 || /s$/.test(word) ? word : word + 's'}`;
const count = (n: number) => n.toLocaleString('en-US');

/** The node's own class label from the profile, falling back to its core kind. */
export function classLabel(model: OrreryModel, n: OrreryNode): string {
  const declared = (model.raw.profile.nodeClasses ?? []).find((c) => c.id === n.cls);
  return declared && n.cls !== 'beat' ? declared.label.toLowerCase() : n.kind;
}

/** One sentence per fact, joined — what the live region says when the selection moves. */
export function describeNode(model: OrreryModel, i: NodeIx): string {
  const R = model.R;
  const n = R[i];
  if (!n) return '';
  const parts: string[] = [];
  const cls = classLabel(model, n);
  parts.push(
    n.title + ', ' + cls + (cls !== n.kind && n.kind !== 'container' ? ` (${n.kind})` : ''),
  );

  const parent = n.par >= 0 ? R[n.par] : null;
  if (parent && !parent.virtual) {
    const at = parent.kids.indexOf(i) + 1;
    parts.push(at > 0 ? `${at} of ${parent.kids.length} in ${parent.title}` : `in ${parent.title}`);
  }
  if (n.kids.length > 0) {
    const by = new Map<string, number>();
    for (const k of n.kids) {
      const key = classLabel(model, R[k]);
      by.set(key, (by.get(key) ?? 0) + 1);
    }
    parts.push('contains ' + [...by].map(([k, v]) => plural(v, k)).join(', '));
  }
  if (n.ch) parts.push(CHOICE_SPOKEN[n.ch.cls]);

  const outs = (model.out[i] ?? []).slice(0, 4).map((e) => R[e.to].title);
  const ins = (model.inn[i] ?? []).slice(0, 3).map((e) => R[e.from].title);
  if (outs.length > 0) {
    const more = (model.out[i]?.length ?? 0) - 4;
    parts.push('connects to ' + outs.join(', ') + (more > 0 ? ` and ${more} more` : ''));
  }
  if (ins.length > 0) {
    const more = (model.inn[i]?.length ?? 0) - 3;
    parts.push('reached from ' + ins.join(', ') + (more > 0 ? ' and more' : ''));
  }

  // The honesty rule, spoken: unmeasured is never read out as a figure, and a derived figure says
  // so. `reachMeasured` is the model's own authority for "something below this was measured".
  if (model.cohorts.length > 0) {
    if (n.reach) {
      parts.push(
        'reach measured' +
          (model.prov.unverified ? ', unverified' : '') +
          (model.prov.provisional ? ', provisional' : ''),
      );
    } else if (n.reachMean) {
      parts.push(`reach derived from ${plural(n.reachMeasured, 'measured descendant')}`);
    } else {
      parts.push('no reach row: never measured, which is not zero');
    }
  }
  if (n.flags) parts.push('audit: ' + [...new Set(n.flags)].join(', '));
  return parts.join('. ');
}

/** What the live region says when nothing is selected. */
export function describeWhole(model: OrreryModel, rootIx: NodeIx): string {
  const root = model.R[rootIx];
  const label = root?.virtual ? model.raw.project : root?.title ?? model.raw.project;
  const nodes = model.raw.nodes.length;
  return (
    `${label} loaded: ${count(nodes)} nodes. ` +
    'Press an arrow key to start walking the story, or Tab to the controls.'
  );
}

/** The tooltip's second line: what this thing is, in as few words as stay honest. */
export function describeShort(model: OrreryModel, n: OrreryNode): string {
  let s = n.kind + (n.cls && n.cls !== 'beat' && n.cls !== n.kind ? ' · ' + n.cls : '');
  if (n.kids.length > 0) s += ` · ${count(n.w - 1)} inside`;
  if (n.ch) s += ' · ' + CHOICE_SHORT[n.ch.cls];
  if (n.flags) s += ' · flagged';
  return s;
}

/** The hub's tooltip: where you are, and what clicking the centre does. */
export function describeHub(model: OrreryModel, focus: NodeIx, rootIx: NodeIx): string {
  return focus === rootIx ? 'centre: the whole story' : 'centre: click to go up one level';
}

/** The stage's own `aria-label`. States the controls, because the canvas cannot show them. */
export const STAGE_LABEL =
  'Orrery story wheel. Arrow keys move between nodes, Enter opens the one you are on, ' +
  'Escape goes up a level, plus and minus zoom, zero fits the whole story.';
