'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { BT_TREE } from '../_shared/data';
import {
  NODE_MAP, getDescendants, type FlatRow,
} from './bt-flowchart-utils';
import { BTFlowchartRow } from './BTFlowchartRow';

interface BTFlowchartProps {
  expandedNodeId: string | null;
  onNodeClick: (id: string) => void;
  accent?: string;
}

export function BTFlowchart({ expandedNodeId, onNodeClick, accent = STATUS_SUCCESS }: BTFlowchartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Search matches */
  const searchLower = search.toLowerCase();
  const matchIds = useMemo(() => {
    if (!searchLower) return null;
    return new Set(BT_TREE.filter(n =>
      n.label.toLowerCase().includes(searchLower) || n.details.toLowerCase().includes(searchLower)
    ).map(n => n.id));
  }, [searchLower]);

  /* Auto-expand ancestors of search matches */
  const effectiveCollapsed = useMemo(() => {
    if (!matchIds) return collapsed;
    // Uncollapse any node whose subtree contains a match
    const next = new Set(collapsed);
    for (const id of next) {
      const descendants = getDescendants(id);
      for (const d of descendants) {
        if (matchIds.has(d)) { next.delete(id); break; }
      }
    }
    return next;
  }, [collapsed, matchIds]);

  /* Flatten tree for rendering */
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    function walk(id: string, depth: number) {
      const node = NODE_MAP.get(id);
      if (!node) return;
      const hasChildren = node.children.length > 0;
      rows.push({ node, depth, hasChildren });
      if (hasChildren && !effectiveCollapsed.has(id)) {
        for (const child of node.children) walk(child, depth + 1);
      }
    }
    const root = BT_TREE.find(n => n.id === 'root');
    if (root) walk(root.id, 0);
    return rows;
  }, [effectiveCollapsed]);

  /* Filtered rows when searching */
  const visibleRows = useMemo(() => {
    if (!matchIds) return flatRows;
    return flatRows.filter(r => matchIds.has(r.node.id));
  }, [flatRows, matchIds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (idx < visibleRows.length - 1) {
          const nextEl = listRef.current?.children[idx + 1] as HTMLElement | undefined;
          nextEl?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (idx > 0) {
          const prevEl = listRef.current?.children[idx - 1] as HTMLElement | undefined;
          prevEl?.focus();
        }
        break;
      case 'ArrowRight': {
        const row = visibleRows[idx];
        if (row.hasChildren && effectiveCollapsed.has(row.node.id)) {
          e.preventDefault();
          toggleCollapse(row.node.id);
        }
        break;
      }
      case 'ArrowLeft': {
        const row = visibleRows[idx];
        if (row.hasChildren && !effectiveCollapsed.has(row.node.id)) {
          e.preventDefault();
          toggleCollapse(row.node.id);
        }
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        onNodeClick(visibleRows[idx].node.id);
        break;
    }
  }, [visibleRows, effectiveCollapsed, toggleCollapse, onNodeClick]);

  return (
    <div className="flex-shrink-0 min-w-[260px] max-w-[360px]">
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search BT nodes..."
          className="w-full pl-7 pr-2 py-1 rounded border border-border/30 bg-surface-deep/60 text-xs font-mono text-text placeholder:text-text-subtle outline-none focus:border-[var(--accent)]"
        />
        {search && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted font-mono">
            {matchIds?.size ?? 0}
          </span>
        )}
      </div>

      {/* Collapse all / expand all */}
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => setCollapsed(new Set(BT_TREE.filter(n => n.children.length > 0).map(n => n.id)))}
          className="text-xs text-text-muted hover:text-text cursor-pointer px-1.5 py-0.5 rounded bg-surface border border-border/30">
          Collapse All
        </button>
        <button onClick={() => setCollapsed(new Set())}
          className="text-xs text-text-muted hover:text-text cursor-pointer px-1.5 py-0.5 rounded bg-surface border border-border/30">
          Expand All
        </button>
        <span className="text-xs text-text-muted font-mono ml-auto">
          {visibleRows.length} / {BT_TREE.length} nodes
        </span>
      </div>

      {/* Tree list */}
      <div ref={listRef} className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-0.5" role="tree" aria-label="Behavior Tree">
        {visibleRows.map((row, idx) => (
          <BTFlowchartRow
            key={row.node.id}
            row={row}
            idx={idx}
            isSelected={expandedNodeId === row.node.id}
            isMatch={matchIds?.has(row.node.id)}
            isCollapsed={effectiveCollapsed.has(row.node.id)}
            accent={accent}
            onNodeClick={onNodeClick}
            onToggleCollapse={toggleCollapse}
            onKeyDown={handleKeyDown}
          />
        ))}
      </div>
    </div>
  );
}
