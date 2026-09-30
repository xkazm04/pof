/**
 * Style DNA editing — the pure core behind "tune a style without re-paying".
 *
 * A distillation is a whole-board vision call; correcting one wrong chip must not need another.
 * These helpers let the operator remove / add / promote chips and see EXACTLY what reaches a
 * prompt. The preview never builds a fragment of its own: it locates each chip inside the real
 * `styleDnaToPromptFragment` output and measures the budget with the real `applyStyleFragment`,
 * so the panel cannot claim a chip is sent when injection drops it.
 */
import { err, ok, type Result } from '@/types/result';
import {
  FRAGMENT_CAP,
  STYLE_DNA_FRAGMENT_LABELS,
  STYLE_DNA_FRAGMENT_PREFIX,
  STYLE_PROMPT_MAX_LENGTH,
  applyStyleFragment,
  styleDnaToPromptFragment,
  type StyleDna,
} from './style-dna';

export type StyleDnaDim = keyof StyleDna;
export const STYLE_DNA_DIMS: readonly StyleDnaDim[] = STYLE_DNA_FRAGMENT_LABELS.map(([k]) => k);

/** Why a chip does not (fully) reach a prompt: past the per-dim cap, wholly past the char budget, or cut through by it. */
export type UnsentReason = 'cap' | 'budget' | 'cut';
export interface UnsentChip {
  item: string;
  reason: UnsentReason;
  /** Only for 'cut': how many of the chip's characters still reach the prompt. */
  keptChars?: number;
}
export interface DimPreview {
  sent: string[];
  unsent: UnsentChip[];
}
export interface StyleFragmentPreview {
  /** The real fragment, byte-for-byte what styleDnaToPromptFragment appends. */
  fragment: string;
  fragmentChars: number;
  /** How many fragment characters survive applyStyleFragment for the given prompt length. */
  fragmentCharsSent: number;
  cut: boolean;
  /** The longest prompt that still carries the whole fragment under `maxLength`. */
  fullFitPromptChars: number;
  rows: Record<StyleDnaDim, DimPreview>;
  /** One plain sentence per kind of loss, naming the chips. Empty when everything is sent. */
  dropped: string[];
}
export interface PreviewOptions {
  /** Length of the prompt the fragment rides behind. Omitted/0 = no budget analysis. */
  promptChars?: number;
  maxLength?: number;
}

const quote = (items: string[]) => items.map((i) => `“${i}”`).join(', ');

/** Char span of every emitted chip in the fragment, walking the SAME grammar the fragment uses. */
function chipSpans(dna: StyleDna): Array<{ dim: StyleDnaDim; item: string; start: number }> {
  const spans: Array<{ dim: StyleDnaDim; item: string; start: number }> = [];
  let at = STYLE_DNA_FRAGMENT_PREFIX.length;
  let first = true;
  for (const [dim, label] of STYLE_DNA_FRAGMENT_LABELS) {
    if (!dna[dim].length) continue;
    at += (first ? 0 : 2) + label.length + 1; // '; ' between parts, ' ' after the label
    first = false;
    dna[dim].slice(0, FRAGMENT_CAP).forEach((item, i) => {
      if (i > 0) at += 2; // ', '
      spans.push({ dim, item, start: at });
      at += item.length;
    });
  }
  return spans;
}

/** Exactly which chips a prompt of `promptChars` would carry, and what it drops, with why. Pure. */
export function styleFragmentPreview(dna: StyleDna, opts: PreviewOptions = {}): StyleFragmentPreview {
  const maxLength = opts.maxLength ?? STYLE_PROMPT_MAX_LENGTH;
  const promptChars = Math.max(0, Math.floor(opts.promptChars ?? 0));
  const fragment = styleDnaToPromptFragment(dna);
  let fragmentCharsSent = fragment.length;
  if (promptChars > 0) {
    const applied = applyStyleFragment('x'.repeat(promptChars), fragment, maxLength);
    fragmentCharsSent = Math.max(0, applied.length - promptChars - 2); // `${prompt}. ${fragment}`
  }
  const cut = fragmentCharsSent < fragment.length;

  const rows = Object.fromEntries(STYLE_DNA_DIMS.map((d) => [d, { sent: [], unsent: [] }])) as unknown as Record<StyleDnaDim, DimPreview>;
  for (const { dim, item, start } of chipSpans(dna)) {
    const end = start + item.length;
    if (end <= fragmentCharsSent) rows[dim].sent.push(item);
    else if (start >= fragmentCharsSent) rows[dim].unsent.push({ item, reason: 'budget' });
    else rows[dim].unsent.push({ item, reason: 'cut', keptChars: fragmentCharsSent - start });
  }
  const dropped: string[] = [];
  for (const dim of STYLE_DNA_DIMS) {
    const over = dna[dim].slice(FRAGMENT_CAP);
    rows[dim].unsent.push(...over.map((item) => ({ item, reason: 'cap' as const })));
    if (over.length) dropped.push(`${over.length} ${dim} not sent (cap ${FRAGMENT_CAP}): ${quote(over)}`);
  }
  const all = STYLE_DNA_DIMS.flatMap((d) => rows[d].unsent);
  const budget = all.filter((u) => u.reason === 'budget').map((u) => u.item);
  if (budget.length) {
    dropped.push(
      `${budget.length} ${budget.length === 1 ? 'chip' : 'chips'} past the ${maxLength}-char budget ` +
        `behind a ${promptChars}-char prompt: ${quote(budget)}`,
    );
  }
  for (const u of all.filter((x) => x.reason === 'cut')) {
    dropped.push(`“${u.item}” is cut mid-chip — ${u.keptChars} of ${u.item.length} chars reach the prompt`);
  }
  return {
    fragment,
    fragmentChars: fragment.length,
    fragmentCharsSent,
    cut,
    fullFitPromptChars: Math.max(0, maxLength - 2 - fragment.length),
    rows,
    dropped,
  };
}

export type DnaEdit = { op: 'remove' | 'add' | 'promote'; dim: StyleDnaDim; item: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Apply one chip edit. Pure: the input is never mutated, and a no-op returns it unchanged. */
export function editDna(dna: StyleDna, edit: DnaEdit): StyleDna {
  const items = dna[edit.dim];
  const idx = items.findIndex((i) => same(i, edit.item));
  if (edit.op === 'remove') return idx < 0 ? dna : { ...dna, [edit.dim]: items.filter((_, i) => i !== idx) };
  if (edit.op === 'add') {
    const chip = edit.item.trim();
    return !chip || idx >= 0 ? dna : { ...dna, [edit.dim]: [...items, chip] };
  }
  if (idx <= 0) return dna;
  return { ...dna, [edit.dim]: [items[idx], ...items.filter((_, i) => i !== idx)] };
}

/** Longest chip a style may carry — a chip is a tag, not a paragraph. */
export const MAX_CHIP_CHARS = 80;

/** Validate an (untrusted) DNA: five string arrays, no blank or over-long chip, at least one chip. */
export function validateStyleDna(input: unknown): Result<StyleDna, string> {
  if (!input || typeof input !== 'object') return err('dna must be an object with palette/materials/mood/render/motifs');
  const src = input as Record<string, unknown>;
  const out = {} as StyleDna;
  for (const dim of STYLE_DNA_DIMS) {
    const v = src[dim];
    if (!Array.isArray(v) || v.some((c) => typeof c !== 'string')) return err(`${dim} must be a list of text chips`);
    const chips = (v as string[]).map((c) => c.trim());
    if (chips.some((c) => !c)) return err(`${dim} has a blank chip`);
    const long = chips.find((c) => c.length > MAX_CHIP_CHARS);
    if (long) return err(`${dim}: a chip is ${long.length} chars — at most ${MAX_CHIP_CHARS} (“${long.slice(0, 24)}…”)`);
    out[dim] = chips;
  }
  if (STYLE_DNA_DIMS.every((d) => out[d].length === 0)) return err('style has no chips — nothing would be appended');
  return ok(out);
}
