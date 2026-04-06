'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_INFO, STATUS_WARNING, OVERLAY_WHITE,
  withOpacity, OPACITY_15, OPACITY_20, OPACITY_50,
} from '@/lib/chart-colors';
import type { BtTreeNode } from '../data';
import { BT_TREE } from '../data';

interface BTFlowchartProps {
  expandedNodeId: string | null;
  onNodeClick: (id: string) => void;
  accent?: string;
}

const SHAPE_LABELS: Record<BtTreeNode['shape'], string> = {
  diamond: 'Selector',
  rect: 'Sequence',
  rounded: 'Task',
  hexagon: 'Decorator',
};

const INDENT = 20;

/** Build a lookup map from BT_TREE for O(1) access. */
const NODE_MAP = new Map(BT_TREE.map(n => [n.id, n]));

/** Collect all descendant IDs for a given node. */
function getDescendants(id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const node = NODE_MAP.get(current);
    if (node) {
      for (const child of node.children) {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      }
    }
  }
  return result;
}

interface FlatRow {
  node: BtTreeNode;
  depth: number;
  hasChildren: boolean;
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
          className="w-full pl-7 pr-2 py-1 rounded border border-border/30 bg-surface-deep/60 text-xs font-mono text-text placeholder:text-text-muted/50 outline-none focus:border-[var(--accent)]"
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
        {visibleRows.map((row, idx) => {
          const { node, depth, hasChildren } = row;
          const isSelected = expandedNodeId === node.id;
          const isMatch = matchIds?.has(node.id);
          const isCollapsed = effectiveCollapsed.has(node.id);

          return (
            <div
              key={node.id}
              tabIndex={0}
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={hasChildren ? !isCollapsed : undefined}
              aria-label={`${node.label} — ${SHAPE_LABELS[node.shape]}, ${node.active ? 'active' : 'inactive'}`}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onClick={() => onNodeClick(node.id)}
              className={`flex items-center gap-1 py-1 px-1.5 rounded text-xs cursor-pointer transition-colors outline-none focus-visible:ring-1 ${
                isSelected ? 'ring-1' : 'hover:bg-surface-hover/50'
              }`}
              style={{
                paddingLeft: `${depth * INDENT + 4}px`,
                ...(isSelected ? { backgroundColor: withOpacity(STATUS_INFO, OPACITY_15), outline: `1px solid ${withOpacity(STATUS_INFO, '4D')}` } : {}),
                ...(isMatch && !isSelected ? { backgroundColor: withOpacity(STATUS_WARNING, '1A') } : {}),
              }}
            >
              {/* Collapse toggle */}
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
                  className="w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  tabIndex={-1}
                >
                  {isCollapsed
                    ? <ChevronRight className="w-3 h-3 text-text-muted" />
                    : <ChevronDown className="w-3 h-3 text-text-muted" />}
                </button>
              ) : (
                <span className="w-4 h-4 flex-shrink-0" />
              )}

              {/* Shape indicator */}
              <span className="w-3 h-3 flex-shrink-0 border rounded-sm flex items-center justify-center"
                style={{
                  borderColor: node.active ? accent : withOpacity(OVERLAY_WHITE, OPACITY_20),
                  backgroundColor: node.active ? withOpacity(accent, OPACITY_15) : 'transparent',
                  borderRadius: node.shape === 'rounded' ? '50%' : node.shape === 'diamond' ? '0' : '2px',
                  transform: node.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : undefined,
                }}
              />

              {/* Label */}
              <span className={`font-mono font-bold truncate ${
                node.active ? '' : 'opacity-50'
              }`} style={{ color: isSelected ? STATUS_INFO : node.active ? accent : withOpacity(OVERLAY_WHITE, OPACITY_50) }}>
                {node.label}
              </span>

              {/* Shape type badge */}
              <span className="text-text-muted/50 font-mono text-[9px] uppercase ml-auto flex-shrink-0">
                {SHAPE_LABELS[node.shape]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
