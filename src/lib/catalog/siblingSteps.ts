import { SOURCED_FIELD, sourcedStampOf } from '@/lib/catalog/acceptance/sourced';
import { TEMPLATE_FIELD, templateStampOf } from '@/lib/catalog/acceptance/template';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

/** Hard ceiling for the complete sibling section, including omission notices. */
export const SIBLING_STEPS_MAX_CHARS = 12000;

const BOOKKEEPING_KEYS = new Set([SOURCED_FIELD, TEMPLATE_FIELD, 'genHistory']);
const HEADING = "# SIBLING STEPS — this entity's other steps (stay consistent with them)";

function compactArtifact(data: Record<string, unknown>): string {
  return JSON.stringify(data, (key, value) => BOOKKEEPING_KEYS.has(key) ? undefined : value);
}

function orderedLabels(
  catalogId: string | undefined,
  currentStep: string,
  siblings: Record<string, Record<string, unknown>>,
): string[] {
  const pipelineOrder = new Map(
    (catalogId ? getCatalogPipeline(catalogId)?.steps : undefined)?.map((step, index) => [step.label, index]) ?? [],
  );
  return Object.keys(siblings)
    .filter((label) => label !== currentStep)
    .sort((a, b) => {
      const ai = pipelineOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bi = pipelineOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi || a.localeCompare(b);
    });
}

function omissionBlock(labels: readonly string[]): string {
  return labels.length
    ? `## Omitted by prompt size cap\n${labels.map((label) => `- ${label}`).join('\n')}`
    : '';
}

/** Render persisted sibling artifacts as whole, compact JSON records in pipeline order. */
export function siblingStepsBlock(
  catalogId: string | undefined,
  currentStep: string,
  siblings: Record<string, Record<string, unknown>> | undefined,
): string {
  if (!siblings || Object.keys(siblings).length === 0) return '';
  const labels = orderedLabels(catalogId, currentStep, siblings);
  if (labels.length === 0) return '';

  const blocks = labels.map((label) => {
    const data = siblings[label];
    const sourced = sourcedStampOf(data)
      ? ' (seeded from the reference — reproduce, do not contradict)'
      : '';
    // A TEMPLATE sibling is another entity's content with this name swapped in — never a thing to stay consistent with.
    const template = templateStampOf(data);
    const held = template ? ` (${template.exemplar} template, not this entity's content — do not copy it)` : '';
    return `## ${label}${sourced}${held}\n${compactArtifact(data)}`;
  });

  const kept: string[] = [];
  let omitted: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    // Reserve enough room to name every remaining step if this is the last artifact that fits.
    const remainingNames = labels.slice(index + 1);
    const candidate = [HEADING, ...kept, blocks[index], omissionBlock(remainingNames)]
      .filter(Boolean)
      .join('\n\n');
    if (candidate.length > SIBLING_STEPS_MAX_CHARS) {
      omitted = labels.slice(index);
      break;
    }
    kept.push(blocks[index]);
  }

  return [HEADING, ...kept, omissionBlock(omitted)].filter(Boolean).join('\n\n');
}
