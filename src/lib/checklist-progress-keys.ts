/**
 * Which `itemId`s a module is allowed to write into
 * `project_progress.checklist_json` — the single declaration
 * `POST /api/checklist/complete` validates against.
 *
 * Why this exists: the completion route used to do
 * `progress[moduleId][itemId] = true` with no validation at all, so any id a
 * component happened to invent landed in the blob where **nothing can read it**
 * — the module's checklist percentage, the feature matrix and the module's own
 * "is this done" derivations all key off the registry's declared checklist ids.
 * `MaterialLayerGraph` shipped `mt-1`/`mt-2`/`mt-3` (the module's *quick action*
 * ids, which are a different namespace) for as long as it existed: its two child
 * nodes could never unlock and every run it completed wrote a dead key.
 *
 * The refusal is deliberately loud (400 + reason) rather than a silent write:
 * an id nothing owns is a defect in the caller, and the only way that defect is
 * ever noticed is if the write fails and says why.
 *
 * Not every progress key is a registry checklist item, though — several
 * surfaces legitimately track their own node/step completion in the same blob.
 * Those are declared below as auxiliary surfaces, each naming what owns it, so
 * "declared" stays a real statement instead of a wildcard.
 */

import { getModuleChecklist } from '@/lib/module-registry';
import { ANIMATION_STEPS } from '@/components/modules/content/animations/AnimationChecklist/constants';
import { FALLBACK_STATES } from '@/components/modules/content/animations/AnimationStateMachine/constants';
import type { SubModuleId } from '@/types/modules';

/** A non-checklist surface that legitimately owns progress keys of its own. */
export interface AuxProgressSurface {
  /** The component/feature that writes these keys — named so a reader can find it. */
  owner: string;
  /** Exact ids this surface owns. */
  ids?: readonly string[];
  /** Prefixes for ids this surface derives at runtime (e.g. from a UE scan). */
  prefixes?: readonly string[];
  /**
   * Set when the surface's keys are accepted but are KNOWN not to count toward
   * the module's checklist. Logged on every write so the gap stays visible
   * instead of decaying into "it works".
   */
  gap?: string;
}

export const AUX_PROGRESS_SURFACES: Partial<Record<SubModuleId, readonly AuxProgressSurface[]>> = {
  animations: [
    {
      // The Setup Guide's steps are dispatched as checklist tasks and resolved
      // back by id in `cli-task-handlers` — they are a real, intentional surface
      // that simply is not part of the `anim-1..anim-7` roadmap checklist.
      owner: 'AnimationChecklist Setup Guide (components/modules/content/animations/AnimationChecklist)',
      ids: ANIMATION_STEPS.map((s) => s.id),
    },
    {
      // State nodes: the six hard-coded fallback states, plus `scanned-<StateName>`
      // ids derived at runtime from a real AnimBP scan (so the set is open-ended
      // by construction and can only be matched by prefix).
      owner: 'AnimationStateMachine states (fallback + scanned AnimBP)',
      ids: FALLBACK_STATES.map((s) => s.id),
      prefixes: ['scanned-'],
    },
  ],
  // audio: AudioPipelineDiagram's `au-*` node ids were accepted here with a logged
  // `gap` until 2026-08-19, because renaming them would have reset every existing
  // user's diagram. The diagram now draws the real `aud-*` checklist ids and the
  // old keys are MIGRATED (below) instead of accepted — so the gap is retired
  // rather than merely re-described, and no unlock is lost.
};

/**
 * Historical orphan keys that DO have a real checklist item behind them, and the
 * id they should always have been. A completion arriving under the old key is
 * written under the new one, and blobs already holding the old key are migrated
 * (`migrateProgressBlob`) rather than left as dead weight.
 *
 * A migration NEVER downgrades a completion: when both the old and the new key
 * are present in a blob, the merged value is `old || new`, so an unlock a user
 * already earned survives regardless of which key carried it or what order the
 * keys are iterated in. A migration that silently dropped a completion would be
 * worse than the orphan-key bug it fixes.
 */
export const ORPHAN_KEY_MIGRATIONS: Partial<Record<SubModuleId, Readonly<Record<string, string>>>> = {
  // MaterialLayerGraph's node ids until 2026-08-19 — the materials quick-action
  // namespace, which shares no id with the `mat-*` checklist.
  materials: {
    'mt-3': 'mat-1', // Master Material  → Create master material
    'mt-1': 'mat-2', // Dynamic Materials → Set up dynamic material instances
    'mt-2': 'mat-3', // Post-Process     → Configure material parameter collections
  },
  // AudioPipelineDiagram's node ids until 2026-08-19 — the audio quick-action
  // namespace, which mirrors the `aud-*` checklist one-for-one but is a different
  // namespace, so every completion the diagram wrote was unreadable.
  audio: {
    'au-1': 'aud-1', // Sound Manager   → Create sound manager
    'au-2': 'aud-2', // Ambient System  → Build ambient sound system
    'au-3': 'aud-3', // Dynamic Music   → Implement dynamic music system
  },
};

export type ProgressKeyVerdict =
  /** A declared checklist item of the module. */
  | { kind: 'checklist' }
  /** A declared non-checklist surface's own key. */
  | { kind: 'aux'; owner: string; gap?: string }
  /** A recorded orphan id with a real checklist item behind it. */
  | { kind: 'migrate'; from: string; to: string; note: string }
  /** The module declares no checklist at all — nothing truer to check against. */
  | { kind: 'ungoverned'; note: string }
  /** Nothing owns this id. Refuse it, and say so. */
  | { kind: 'unknown'; reason: string };

function matchesAux(moduleId: string, itemId: string): AuxProgressSurface | undefined {
  const surfaces = AUX_PROGRESS_SURFACES[moduleId as SubModuleId];
  if (!surfaces) return undefined;
  return surfaces.find(
    (s) => s.ids?.includes(itemId) || s.prefixes?.some((p) => itemId.startsWith(p)),
  );
}

/** Migration target for an orphan id, but only when it really resolves today. */
function migrationTarget(moduleId: string, itemId: string, declared: readonly string[]): string | undefined {
  const to = ORPHAN_KEY_MIGRATIONS[moduleId as SubModuleId]?.[itemId];
  return to && declared.includes(to) ? to : undefined;
}

/**
 * Decide whether `itemId` may be written to `moduleId`'s progress — and under
 * which id. Pure; safe to call from a route or a test.
 */
export function resolveProgressKey(moduleId: string, itemId: string): ProgressKeyVerdict {
  const declared = getModuleChecklist(moduleId as SubModuleId).map((i) => i.id);

  if (declared.includes(itemId)) return { kind: 'checklist' };

  const to = migrationTarget(moduleId, itemId, declared);
  if (to) {
    return {
      kind: 'migrate',
      from: itemId,
      to,
      note: `"${itemId}" is a retired ${moduleId} progress key — recorded as "${to}", the checklist item it always meant.`,
    };
  }

  const aux = matchesAux(moduleId, itemId);
  if (aux) return { kind: 'aux', owner: aux.owner, gap: aux.gap };

  if (declared.length === 0) {
    return {
      kind: 'ungoverned',
      note: `Module "${moduleId}" declares no checklist, so "${itemId}" could not be validated against anything. Stored as sent.`,
    };
  }

  const shown = declared.slice(0, 8).join(', ');
  const more = declared.length > 8 ? `, … (${declared.length} total)` : '';
  return {
    kind: 'unknown',
    reason:
      `Unknown checklist item "${itemId}" for module "${moduleId}" — no declared checklist item and no ` +
      `registered auxiliary progress surface owns it. Nothing reads a key that belongs to no surface, so ` +
      `writing it would record progress where the checklist, the feature matrix and the module views can ` +
      `never count it. Declared ${moduleId} items: ${shown}${more}.`,
  };
}

export interface BlobMigration {
  moduleId: string;
  from: string;
  to: string;
}

/**
 * Rewrite every recorded orphan key in a stored progress blob to its real
 * checklist id. Pure — returns a new blob plus what it moved, so the caller can
 * report the migration instead of performing it silently.
 */
export function migrateProgressBlob(
  progress: Record<string, Record<string, boolean>>,
): { progress: Record<string, Record<string, boolean>>; migrations: BlobMigration[] } {
  const migrations: BlobMigration[] = [];
  const next: Record<string, Record<string, boolean>> = {};

  for (const [moduleId, items] of Object.entries(progress ?? {})) {
    if (!items || typeof items !== 'object') {
      next[moduleId] = items;
      continue;
    }
    const declared = getModuleChecklist(moduleId as SubModuleId).map((i) => i.id);
    const migrated: Record<string, boolean> = {};
    for (const [itemId, done] of Object.entries(items)) {
      const to = migrationTarget(moduleId, itemId, declared);
      if (to) {
        migrated[to] = migrated[to] || done;
        migrations.push({ moduleId, from: itemId, to });
      } else {
        migrated[itemId] = itemId in migrated ? migrated[itemId] || done : done;
      }
    }
    next[moduleId] = migrated;
  }

  return { progress: next, migrations };
}

/** One-line human summary of a set of blob migrations, for logs and responses. */
export function describeMigrations(migrations: BlobMigration[]): string[] {
  return migrations.map((m) => `${m.moduleId}: ${m.from} → ${m.to}`);
}
