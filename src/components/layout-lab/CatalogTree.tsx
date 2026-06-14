'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LabTheme } from './theme';
import type { LabGroup, LabCatalog, LabEntity } from './useLabCatalogData';
import { STATUS_GLYPH, lifecycleStatus, statusAriaLabel, type StatusKind } from './statusLanguage';
import { useCatalogStore } from '@/stores/catalogStore';
import { useRovingFocus } from './hooks/useRovingFocus';

interface CatalogTreeProps {
  t: LabTheme;
  groups: LabGroup[];
  selectedCatalogId: string;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
}

function lifecycleColor(status: StatusKind, t: LabTheme, isDraft: boolean): string {
  if (isDraft) return t.warn;
  if (status === 'pass') return t.ok;
  if (status === 'fail') return t.bad;
  return t.muted;
}

function CatalogRow({
  t, catalog, isSelected, entities, selectedEntityId, onSelectCatalog, onSelectEntity, rovingItemProps,
}: {
  t: LabTheme;
  catalog: LabCatalog;
  isSelected: boolean;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
  rovingItemProps?: { tabIndex: number; 'data-roving-active'?: boolean };
}) {
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
          style={{ fontSize: 12, color: t.muted, flexShrink: 0, marginLeft: 8 }}
        >
          {catalog.verified}/{catalog.total}
        </span>
      </button>
      {isSelected && entities.map((entity) => {
        const isDraft = entity.id.startsWith('draft-');
        const isEntitySelected = entity.id === selectedEntityId;
        const status = lifecycleStatus(entity.lifecycle);
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
                title={`${entity.name}: ${entity.lifecycle}`}
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
            {isDraft && (
              <button
                aria-label="discard draft"
                onClick={(e) => {
                  e.stopPropagation();
                  useCatalogStore.getState().removeDraft(catalog.catalogId, entity.id);
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
  t, groups, selectedCatalogId, entities, selectedEntityId, onSelectCatalog, onSelectEntity,
}: CatalogTreeProps) {
  const reduce = useReducedMotion();
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
