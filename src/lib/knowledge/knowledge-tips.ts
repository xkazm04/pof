/**
 * Injects a module's authored `KnowledgeTip`s into its CLI prompts.
 *
 * ~41 KnowledgeTips ({title, content, source}) live on the SubModuleDefinitions
 * in `module-registry.ts` but were display-only — ~97% never rendered anywhere
 * (only a single feasibility tip surfaces on moderate modules at ModuleShell),
 * and NONE reached a prompt. This is the prompt seam that recovers them, mirroring
 * `formatGotchas` (see ue-gotchas.ts): `buildProjectContextHeader` calls it when a
 * module is in context so the module's best-practice + feasibility lessons ride
 * along with the task the same way UE pitfalls do.
 */

import type { KnowledgeTip, SubModuleId } from '@/types/modules';
import type { PromptKind } from './types';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

/**
 * Render a module's knowledge tips as a `## Project Knowledge Tips` markdown
 * block, best-practice tips first then feasibility tips (both are prompt-relevant
 * lessons). Returns '' for a `web` prompt kind, an unknown/omitted module, or a
 * module with no authored tips — so callers can inject unconditionally.
 */
export function formatKnowledgeTips(moduleId: string | undefined, kind: PromptKind): string {
  if (!moduleId || kind === 'web') return '';

  const tips: KnowledgeTip[] = SUB_MODULE_MAP[moduleId as SubModuleId]?.knowledgeTips ?? [];
  if (tips.length === 0) return '';

  // Best-practice first (always prompt-relevant discipline), then the feasibility
  // tips (the "watch out, this is the hard part" lessons) — same authored order
  // the module ships, grouped by source.
  const ordered = [
    ...tips.filter((t) => t.source === 'best-practice'),
    ...tips.filter((t) => t.source === 'feasibility'),
  ];
  const lines = ordered.map((t) => `- **${t.title}** — ${t.content}`);
  return `## Project Knowledge Tips\n${lines.join('\n')}`;
}
