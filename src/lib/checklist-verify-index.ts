/**
 * Auto-verify trigger index — which checklist items a changed C++ class can verify.
 *
 * Derived from `CHECKLIST_EXPECTATIONS` (the table verify-semantic checks), never from
 * checklist prose: a class triggers an item only when that item's expectation names it
 * as its primary or a secondary class. Every target is module-scoped `{moduleId, itemId}`
 * (ids repeat across modules). An expectation whose owner checklist has no such item is
 * not indexed; `unboundExpectationIds()` reports it.
 *
 * Pure and memoized: the registries are static at module load.
 */
import { CHECKLIST_EXPECTATIONS } from '@/lib/checklist-expectations';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

export interface VerifyTarget {
  moduleId: SubModuleId;
  itemId: string;
}

export interface VerifyIndexEntry extends VerifyTarget {
  className: string;
  role: 'primary' | 'secondary';
}

interface VerifyIndex {
  byClass: Map<string, VerifyIndexEntry[]>;
  entries: VerifyIndexEntry[];
  unbound: string[];
}

let cached: VerifyIndex | null = null;

function buildIndex(): VerifyIndex {
  const byClass = new Map<string, VerifyIndexEntry[]>();
  const entries: VerifyIndexEntry[] = [];
  const unbound: string[] = [];

  for (const [itemId, exp] of Object.entries(CHECKLIST_EXPECTATIONS)) {
    const checklist = SUB_MODULE_MAP[exp.moduleId]?.checklist ?? [];
    if (!checklist.some((item) => item.id === itemId)) {
      unbound.push(itemId);
      continue;
    }
    const classes: [string, VerifyIndexEntry['role']][] = [
      [exp.primary.className, 'primary'],
      ...(exp.secondary ?? []).map((s): [string, VerifyIndexEntry['role']] => [s.className, 'secondary']),
    ];
    for (const [className, role] of classes) {
      const entry: VerifyIndexEntry = { moduleId: exp.moduleId, itemId, className, role };
      entries.push(entry);
      const list = byClass.get(className);
      if (list) list.push(entry);
      else byClass.set(className, [entry]);
    }
  }

  return { byClass, entries, unbound };
}

function index(): VerifyIndex {
  if (!cached) cached = buildIndex();
  return cached;
}

/** Every (class -> item) binding in the index. */
export function verifyIndexEntries(): readonly VerifyIndexEntry[] {
  return index().entries;
}

/** Expectation ids whose owner module has no checklist item of that id (reported, not indexed). */
export function unboundExpectationIds(): string[] {
  return [...index().unbound];
}

/**
 * The module-scoped items a batch of changed declarations can verify, deduplicated in
 * first-seen order. A name no expectation binds (UPROPERTY, UAnimInstance, …) yields nothing.
 */
export function resolveAffectedItems<D extends { name: string }>(declarations: readonly D[]): VerifyTarget[] {
  const { byClass } = index();
  const seen = new Set<string>();
  const out: VerifyTarget[] = [];
  for (const { name } of declarations) {
    for (const { moduleId, itemId } of byClass.get(name) ?? []) {
      const key = `${moduleId}::${itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ moduleId, itemId });
    }
  }
  return out;
}
