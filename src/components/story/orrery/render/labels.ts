/**
 * Label fitting. The owner's hard constraint is "comprehend the story without overflowing of text
 * in the map view", so no label is ever drawn on faith: every candidate is MEASURED, then truncated
 * with an ellipsis, then dropped.
 *
 * Measuring is abstracted behind {@link TextMeasurer} for one reason that matters: it makes this
 * logic testable. jsdom has no canvas 2D context, so a fake measurer (a width per character) lets a
 * test prove the truncation is correct and the drop is real, rather than trusting a screenshot.
 */

import type { OrreryModel, OrreryNode } from '@/lib/story/orrery';

/** Anything that can tell how wide a string renders. A canvas context satisfies it as-is. */
export interface TextMeasurer {
  measureText: (text: string) => { width: number };
}

const ELLIPSIS = '…';

/**
 * The first candidate that fits, else the first candidate truncated to fit, else `null`.
 *
 * Truncation binary-searches the character count rather than stepping, so a 180-word line costs
 * about eight measurements instead of a hundred and eighty. Below 30px of room nothing is drawn: an
 * ellipsis on its own is noise, not information.
 */
export function fitText(m: TextMeasurer, candidates: readonly (string | null | undefined)[], avail: number): string | null {
  for (const t of candidates) {
    if (!t) continue;
    if (m.measureText(t).width <= avail) return t;
  }
  const full = candidates.find((c): c is string => !!c);
  if (!full || avail < 30) return null;
  let lo = 0;
  let hi = full.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m.measureText(full.slice(0, mid) + ELLIPSIS).width <= avail) lo = mid;
    else hi = mid - 1;
  }
  return lo >= 3 ? full.slice(0, lo).trimEnd() + ELLIPSIS : null;
}

/**
 * Wrap into at most `maxLines` lines of at most `maxWidth`, ellipsising the last one. A word longer
 * than the line is itself cut, so a single unbroken token cannot overflow either.
 */
export function wrapText(m: TextMeasurer, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (m.measureText(next).width <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ELLIPSIS;
  }
  return lines.map((line) => {
    let l = line;
    while (l.length > 3 && m.measureText(l).width > maxWidth) l = l.slice(0, -2) + ELLIPSIS;
    return l;
  });
}

/** The title with a leading "Act 3: " style prefix dropped — the second candidate for a tight arc. */
export function shortTitle(n: OrreryNode): string {
  const t = n.title;
  const at = t.indexOf(': ');
  return at > 0 && at < t.length - 3 ? t.slice(at + 2) : t;
}

/**
 * The last dotted segment of the id, with a bare line number's `l` prefix stripped — the shortest
 * honest thing a sector can be called when even the short title will not fit.
 */
export function tailLabel(model: OrreryModel, n: OrreryNode): string {
  if (n.par < 0 || model.R[n.par]?.virtual) return n.id;
  const parts = n.id.split('.');
  let s = parts[parts.length - 1];
  if (/^l\d+$/.test(s)) s = s.slice(1);
  return s;
}

/** The three candidates a ring label tries, longest first. */
export function labelCandidates(model: OrreryModel, n: OrreryNode): string[] {
  return [n.title, shortTitle(n), tailLabel(model, n)];
}
