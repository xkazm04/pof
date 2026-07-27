'use client';

/**
 * Lab-wide search: find any catalog, entity, or pipeline step by name and jump to it.
 *
 * Reaching a known entity used to be expand-chapter → click catalog → scan the entity
 * rows (the tree opens exactly ONE chapter and only lists the selected catalog's
 * entities), and a step could not be reached at all without first opening its entity.
 * This is the direct route across all catalogs, all seeded entities, and every step of
 * every registered pipeline.
 *
 * It drives the EXISTING navigation callbacks lifted in `LayoutLab` (`onSelectCatalog` /
 * `onNavigate`) — no parallel navigation state, so last-location persistence keeps working.
 *
 * A step hit needs an entity to open: it uses the currently-open entity when that entity
 * belongs to the hit's catalog, otherwise the catalog's first seeded entity. When a
 * catalog has no entity at all the hit degrades to selecting the catalog (honest — there
 * is nothing to open the step on).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { resolveCatalogSteps } from './catalogManifest';
import { SearchCombobox, type SearchHit } from './ui/SearchCombobox';

/** What selecting a hit does. */
export type LabSearchTarget =
  | { kind: 'catalog'; catalogId: string }
  | { kind: 'entity'; catalogId: string; entityId: string }
  | { kind: 'step'; catalogId: string; stepIndex: number };

interface LabSearchProps {
  open: boolean;
  onClose: () => void;
  /** The entity currently open in the shell — a step hit prefers to stay on it. */
  currentEntityId: string | null;
  /** Existing lifted nav callbacks (LayoutLab) — never a parallel nav state. */
  onSelectCatalog: (catalogId: string) => void;
  onNavigate: (catalogId: string, entityId: string, stepIndex: number) => void;
}

interface IndexRow {
  hit: SearchHit<LabSearchTarget>;
  /** Lowercased haystack (name + id) matched against the needle. */
  hay: string;
}

export function LabSearch({ open, onClose, currentEntityId, onSelectCatalog, onNavigate }: LabSearchProps) {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);

  // One flat index over catalogs + entities + steps, rebuilt only when the entity
  // universe changes (the step/catalog halves are static registry reads).
  const index = useMemo(() => {
    const rows: IndexRow[] = [];
    for (const section of CATALOG_SECTIONS) {
      const { catalogId, label } = section;
      rows.push({
        hay: `${label} ${catalogId}`.toLowerCase(),
        hit: { key: `c:${catalogId}`, label, detail: catalogId, badge: 'catalog', payload: { kind: 'catalog', catalogId } },
      });
      for (const e of Object.values(entitiesByCatalog[catalogId] ?? {})) {
        rows.push({
          hay: `${e.name} ${e.id}`.toLowerCase(),
          hit: {
            key: `e:${catalogId}:${e.id}`, label: e.name, detail: e.id, meta: catalogId, badge: 'entity',
            payload: { kind: 'entity', catalogId, entityId: e.id },
          },
        });
      }
      resolveCatalogSteps(catalogId).forEach((step, i) => {
        rows.push({
          hay: `${step} ${catalogId}`.toLowerCase(),
          hit: {
            key: `s:${catalogId}:${step}`, label: step, meta: `${label} · step ${i + 1}`, badge: 'step',
            payload: { kind: 'step', catalogId, stepIndex: i },
          },
        });
      });
    }
    return rows;
  }, [entitiesByCatalog]);

  const search = useCallback(
    (needle: string) => index.filter((r) => r.hay.includes(needle)).map((r) => r.hit),
    [index],
  );

  const go = useCallback((hit: SearchHit<LabSearchTarget>) => {
    const t = hit.payload;
    if (t.kind === 'catalog') {
      onSelectCatalog(t.catalogId);
    } else if (t.kind === 'entity') {
      onNavigate(t.catalogId, t.entityId, 0);
    } else {
      const inCatalog = entitiesByCatalog[t.catalogId] ?? {};
      const entityId = (currentEntityId && inCatalog[currentEntityId] ? currentEntityId : Object.keys(inCatalog)[0]) ?? null;
      // No seeded entity → there is nothing to open the step ON; land on the catalog.
      if (entityId) onNavigate(t.catalogId, entityId, t.stepIndex);
      else onSelectCatalog(t.catalogId);
    }
    onClose();
  }, [entitiesByCatalog, currentEntityId, onSelectCatalog, onNavigate, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Search the lab" className="max-w-xl">
      <SearchCombobox<LabSearchTarget>
        search={search}
        onSelect={go}
        onDismiss={onClose}
        autoFocus
        idPrefix="lab-search"
        ariaLabel="Search catalogs, entities and pipeline steps"
        placeholder="Catalog, entity or step — name or id…"
        noun="result"
        emptyUniverse={index.length === 0}
      />
    </Modal>
  );
}

/**
 * Ctrl/Cmd+K (and plain "/" outside a text field) opens lab search. Returns the
 * open state + setter so the shell can also drive it from a header button.
 */
export function useLabSearchShortcut(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
}
