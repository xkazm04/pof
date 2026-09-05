'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LabTheme } from './theme';
import type { LabGroup, LabCatalog, LabEntity } from './useLabCatalogData';
import type { LifecycleState } from '@/lib/catalog/types';
import { STATUS_GLYPH, lifecycleStatus, statusAriaLabel, type StatusKind } from './statusLanguage';
import { useCatalogStore } from '@/stores/catalogStore';
import { tryApiFetch } from '@/lib/api-utils';
import { toast } from 'sonner';
import { useRovingFocus } from './hooks/useRovingFocus';
import type { DerivedLifecycleMap } from './useDerivedLifecycle';

interface CatalogTreeProps {
  t: LabTheme;
  groups: LabGroup[];
  selectedCatalogId: string;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
  /**
   * Server-derived lifecycle per entity (see `useDerivedLifecycle`). Display only:
   * the seeded `entity.lifecycle` is the hardcoded `'planned'` for every entity in the
   * product, so without this the tree paints `pending ○` no matter what the pipeline
   * proved. Absent/unfetched entities fall back to the seed — never to a guess.
   *
   * It also feeds the OPEN catalog row's `verified/total` counter, which used to count the
   * same hardcoded seed field and so could only ever read `0`.
   */
  derivedLifecycle?: DerivedLifecycleMap;
}

/**
 * The counter's honest unknown. `GET /api/catalog/lifecycle` is per-catalog, so only the
 * OPEN catalog is derived — fanning it out would be 46 requests to paint a rail. Every other
 * catalog reports that it has no derivation instead of borrowing the seed's structural zero.
 */
const UNKNOWN_VERIFIED_TITLE =
  'Verified count unknown — the lifecycle derivation is read per catalog, and only the open '
  + 'catalog is derived. Open this catalog to count what its pipeline has actually proven. '
  + '(A “0” here would be the seeded default, not a measurement.)';

const verifiedTitle = (n: number, total: number) =>
  `${n} of ${total} entities derive as verified — config-complete AND a drained L3/L4 gate `
  + 'passes. Derived from persisted pipeline artifacts; display only.';

/** What a discard actually removed. Every number is a real server `changes()` count. */
export interface DiscardResult {
  /** `pipeline_artifacts` rows removed (its revisions/verdicts go with them — see the route). */
  artifacts: number;
  /** `catalog_entities` rows removed — 0 for a draft that never persisted (browser-only). */
  entityRows: number;
  /** Non-empty when a delete failed; the discard reports it instead of claiming success. */
  errors: string[];
}

/**
 * Discard a user-created entity: its artifacts, then its entity row.
 *
 * Discarding used to call `removeDraft` alone — deleting the browser record and ORPHANING
 * every `pipeline_artifacts` row the run had written, while `DELETE /api/pipeline-artifacts`
 * existed for exactly this. Both deletes report their real `changes()` count, so the toast
 * states what was removed rather than what was attempted; a failure is named, never swallowed.
 *
 * Exported for unit test — the component only wires it to the × button.
 */
export async function discardDraftEntity(catalogId: string, entityId: string): Promise<DiscardResult> {
  const q = `catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`;
  const errors: string[] = [];

  const arts = await tryApiFetch<{ deleted: number }>(`/api/pipeline-artifacts?${q}`, { method: 'DELETE' });
  if (!arts.ok) errors.push(`artifacts: ${arts.error}`);

  const row = await tryApiFetch<{ deleted: number }>(`/api/catalog-entities?${q}`, { method: 'DELETE' });
  if (!row.ok) errors.push(`entity row: ${row.error}`);

  return {
    artifacts: arts.ok ? arts.data.deleted : 0,
    entityRows: row.ok ? row.data.deleted : 0,
    errors,
  };
}

/** The one-line report the discard toast shows. Pure (exported for unit test). */
export function describeDiscard(name: string, r: DiscardResult): string {
  const counts = `${r.artifacts} artifact row(s) and ${r.entityRows} entity row(s) removed`;
  return r.errors.length
    ? `Discarded “${name}” incompletely — ${counts}; ${r.errors.join('; ')}`
    : `Discarded “${name}” — ${counts}.`;
}

const BROWSER_ONLY_TITLE =
  'This entity exists only in this browser — the server never accepted it, so nothing on the '
  + 'server can resolve it and NONE of its gates can run. Its acceptance is unknown, not passing.';

function lifecycleColor(status: StatusKind, t: LabTheme, isDraft: boolean): string {
  if (isDraft) return t.warn;
  if (status === 'pass') return t.ok;
  if (status === 'fail') return t.bad;
  return t.muted;
}

/**
 * The dot's tooltip: the state, then the evidence sentence behind it. A derived
 * `wired` says its runtime is unproven, so a shape-only all-`pass` entity can never
 * read as verified; with no derivation the tooltip says the state is the seed's.
 */
function lifecycleTitle(name: string, lifecycle: LifecycleState, summary?: string): string {
  return summary
    ? `${name}: ${lifecycle} — ${summary}`
    : `${name}: ${lifecycle} (seeded default — no pipeline artifacts derived yet)`;
}

function CatalogRow({
  t, catalog, isSelected, entities, selectedEntityId, onSelectCatalog, onSelectEntity, rovingItemProps, derivedLifecycle,
  verified,
}: {
  t: LabTheme;
  catalog: LabCatalog;
  isSelected: boolean;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
  rovingItemProps?: { tabIndex: number; 'data-roving-active'?: boolean };
  derivedLifecycle?: DerivedLifecycleMap;
  /** Entities derived as `verified`, or `null` when nothing has been derived for this catalog. */
  verified: number | null;
}) {
  // The draft cache for THIS catalog — read for the browser-only disclosure only. The tree
  // renders `entities` (which already includes drafts, see `useLabCatalogData`); this adds
  // the one fact `LabEntity` does not carry.
  const drafts = useCatalogStore((s) => s.draftEntitiesByCatalog[catalog.catalogId]) ?? {};
  return (
    <>
      <button
        role="treeitem"
        aria-selected={isSelected}
        onClick={() => onSelectCatalog(catalog.catalogId)}
        data-testid={`harness-catalog-${catalog.catalogId}`}
        {...rovingItemProps}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', padding: '7px 12px 7px 20px',
          cursor: 'pointer', border: 'none',
          borderLeft: isSelected ? `3px solid ${t.ink}` : '3px solid transparent',
          background: isSelected ? t.accentBg : 'transparent',
          color: isSelected ? t.inkDeep : t.text,
          fontWeight: isSelected ? 600 : 400,
          fontSize: 14,
          transition: 'background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out',
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {catalog.label}
        </span>
        <span
          className={t.fontMono}
          data-testid={`catalog-verified-${catalog.catalogId}`}
          data-derived={verified === null ? 'unknown' : 'derived'}
          title={verified === null ? UNKNOWN_VERIFIED_TITLE : verifiedTitle(verified, catalog.total)}
          style={{ fontSize: 12, color: t.muted, flexShrink: 0, marginLeft: 8 }}
        >
          {verified === null ? '—' : verified}/{catalog.total}
        </span>
      </button>
      {isSelected && entities.map((entity) => {
        const isDraft = entity.id.startsWith('draft-');
        // A draft whose server persist failed is BROWSER-ONLY: nothing on the server can
        // resolve it, so none of its gates can run. Say so on the row rather than letting it
        // sit in the tree indistinguishable from a durable entity.
        const draft = drafts[entity.id];
        const browserOnly = draft?.browserOnly === true;
        const isEntitySelected = entity.id === selectedEntityId;
        // Derived-from-artifacts state wins over the seed's hardcoded `planned`.
        const derived = derivedLifecycle?.get(entity.id);
        const lifecycle = derived?.lifecycle ?? entity.lifecycle;
        const status = lifecycleStatus(lifecycle);
        const dotColor = lifecycleColor(status, t, isDraft);
        // Pass fills the dot; fail/pending use a glyph-bearing capsule so the status
        // is readable in grayscale and announces a plain-language word to AT.
        // Drafts always use the warn capsule style regardless of lifecycle status.
        const isPass = !isDraft && status === 'pass';
        return (
          <div
            key={entity.id}
            style={{
              display: 'flex', alignItems: 'center',
              background: isEntitySelected ? t.accentBg : 'transparent',
              transition: 'background-color 160ms ease-out',
            }}
          >
            <button
              onClick={() => onSelectEntity(entity.id)}
              aria-label={statusAriaLabel(entity.name, status)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                textAlign: 'left', padding: '6px 12px 6px 36px',
                cursor: 'pointer', border: 'none', background: 'transparent',
                color: isEntitySelected ? t.inkDeep : t.text,
                fontWeight: isEntitySelected ? 600 : 400,
                fontSize: 14,
                transition: 'color 160ms ease-out',
              }}
            >
              <span
                aria-hidden="true"
                data-testid={`entity-lifecycle-${entity.id}`}
                data-lifecycle={lifecycle}
                title={lifecycleTitle(entity.name, lifecycle, derived?.summary)}
                style={{
                  minWidth: 14, height: 14, padding: isPass ? 0 : '0 3px',
                  flexShrink: 0, borderRadius: isPass ? '50%' : 4,
                  background: isPass ? dotColor : 'transparent',
                  border: isPass ? 'none' : `1px solid ${dotColor}`,
                  color: dotColor,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, lineHeight: 1,
                }}
              >{isPass ? '' : STATUS_GLYPH[status]}</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entity.name}
              </span>
            </button>
            {browserOnly && (
              <span
                data-testid={`entity-browser-only-${entity.id}`}
                title={draft?.persistError ? `${BROWSER_ONLY_TITLE} (${draft.persistError})` : BROWSER_ONLY_TITLE}
                className={t.fontMono}
                style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
                  color: t.bad, border: `1px solid ${t.bad}`, borderRadius: 3, padding: '0 3px',
                }}
              >
                BROWSER-ONLY
              </span>
            )}
            {isDraft && (
              <button
                aria-label="discard draft"
                onClick={(e) => {
                  e.stopPropagation();
                  // Remove the SERVER rows first, then the local cache: the counts come back
                  // from the deletes themselves, so the report can never be a guess.
                  void discardDraftEntity(catalog.catalogId, entity.id).then((r) => {
                    useCatalogStore.getState().removeDraft(catalog.catalogId, entity.id);
                    const msg = describeDiscard(entity.name, r);
                    if (r.errors.length) toast.error(msg); else toast.success(msg);
                  });
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, padding: '0 4px' }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Category → Catalog → Entity collapsible tree for the Baseline left column. */
export function CatalogTree({
  t, groups, selectedCatalogId, entities, selectedEntityId, onSelectCatalog, onSelectEntity, derivedLifecycle,
}: CatalogTreeProps) {
  const reduce = useReducedMotion();
  /**
   * The OPEN catalog's verified count, from the very derivation its entity dots render —
   * so a green `verified` dot can no longer sit inside a row that says `0/N`.
   *
   * `null` (rendered `—`) whenever nothing has been derived: no map supplied, or a failed /
   * absent fetch (which resolves to an EMPTY map — see `useDerivedLifecycle`). Costs zero
   * extra requests: the one fetch the open catalog already issues serves both.
   *
   * Drafts are excluded because `LabCatalog.total` counts persisted entities only — a count
   * that could exceed its own denominator would be a new lie, not a fix for the old one.
   */
  const verifiedInSelected = useMemo(() => {
    if (!derivedLifecycle || derivedLifecycle.size === 0) return null;
    let n = 0;
    for (const e of entities) {
      if (e.id.startsWith('draft-')) continue;
      if (derivedLifecycle.get(e.id)?.lifecycle === 'verified') n++;
    }
    return n;
  }, [derivedLifecycle, entities]);
  // Chapters are compact by default — only the chapter holding the current
  // selection opens, so the tree reads as a chapter overview. `override` records
  // the user's explicit per-chapter expand/collapse; absent ⇒ the default rule.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const selectedCategory = useMemo(
    () => groups.find((g) => g.catalogs.some((c) => c.catalogId === selectedCatalogId))?.category,
    [groups, selectedCatalogId],
  );
  const isOpen = (category: string) => (category in override ? override[category] : category === selectedCategory);
  // Flatten the visible (open-chapter) catalogs once, and carry each catalog's
  // flat index in the same pass so render rows do an O(1) Map lookup instead of
  // an O(catalogs) indexOf per row (which was O(catalogs²) over the whole tree).
  const { visibleCatalogs, visibleIndex } = useMemo(() => {
    const list: LabCatalog[] = [];
    const index = new Map<LabCatalog, number>();
    for (const g of groups) {
      if (!(g.category in override ? override[g.category] : g.category === selectedCategory)) continue;
      for (const c of g.catalogs) {
        index.set(c, list.length);
        list.push(c);
      }
    }
    return { visibleCatalogs: list, visibleIndex: index };
  }, [groups, override, selectedCategory]);
  const activeIdx = Math.max(0, visibleCatalogs.findIndex((c) => c.catalogId === selectedCatalogId));
  const roving = useRovingFocus(visibleCatalogs.length, activeIdx, (i) => {
    const c = visibleCatalogs[i];
    if (c) onSelectCatalog(c.catalogId);
  });

  // Keep the roving cursor in sync with the selected catalog + visible-list changes.
  // Render-phase bail-out (guarded by a prev-value) — NOT an effect, so it stays clear
  // of react-hooks/set-state-in-effect; React de-dupes the extra setState.
  const [prevActiveIdx, setPrevActiveIdx] = useState(activeIdx);
  if (activeIdx !== prevActiveIdx) {
    setPrevActiveIdx(activeIdx);
    roving.setActive(activeIdx);
  }

  return (
    <div
      role="tree"
      aria-label="Catalogs"
      {...roving.containerProps}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}
    >
      {groups.map((group) => {
        const open = isOpen(group.category);
        return (
          <div key={group.category}>
            <button
              onClick={() => setOverride((o) => ({ ...o, [group.category]: !open }))}
              aria-expanded={open}
              className="focus-ring-inset"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              style={{
                width: '100%', textAlign: 'left',
                fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--lab-muted)', padding: 'var(--lab-s3) var(--lab-s3) var(--lab-s1)',
                borderBottom: '1px solid var(--lab-line)',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              <span aria-hidden="true">{open ? '▾' : '▸'}</span> {group.category}
            </button>
            {open && group.catalogs.map((catalog, ci) => (
              <motion.div key={catalog.catalogId}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : ci * 0.02, duration: reduce ? 0 : 0.16 }}>
                <CatalogRow
                  t={t}
                  catalog={catalog}
                  isSelected={catalog.catalogId === selectedCatalogId}
                  entities={catalog.catalogId === selectedCatalogId ? entities : []}
                  selectedEntityId={selectedEntityId}
                  onSelectCatalog={onSelectCatalog}
                  onSelectEntity={onSelectEntity}
                  derivedLifecycle={derivedLifecycle}
                  verified={catalog.catalogId === selectedCatalogId ? verifiedInSelected : null}
                  rovingItemProps={roving.itemProps(visibleIndex.get(catalog) ?? -1)}
                />
              </motion.div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
