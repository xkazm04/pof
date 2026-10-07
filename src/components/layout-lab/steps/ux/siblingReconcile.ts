import { siblingStepsBlock, SIBLING_STEPS_MAX_CHARS } from '@/lib/catalog/siblingSteps';
import type { LabStepArtifact } from '../../labPipelineStore';

/**
 * Pure model behind the `?ux=sibling-check` PROTOTYPE: how one Localization string table
 * stands against the entity's other steps. Every fact here is read from data the lab already
 * holds. Nothing is graded, and no model is asked.
 *
 * - `named`: the table's stored text mentions the sibling's step label (exact, case-sensitive).
 *   On 2026-10-07 the five Localization tables the judge passed name 5–8 of their siblings.
 *   The six it failed name 0–2, except dialog-trees (5, scored 86). Four of those six
 *   verdicts (codex, crafting-recipes, screen-flow, tutorial-beats) cite a sibling step the
 *   table never mentions.
 * - `sharedKeys`: the table's own keys that the sibling also cites, matched exactly.
 * - `reach`: what the produce prompt holds of that sibling. This is decided by running the
 *   SAME `siblingStepsBlock` the prompt builder runs, so it cannot drift from the prompt.
 */

/** The `?ux=` slug that opts into this prototype. */
export const SIBLING_CHECK_UX = 'sibling-check';

/** The step this [UX] proposal is about: Localization, judge-blocked in 6 catalogs (readiness inventory `--route text`, 2026-10-07). */
export const RECONCILE_STEPS: ReadonlySet<string> = new Set(['Localization']);

/** The cap the prompt's sibling section stops at, re-exported so copy never hard-codes it. */
export const SIBLING_CAP = SIBLING_STEPS_MAX_CHARS;

/** The omission heading `siblingStepsBlock` writes (siblingSteps.ts `omissionBlock`). */
const OMITTED_HEADING = 'Omitted by prompt size cap';

/** Loc-key shapes: UPPER_SNAKE with 3+ segments (`CODEX_X_TITLE`) or dotted camel (`input.action.lightAttack`). */
const KEY_SHAPE = /\b(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}|[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*){2,})\b/g;

/** Keys the store, runner or panel write onto an artifact. They are not the step's content. */
const NOT_CONTENT = new Set(['_provenance', 'produceDirection', 'genHistory']);

export type PromptReach = 'carried' | 'dropped' | 'absent';

export interface SiblingRow {
  label: string;
  /** The server's stored status, `produced` for a local artifact it has not graded, `no output` when none exists. */
  state: string;
  produced: boolean;
  named: boolean;
  sharedKeys: string[];
  reach: PromptReach;
}

export interface SiblingReconcile {
  rows: SiblingRow[];
  /** The keys found in the table's own key list. */
  keys: string[];
  produced: number;
  named: number;
  carried: number;
  dropped: number;
}

/** Unique loc-key-shaped tokens anywhere in `value`, in first-seen order. */
export function keysIn(value: unknown): string[] {
  if (value == null) return [];
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return [...new Set(text.match(KEY_SHAPE) ?? [])];
}

/** The artifact's content as text, without the bookkeeping fields. */
export function contentText(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  return JSON.stringify(data, (k, v) => (NOT_CONTENT.has(k) ? undefined : v));
}

/** Which sibling labels a rendered sibling section carries in full, and which it names as omitted. */
export function promptReach(block: string): { carried: Set<string>; dropped: Set<string> } {
  const carried = new Set<string>();
  const dropped = new Set<string>();
  let inOmitted = false;
  for (const line of block.split('\n')) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3);
      inOmitted = heading === OMITTED_HEADING;
      // A carried heading may carry a ` (seeded …)` / ` (… template …)` suffix after the label.
      if (!inOmitted) carried.add(heading);
    } else if (inOmitted && line.startsWith('- ')) {
      dropped.add(line.slice(2));
    }
  }
  return { carried, dropped };
}

function reachOf(label: string, produced: boolean, r: { carried: Set<string>; dropped: Set<string> }): PromptReach {
  if (!produced) return 'absent';
  if (r.dropped.has(label)) return 'dropped';
  for (const heading of r.carried) if (heading === label || heading.startsWith(`${label} (`)) return 'carried';
  return 'absent';
}

/**
 * The sibling map for one step. `order` is the pipeline's step labels; stored labels the
 * pipeline no longer lists are appended, so no artifact the prompt sees is left out.
 */
export function reconcileSiblings(input: {
  catalogId: string;
  step: string;
  /** The field the step's View reads its key list from (`locKeys`, `keys`, …). */
  keyField?: string;
  data: Record<string, unknown>;
  artifacts: Record<string, LabStepArtifact> | undefined;
  /** Exactly the record ArchetypeStep hands the prompt builder. */
  siblings: Record<string, Record<string, unknown>>;
  order: readonly string[];
}): SiblingReconcile {
  const { catalogId, step, keyField, data, artifacts = {}, siblings, order } = input;
  const keys = keysIn(keyField ? data[keyField] : contentText(data));
  const table = contentText(data);
  const reach = promptReach(siblingStepsBlock(catalogId, step, siblings));
  const labels = [...order, ...Object.keys(artifacts).filter((l) => !order.includes(l))].filter((l) => l !== step);

  const rows = labels.map((label): SiblingRow => {
    const art = artifacts[label];
    const produced = !!art && !!siblings[label];
    const sibText = produced ? contentText(art.data) : '';
    return {
      label,
      state: art?.status ?? (produced ? 'produced' : 'no output'),
      produced,
      named: table.includes(label),
      sharedKeys: produced ? keys.filter((k) => sibText.includes(k)) : [],
      reach: reachOf(label, produced, reach),
    };
  });
  const made = rows.filter((r) => r.produced);
  return {
    rows,
    keys,
    produced: made.length,
    named: made.filter((r) => r.named).length,
    carried: made.filter((r) => r.reach === 'carried').length,
    dropped: made.filter((r) => r.reach === 'dropped').length,
  };
}

/** Produced siblings this table never names, in pipeline order. */
export function unnamedSiblings(r: SiblingReconcile): SiblingRow[] {
  return r.rows.filter((row) => row.produced && !row.named);
}

/**
 * The Produce direction the panel can seed: names the produced siblings the table does not
 * reconcile and asks for the two things the passing tables carry (a cross-reference per
 * sibling, a key per player-facing string). Model-facing. It quotes no sibling content and
 * invents no target.
 */
export function reconcileDirection(step: string, entityName: string, r: SiblingReconcile): string {
  const missing = unnamedSiblings(r).map((row) => row.label);
  if (missing.length === 0) return '';
  return [
    `Reconcile this ${step} table with the sibling steps it does not account for: ${missing.join(', ')}.`,
    'For each one, add a crossReferences entry that names the step and states what it binds here (a key, a label, a token or a length budget).',
    'Add a key for every player-facing string those steps declare, and remove any claim a sibling contradicts.',
    `Write the entity's name exactly as its siblings do: "${entityName}".`,
  ].join(' ');
}
