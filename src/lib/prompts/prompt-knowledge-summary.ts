import { STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';

/**
 * Summarize the knowledge that was injected into a composed task prompt — the
 * plain account a user sees in the run-path Prompt Inspector of what their
 * dispatch actually carries beyond the structural sections (which the audit
 * chips already cover).
 *
 * Pure string inspection over the SAME composed prompt that dispatches: each tag
 * is derived from a section header the knowledge modules emit, so the summary
 * can never claim an injection the prompt doesn't contain.
 */
export function summarizeInjectedKnowledge(prompt: string, variantId?: string): string[] {
  const tags: string[] = [];

  if (variantId && variantId !== STATIC_VARIANT_ID) tags.push(`variant ${variantId}`);
  else if (variantId === STATIC_VARIANT_ID) tags.push('static prompt');

  const gotchaCount = countSectionBullets(prompt, '## Known UE Pitfalls');
  if (gotchaCount > 0) tags.push(`${gotchaCount} UE pitfall${gotchaCount === 1 ? '' : 's'}`);

  if (prompt.includes('## Known Project Assets')) tags.push('known assets');
  if (prompt.includes('## Wiring Requirements')) tags.push('wiring');
  if (prompt.includes('## Binary Content Wall')) tags.push('binary tripwire');
  // Marker emitted by qualityPack() — the judge-rubric block (quality/index.ts).
  if (prompt.includes('craft dimensions — meet the professional bar')) tags.push('quality pack');
  if (prompt.includes('@@CALLBACK:')) tags.push('completion callback');

  return tags;
}

/** Count `- ` bullets belonging to a `## Section` (up to the next `## ` header). */
function countSectionBullets(prompt: string, header: string): number {
  const start = prompt.indexOf(header);
  if (start < 0) return 0;
  const rest = prompt.slice(start + header.length);
  const nextHeader = rest.indexOf('\n## ');
  const body = nextHeader >= 0 ? rest.slice(0, nextHeader) : rest;
  return body.split('\n').filter((l) => l.startsWith('- ')).length;
}
