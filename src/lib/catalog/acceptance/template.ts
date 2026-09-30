/**
 * TEMPLATE — a stub produce body written for an entity other than its catalog's exemplar.
 *
 * 31 of 33 pipeline files never read `entity.data`: their bodies are the exemplar entity's authored
 * content (Captain Vael's stats, Fireball's numbers) with the name swapped in. When such a body is
 * persisted for ANY other entity, the row is the exemplar's template, not that entity's content —
 * so, exactly like SOURCED (`sourced.ts`), the step's own checker still runs (a template that FAILS
 * it stays `fail`), but a would-be `pass` is held at `pending` with a greppable `TEMPLATE:` reason
 * naming the exemplar. The stamp is written by `stampTemplate` (`@/lib/catalog/produceTemplate`) at
 * the stub write sites, which OBSERVES data-blindness rather than trusting a declaration.
 *
 * Applied once, at pipeline registration (composed with `sourcedGuard`), so every grading path reads
 * the same guarded checker.
 */
import { TEMPLATE_MARKER } from './markers';
import type { AcceptanceResult, Checker } from './types';

/**
 * The artifact field that carries the stamp. PROVENANCE, not graded content: only the registration
 * guard reads it (the spec linter's content-read probe exempts it by this constant).
 */
export const TEMPLATE_FIELD = 'template';

/** What a stub-written artifact carries in `data.template`. */
export interface TemplateStamp {
  /** The catalog exemplar whose content the data-blind body writes. */
  exemplar: string;
  /** The entity the stub was written for. */
  entity: string;
}

export function templateStampOf(data: Record<string, unknown> | undefined): TemplateStamp | null {
  const s = data?.[TEMPLATE_FIELD] as Partial<TemplateStamp> | undefined;
  return s && typeof s === 'object' && typeof s.exemplar === 'string' && typeof s.entity === 'string'
    ? (s as TemplateStamp)
    : null;
}

export function heldAsTemplate(result: AcceptanceResult, stamp: TemplateStamp): AcceptanceResult {
  return {
    ...result,
    status: 'pending',
    reason: `${TEMPLATE_MARKER}: ${stamp.exemplar} template, not produced for this entity (${stamp.entity}) — `
      + `the step body does not read the entity, so it wrote the exemplar's content with the name swapped in. `
      + `Its checker passes the shape; produce this step live for ${stamp.entity} to grade it.`,
  };
}

/** Wrap a step checker so a template artifact can never grade `pass`. Hidden checker tags are preserved. */
export function templateGuard(checker: Checker): Checker {
  const wrapped: Checker = (data, ctx) => {
    const result = checker(data, ctx);
    const stamp = result.status === 'pass' ? templateStampOf(data) : null;
    return stamp ? heldAsTemplate(result, stamp) : result;
  };
  // Carry the symbol tags (content-invariant, canon-law) that callers introspect on the checker.
  for (const sym of Object.getOwnPropertySymbols(checker)) {
    Object.defineProperty(wrapped, sym, { value: (checker as unknown as Record<symbol, unknown>)[sym], enumerable: false });
  }
  return wrapped;
}
