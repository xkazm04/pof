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
 * A step hit names its step by LABEL and resolves the index at selection time against the
 * entity it opens on (`resolveStepJump`): the open entity when its own pipeline has the step,
 * else the first entity whose pipeline does. A profile-scoped step list (D18) makes a catalog
 * position mean a different step per entity. No such entity → select the catalog (honest).
 *
 * The index also carries the app's OTHER surfaces (`NAVIGABLE_SURFACES`): before this,
 * nothing in the lab — palette or header — could reach `/experiment` at all. A route hit
 * is a full-page jump, so it says so in its badge and leaves the lab's own nav callbacks
 * untouched. Every legacy-shell module has an address too (`MODULE_DESTINATIONS`): a
 * `module` hit is the same full-page jump, to `/?legacy=1&module=<id>`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { NAVIGABLE_SURFACES } from '@/lib/shell/surfaces';
import { MODULE_DESTINATIONS } from '@/lib/shell/shellRoute';
import { resolveCatalogSteps } from './catalogManifest';
import { resolveStepJump, toLabEntity } from './entityPipeline';
import { SearchCombobox, type SearchHit } from './ui/SearchCombobox';

/** What selecting a hit does. */
export type LabSearchTarget =
  | { kind: 'catalog'; catalogId: string }
  | { kind: 'entity'; catalogId: string; entityId: string }
  | { kind: 'step'; catalogId: string; step: string }
  /** A different top-level surface — a full-page jump, not an in-lab navigation. */
  | { kind: 'route'; route: string };

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

/** No rows yet — a stable reference so the closed search never churns its consumers. */
const NO_ROWS: IndexRow[] = [];

export function LabSearch({ open, onClose, currentEntityId, onSelectCatalog, onNavigate }: LabSearchProps) {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);

  // The search UI is mounted for the whole session but open for seconds of it, and its index
  // spans every catalog, every seeded entity and every step of every registered pipeline —
  // hundreds of rows built (and rebuilt on every entity change) while nothing was on screen.
  // A render-phase latch defers the first build to the first open and keeps it afterwards, so
  // reopening stays instant. (Adjusting state during render — not an effect — is the
  // sanctioned pattern; an effect here would trip `react-hooks/set-state-in-effect`.)
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) setEverOpened(true);

  // One flat index over catalogs + entities + steps, rebuilt only when the entity
  // universe changes (the step/catalog halves are static registry reads).
  const index = useMemo(() => {
    if (!everOpened) return NO_ROWS;
    const rows: IndexRow[] = [];
    // The other surfaces first — they are few, and one of them (`/experiment`) had no
    // entry point anywhere in the shell before this.
    for (const s of NAVIGABLE_SURFACES) {
      rows.push({
        hay: `${s.name} ${s.route} ${s.detail}`.toLowerCase(),
        hit: {
          key: `r:${s.route}`, label: s.name, detail: s.route, meta: s.detail, badge: 'page',
          payload: { kind: 'route', route: s.route },
        },
      });
    }
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
            payload: { kind: 'step', catalogId, step },
          },
        });
      });
    }
    for (const m of MODULE_DESTINATIONS) {
      rows.push({
        hay: `${m.label} ${m.id}`.toLowerCase(),
        hit: { key: `m:${m.id}`, label: m.label, detail: m.id, meta: 'Legacy shell', badge: 'module', payload: { kind: 'route', route: m.href } },
      });
    }
    return rows;
  }, [entitiesByCatalog, everOpened]);

  const search = useCallback(
    (needle: string) => index.filter((r) => r.hay.includes(needle)).map((r) => r.hit),
    [index],
  );

  const go = useCallback((hit: SearchHit<LabSearchTarget>) => {
    const t = hit.payload;
    if (t.kind === 'route') {
      // A whole different page: leave the lab rather than pretending it is an in-lab view.
      window.location.href = t.route;
    } else if (t.kind === 'catalog') {
      onSelectCatalog(t.catalogId);
    } else if (t.kind === 'entity') {
      onNavigate(t.catalogId, t.entityId, 0);
    } else {
      const entities = Object.values(entitiesByCatalog[t.catalogId] ?? {}).map(toLabEntity);
      const jump = resolveStepJump(t.catalogId, t.step, entities, currentEntityId);
      // No entity whose own pipeline has the step → nothing to open it ON; land on the catalog.
      if (jump) onNavigate(t.catalogId, jump.entityId, jump.stepIndex);
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
        ariaLabel="Search catalogs, entities, pipeline steps, pages and modules"
        placeholder="Catalog, entity, step, page or module — name or id…"
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
