/**
 * THE ONE PRODUCE PROMPT FOR A PIPELINE STEP.
 *
 * Before this module three different builders claimed to produce "the step's prompt":
 *
 *  1. `ArchetypeStep.buildPrompt` (the lab panel) — quality pack + canon + the step's own
 *     wiring contract + cited on-screen evidence + referenced library assets. It is what the
 *     operator READS under "view prompt", and what the 📎 attachment list describes.
 *  2. `headless.ts buildStepRecipe` — canon + contract only, while its comment claimed a
 *     headless step "receives the IDENTICAL prompt".
 *  3. `POST /api/one-shot/step` (`mode:'cli'`) — the thinnest of the three: the entity JSON
 *     and the direction, and nothing else.
 *
 * (3) is the one that actually spends money. So the live dispatch sent NONE of what the panel
 * had just listed as attached — the operator saw a prompt carrying the contract the artifact
 * would be graded against, and a session ran without it. That is the standard's
 * "direction is an input, not a text box" read at prompt scale: what the operator saw
 * attached must be what was dispatched.
 *
 * `buildStepProducePrompt` is now the single source all three consume. The client never POSTs
 * a prompt string — a prompt is not client input, and accepting one would let the panel and
 * the row disagree forever. It posts the INPUTS it alone holds (the direction, the on-screen
 * evidence, the library picks) and the server rebuilds the same string from the same module.
 *
 * INJECTION ONLY. Nothing here grades, re-derives or persists anything.
 */

import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { stepContractBlock, canonCategoriesForStep } from '@/lib/catalog/contractPrompt';
import { qualityPack } from '@/lib/prompts/quality';
import { deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact } from '@/lib/status/statusModel';
import { evidenceBlock, type StepEvidence } from '@/components/layout-lab/steps/shared/stepEvidence';
import { libraryBlock } from '@/components/layout-lab/steps/shared/libraryReference';
import type { LibraryAsset } from '@/types/asset-library';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Everything the prompt needs that is NOT derivable from `(spec, entity, direction)`.
 * All optional: the off-state (`{}`) yields the canon-free, evidence-free prompt a unit test
 * or a stub-mode preview wants.
 */
export interface StepPromptInputs {
  /** Scopes the canon selection, the quality pack and the step fact. */
  catalogId?: string;
  /** Project canon — `useCanonStore().rules` on the client, `listRules()` on the server. */
  rules?: readonly ProjectRule[];
  /**
   * The REAL served artifacts this step is currently showing (`collectStepEvidence`).
   * A client-only input: only the panel knows which candidate is selected on screen.
   */
  evidence?: readonly StepEvidence[];
  /** Asset-library picks for this produce — session state in the panel, never artifact data. */
  library?: readonly LibraryAsset[];
  /**
   * Ask the session for its output as a `@@CALLBACK` block. Only a real dispatch consumes
   * one, so a stub-mode preview leaves it off rather than showing an envelope nobody reads.
   */
  callback?: boolean;
}

/**
 * The callback marker id for a step dispatch. DETERMINISTIC on purpose: the route used to
 * mint `step-${Date.now()}`, which alone made the panel preview and the dispatched string
 * impossible to compare. `awaitCallback` keys on the execution id and the marker id is only
 * an echo target (`@@CALLBACK:(\S+)`), so nothing depends on it being unique per run.
 */
export function stepCallbackId(catalogId: string, entityId: string, stepLabel: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step';
  return `step-${slug(catalogId)}-${slug(entityId)}-${slug(stepLabel)}`;
}

/** The output contract for a live dispatch: reply with exactly one callback block. */
function callbackBlock(callbackId: string): string {
  return [
    '## OUTPUT (required)',
    'Reply with exactly ONE callback block containing this step’s artifact data as JSON.',
    'Nothing outside the block is persisted.',
    `@@CALLBACK:${callbackId}`,
    '{ "<field>": "<value>" }',
    '@@END_CALLBACK',
  ].join('\n');
}

/**
 * Build the produce prompt for one pipeline step.
 *
 * Section order (stable — the goldens and the preview/dispatch equality test pin it):
 * quality pack → project canon → this step's acceptance contract → what is on screen now →
 * referenced library assets → the produce instruction + the operator's direction → output
 * contract.
 *
 * The direction falls back to `spec.defaultDirection` when the operator typed nothing, which
 * is what the panel seeds the textarea with — so an empty steer produces the step's own
 * default instruction rather than a bare "Produce X for Y." with a dangling space.
 */
export function buildStepProducePrompt(
  spec: StepSpec,
  entity: LabEntity,
  direction: string | undefined,
  inputs: StepPromptInputs = {},
): string {
  const { catalogId, rules, evidence, library, callback } = inputs;

  // Canon scope: a content-invariant step (a wrong NUMBER fails it) gets the FULL in-scope
  // canon so the threshold it will be graded by is visible; shape-only steps keep their
  // archetype slice.
  const canon = canonContextFor([...(rules ?? [])], catalogId, canonCategoriesForStep(spec));
  // Quality Program WS1: the professional-grade pack for this deliverable class (the judge's
  // own craft checklist), so production aims at the bar the judge enforces.
  const cls = catalogId ? deliverableClassOf(getStepFact(catalogId, spec.label)?.deliverable ?? '', catalogId) : null;
  const pack = cls && catalogId ? qualityPack(cls, catalogId) : '';
  // The step's OWN authored wiring contract + criteria — the thing its L2 checker grades.
  const contract = stepContractBlock(spec, entity);
  // Real artifacts the step is showing, cited by served URL. Empty ⇒ no section at all: a
  // deterministic swatch is never cited as if it were a produced asset.
  const cited = evidenceBlock(evidence ?? []);
  // Assets the project ALREADY holds, with their licenses carried through.
  const picked = libraryBlock(library ?? []);
  const dir = (direction ?? '').trim() || spec.defaultDirection?.trim() || '';
  const task = `Produce ${spec.label} for ${entity.name}. ${dir}`.trim();
  const out = callback && catalogId ? callbackBlock(stepCallbackId(catalogId, entity.id, spec.label)) : '';

  return [pack, canon, contract, cited, picked, task, out].filter(Boolean).join('\n\n');
}
