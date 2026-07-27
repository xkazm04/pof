/**
 * Knowledge routing for the STANDALONE prompt builders.
 *
 * The `CLITask` path (`buildTaskPrompt` → `cli-task-handlers`) already routes the
 * knowledge layer into every prompt: it passes `promptKind` (scopes UE pitfalls +
 * the binary tripwire), `module` (scopes the pitfalls to the module's domains AND
 * recovers the module's authored `KnowledgeTip`s), and `knownAssetDomains` (real
 * UE asset paths) into `buildProjectContextHeader`.
 *
 * The ~10 standalone builders in this folder — the module-UI codegen surface, which
 * is the highest-VOLUME prompt path in the app — called the same header with only
 * `extraRules`, so they got the conservative *superset* of pitfalls for their kind
 * (GAS/Niagara/motion-matching text on a materials task) and NO knowledge tips or
 * known-asset paths at all.
 *
 * This module is the single seam that joins them to the same routing. Each builder
 * spreads {@link moduleKnowledge} into its header options, so the three routing
 * fields are derived in ONE place and a new builder cannot forget one of them.
 *
 * Prompt LENGTH is a first-class concern here: because the routing is
 * `promptKind` + `module` scoped, joining it usually makes a builder's prompt
 * *shorter* (a materials prompt drops the GAS/Niagara/motion-matching pitfalls it
 * can never hit) while making what remains relevant.
 */

import type { SubModuleId } from '@/types/modules';
import type { PromptKind } from '@/lib/knowledge/types';
import { knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';

/** The knowledge-routing slice of `ContextHeaderOptions`. */
export interface ModuleKnowledgeOptions {
  /** Scopes UE pitfalls + the binary tripwire (all standalone builders emit UE C++). */
  promptKind: PromptKind;
  /** Scopes pitfalls to the module's domains and pulls in its authored KnowledgeTips. */
  module: SubModuleId;
  /** Real UE asset paths for the module's domains ([] when it owns none). */
  knownAssetDomains: string[];
}

/**
 * Build the knowledge-routing options for a standalone builder that authors for
 * `moduleId`. Spread into `buildProjectContextHeader` / `.withProjectContext()`:
 *
 * ```ts
 * buildProjectContextHeader(ctx, { ...moduleKnowledge('materials'), extraRules: [...] })
 * ```
 *
 * `promptKind` defaults to `'ue-cpp'` — every standalone builder generates C++ (the
 * Python surfaces all live on the CLITask path). Pass it explicitly if that changes.
 */
export function moduleKnowledge(
  moduleId: SubModuleId,
  promptKind: PromptKind = 'ue-cpp',
): ModuleKnowledgeOptions {
  return {
    promptKind,
    module: moduleId,
    knownAssetDomains: knownAssetDomainsForModule(moduleId),
  };
}
