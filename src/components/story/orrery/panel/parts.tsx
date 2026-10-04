'use client';
/**
 * The inspector's leaf vocabulary — the small pieces every panel section is built from.
 *
 * Ported 1:1 from the winning prototype of the `storymap` contest (variant A/3 "Orrery"); the
 * owner's directive for this surface was **"keeping right side panel for metadata as is"**, so
 * nothing here is a redesign. Each piece emits the `data-role` hook the theme layer styles
 * (`themes/orrery.css`), which is why there is no CSS and no colour or size literal in this file:
 * the port's whole job is to put the right hook on the right element.
 *
 * Where the winner used a modifier class, the port uses the attribute the role map names:
 *   `.tag.k-choice`      -> `[data-role=orrery-tag][data-kind=choice]`
 *   `.chipw.pos/.neg`    -> `[data-role=orrery-chipw][data-sign=pos|neg]`
 *   `.chip.warn`         -> `[data-role=orrery-chip][data-tone=warn]`
 *   `.note.warn`         -> `[data-role=orrery-note][data-tone=warn]`
 *   `.rel .d.in/.inf`    -> `[data-role=orrery-rel-dir][data-dir=in|influence]`
 */

import type { ReactNode } from 'react';
import type { Cond, StoryWrite } from '@/lib/story/types';
import type { NodeIx, OrreryModel } from '@/lib/story/orrery';

/** Thousands separators, in one place. */
export const nf = (n: number): string => n.toLocaleString('en-US');

/** A guard, in the words the grammar uses. `expr` is always reported as untyped — it is a defect. */
export function condText(c: Cond | undefined): string {
  if (!c) return '';
  if ('all' in c) return c.all.map(condText).join(' AND ');
  if ('any' in c) return `(${c.any.map(condText).join(' OR ')})`;
  if ('not' in c) return `NOT ${condText(c.not)}`;
  if ('var' in c) return `${c.var} ${c.op} ${JSON.stringify(c.value)}`;
  if ('expr' in c) return `untyped: “${c.expr}”`;
  if ('flag' in c) return `flag ${c.flag}`;
  if ('visited' in c) return `visited ${c.visited}`;
  if ('axis' in c) return `axis ${c.axis.op} ${c.axis.value}`;
  if ('chance' in c) return `chance ${c.chance}`;
  if ('ref' in c) return `ref ${c.ref}`;
  return JSON.stringify(c);
}

/** The containment chain as text, skipping the virtual dataset root. */
export function pathText(model: OrreryModel, i: NodeIx): string {
  const R = model.R;
  const out: string[] = [];
  for (let p = i; p >= 0; p = R[p].par) if (!R[p].virtual) out.unshift(R[p].title);
  return out.join(' › ');
}

/**
 * Signed only where the sign is real: `add` reads as a gain and `sub` as a loss, exactly as the
 * winner tints them. `set`, `min`, `max` and `push` carry no sign, because they are not one.
 * The op comes in as a plain string here — `LineDetail.impact` carries `op: string`.
 */
const SIGN: Record<string, 'pos' | 'neg' | undefined> = { add: 'pos', sub: 'neg' };
const SYM: Record<string, string | undefined> = { add: '+', sub: '−', set: '=' };

export const writeSign = (op: string): 'pos' | 'neg' | undefined => SIGN[op];
export const writeSym = (op: string): string => SYM[op] ?? `${op} `;
/** The winner strips the quotes a JSON string would carry; a write reads as code, not as data. */
export const writeValue = (v: unknown): string => JSON.stringify(v ?? null).replace(/"/g, '');

/** One write, as the monospace chip the winner uses. Signed writes carry `data-sign`. */
export function WriteChip({ name, op, value }: { name: string; op: string; value: unknown }) {
  return (
    <span data-role="orrery-chipw" data-sign={writeSign(op)}>
      {name} {writeSym(op)}
      {writeValue(value)}
    </span>
  );
}

export function WriteChips({ writes }: { writes: readonly StoryWrite[] | undefined }) {
  if (!writes || writes.length === 0) return null;
  return (
    <>
      {writes.map((w, k) => (
        <WriteChip key={`${w.var}-${w.op}-${k}`} name={w.var} op={w.op} value={w.value} />
      ))}
    </>
  );
}

/**
 * A section head. MUST be a direct child of the panel body: the style contract resolves this role
 * with `querySelector`, and one captured inside a card measured 339px -> 309px on a property
 * nobody changed. Nested cards (the help card, the line-detail layer) use `CardHead` instead.
 */
export function SectHead({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 data-role="orrery-panel-sect" id={id}>
      {children}
    </h3>
  );
}

/** A head INSIDE a card. Same uppercase brass voice, different hook, so `panelSect` stays clean. */
export function CardHead({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h4 data-role="orrery-legend-head" id={id}>
      {children}
    </h4>
  );
}

export function Note({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'warn';
}) {
  return (
    <div data-role="orrery-note" data-tone={tone}>
      {children}
    </div>
  );
}

/**
 * An honesty chip. Colour alone never carries the claim — the label does (WCAG 1.4.1), which is
 * why every tone here also reads as words.
 */
export function Chip({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: 'warn' | 'bad' | 'ok';
  title?: string;
}) {
  return (
    <span data-role="orrery-chip" data-tone={tone} title={title}>
      {children}
    </span>
  );
}

/** `data-kind` only for the three kinds the winner tinted (`.k-choice`, `.k-ending`, `.k-gate`). */
const TINTED = new Set(['choice', 'ending', 'gate']);
export function Tag({ children, kind }: { children: ReactNode; kind?: string }) {
  return (
    <span data-role="orrery-tag" data-kind={kind && TINTED.has(kind) ? kind : undefined}>
      {children}
    </span>
  );
}

export type RelDir = 'out' | 'in' | 'influence';

/** One relation row: a glyph in a fixed gutter, a title, and a `<small>` line of edge facts. */
export function RelRow({
  dir,
  glyph,
  title,
  meta,
  onActivate,
  current,
  indent,
}: {
  dir: RelDir;
  glyph: string;
  title: ReactNode;
  meta?: ReactNode;
  onActivate?: () => void;
  current?: boolean;
  /** Ring depth below the top of the ladder — rendered as leading rule glyphs, not as padding. */
  indent?: number;
}) {
  // The ladder's rule sits in the TITLE column, not in the glyph gutter: the gutter is a fixed
  // 18px and a five-ring chain would overflow it into the title on the deepest documents.
  const rule = indent ? `${'·'.repeat(Math.min(indent, 5))} ` : '';
  const inner = (
    <>
      <span data-role="orrery-rel-dir" data-dir={dir === 'out' ? undefined : dir} aria-hidden="true">
        {glyph}
      </span>
      <span>
        {rule ? <span aria-hidden="true">{rule}</span> : null}
        {title}
        {meta ? <small>{meta}</small> : null}
      </span>
    </>
  );
  // No destination, no button: the row the reader is already standing on is a statement, not a
  // control, and a dead button is a worse affordance than plain text.
  return (
    <li>
      {onActivate ? (
        <button type="button" data-role="orrery-rel" aria-current={current ? 'true' : undefined} onClick={onActivate}>
          {inner}
        </button>
      ) : (
        <div data-role="orrery-rel" aria-current={current ? 'true' : undefined}>
          {inner}
        </div>
      )}
    </li>
  );
}

export function Rels({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul data-role="orrery-rels" aria-label={label}>
      {children}
    </ul>
  );
}
