'use client';

import { useMemo, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import { buildEntityTree, flattenVisible, type TreeRow } from '@/lib/catalog/tree';
import type { CatalogEntityBase } from '@/lib/catalog/types';

interface Props {
  catalogId: string;
  entities: CatalogEntityBase[];
}

/** Above this many visible rows, switch to windowed (virtualized) rendering. */
const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 30;

interface RowCtx {
  catalogId: string;
  selectEntity: (catalogId: string, entityId: string) => void;
  activeEntityId: string | null;
  collapsed: Set<string>;
  toggle: (key: string) => void;
}

/** One tree row (group header or entity), reused by the plain + windowed paths. */
function EntityTreeRow({ row, ctx }: { row: TreeRow; ctx: RowCtx }) {
  const padStyle = { paddingLeft: 8 + row.depth * 12 };

  if (row.kind === 'group') {
    const open = !ctx.collapsed.has(row.key);
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
      <button
        role="treeitem"
        aria-expanded={open}
        aria-selected={false}
        onClick={() => ctx.toggle(row.key)}
        style={padStyle}
        className="focus-ring w-full flex items-center gap-1 py-1 pr-2 text-2xs font-mono uppercase tracking-[0.12em] text-text-muted hover:text-text"
      >
        <Chevron className="w-3 h-3 shrink-0" />
        <span className="truncate">{row.label}</span>
        <span className="text-text-muted/60">({row.count})</span>
      </button>
    );
  }

  const isActive = ctx.activeEntityId === row.entity!.id;
  return (
    <button
      role="treeitem"
      aria-selected={isActive}
      onClick={() => ctx.selectEntity(ctx.catalogId, row.entity!.id)}
      style={padStyle}
      className={`focus-ring w-full flex items-center gap-2 pr-2 py-1.5 rounded text-xs text-left ${
        isActive ? 'bg-surface text-text' : 'text-text-muted hover:text-text hover:bg-surface/40'
      }`}
    >
      <span className="flex-1 truncate">{row.label}</span>
      <LifecycleBadge state={row.entity!.lifecycle} />
    </button>
  );
}

/** Windowed row: react-window positions the outer div; the button fills it. */
function VirtualRow({ index, style, rows, ctx }: RowComponentProps<{ rows: TreeRow[]; ctx: RowCtx }>) {
  return (
    <div style={style}>
      <EntityTreeRow row={rows[index]} ctx={ctx} />
    </div>
  );
}

/**
 * Left-pane catalog tree. Renders the entity set as an N-level collapsible tree
 * built from each entity's full `categoryPath` (spellbook: category→element,
 * bestiary: tier→role, …), with a name filter and virtualization for large
 * catalogs (1000+). Selection flows through `ecwStore.selectEntity`.
 */
export function EntityTree({ catalogId, entities }: Props) {
  const activeEntityId = useEcwStore((s) => s.activeEntityId);
  const selectEntity = useEcwStore((s) => s.selectEntity);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');

  const rows = useMemo(
    () => flattenVisible(buildEntityTree(entities), collapsed, filter),
    [entities, collapsed, filter],
  );

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (entities.length === 0) {
    return <p className="text-xs text-text-muted/70 italic px-3 py-4">No entities in this catalog.</p>;
  }

  const ctx: RowCtx = { catalogId, selectEntity, activeEntityId, collapsed, toggle };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <input
        value={filter}
        onChange={(ev) => setFilter(ev.target.value)}
        placeholder="Filter…"
        aria-label="Filter entities"
        className="focus-ring mx-2 my-2 bg-surface-deep border border-border/50 rounded px-2 py-1 text-xs text-text placeholder:text-text-muted/60 outline-none"
      />
      <nav role="tree" aria-label="Entity tree" className="flex-1 overflow-auto min-h-0 px-1 pb-2">
        {rows.length > VIRTUALIZE_THRESHOLD ? (
          <List
            style={{ height: '100%' }}
            rowCount={rows.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={VirtualRow}
            rowProps={{ rows, ctx }}
          />
        ) : (
          rows.map((row) => <EntityTreeRow key={row.key} row={row} ctx={ctx} />)
        )}
      </nav>
    </div>
  );
}
