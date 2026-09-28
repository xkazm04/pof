import { CATEGORIES, SUB_MODULES, SUB_MODULE_MAP } from '@/lib/module-registry';
import type { SearchResult } from '@/lib/search-index';
import type { SubModuleId } from '@/types/modules';

// ── Palette intents ──────────────────────────────────────────────────────────
// A search hit is resolved client-side, from its doc id and the registry, into
// what the palette can DO with it:
//   primary — where Enter/click lands (always a navigation, never a paid run)
//   run     — the quick action's registry prompt, dispatched ONLY on an explicit
//             Shift+Enter or Run-button click, never on selection or render
//   state   — a checklist item's done/open, read from the client's progress
// Doc ids are the ones src/lib/search-index.ts writes: cat-, mod-, cl-, qa-,
// feat-, fm-, ef-, build-. The item id is recovered by stripping the KNOWN
// `<prefix>-<moduleId>-` head, so hyphenated module ids stay unambiguous.

export type SearchRowKind = SearchResult['type'] | 'action';

export interface NavigateIntent { kind: 'navigate'; moduleId: string }
export interface RunIntent { kind: 'run'; moduleId: SubModuleId; prompt: string }

export interface SearchIntents {
  /** Row kind — quick actions are indexed as 'checklist' but surface as 'action'. */
  kind: SearchRowKind;
  itemId: string | null;
  primary: NavigateIntent | null;
  run: RunIntent | null;
  state: 'done' | 'open' | null;
}

export type ChecklistProgressMap = Record<string, Record<string, boolean>>;

/** Categories navigationStore.navigateToModule accepts as a destination by id. */
const SPECIAL_DESTINATIONS: ReadonlySet<string> = new Set(['project-setup', 'evaluator', 'game-director']);
/** Builds are indexed with no module; their home is the packaging module. */
const BUILD_HOME = 'packaging';
/** Findings whose module is unknown to the registry land on the evaluator. */
const FINDING_HOME = 'evaluator';

function isDestination(moduleId: string): boolean {
  return SPECIAL_DESTINATIONS.has(moduleId) || !!SUB_MODULE_MAP[moduleId as SubModuleId];
}

/** First sub-module of a category — its declared list first, else by categoryId. */
function firstSubModuleOf(categoryId: string): string | null {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const declared = cat?.subModules.find((id) => SUB_MODULE_MAP[id]);
  if (declared) return declared;
  return SUB_MODULES.find((m) => m.categoryId === categoryId && !m.isSpecialItem)?.id ?? null;
}

function itemIdOf(id: string, prefix: string, moduleId: string): string | null {
  const head = `${prefix}-${moduleId}-`;
  return id.startsWith(head) ? id.slice(head.length) : null;
}

function destinationFor(result: Pick<SearchResult, 'type' | 'moduleId'>): string | null {
  const { type, moduleId } = result;
  if (type === 'build') return BUILD_HOME;
  if (moduleId && isDestination(moduleId)) return moduleId;
  if (type === 'category') return firstSubModuleOf(moduleId);
  if (type === 'finding') return FINDING_HOME;
  return null;
}

export function resolveSearchIntents(
  result: Pick<SearchResult, 'type' | 'id' | 'moduleId'>,
  progress: ChecklistProgressMap,
): SearchIntents {
  const dest = destinationFor(result);
  const primary: NavigateIntent | null = dest ? { kind: 'navigate', moduleId: dest } : null;
  const base: SearchIntents = { kind: result.type, itemId: null, primary, run: null, state: null };
  if (result.type !== 'checklist') return base;

  const mod = SUB_MODULE_MAP[result.moduleId as SubModuleId];
  const qaId = itemIdOf(result.id, 'qa', result.moduleId);
  if (qaId !== null) {
    const qa = mod?.quickActions.find((q) => q.id === qaId);
    return {
      ...base,
      kind: 'action',
      itemId: qaId,
      run: qa && mod ? { kind: 'run', moduleId: mod.id, prompt: qa.prompt } : null,
    };
  }

  const clId = itemIdOf(result.id, 'cl', result.moduleId);
  if (clId === null) return base;
  return { ...base, itemId: clId, state: progress[result.moduleId]?.[clId] ? 'done' : 'open' };
}
