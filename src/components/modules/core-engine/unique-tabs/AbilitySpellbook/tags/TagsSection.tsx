'use client';

import { useState, useMemo } from 'react';
import { Tags, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODULE_COLORS, withOpacity, OPACITY_10, OPACITY_15, OPACITY_5, OPACITY_25 } from '@/lib/chart-colors';
import { FeatureCard as SharedFeatureCard } from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../../_design';
import type { TagNode } from '../data';
import { useSpellbookData } from '../context';
import type { SectionProps } from '../types';

function filterTree(nodes: TagNode[], query: string): TagNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const result: TagNode[] = [];
  for (const node of nodes) {
    const nameMatch = node.name.toLowerCase().includes(q);
    const filteredChildren = node.children ? filterTree(node.children, query) : [];
    if (nameMatch || filteredChildren.length > 0) {
      result.push({
        name: node.name,
        children: nameMatch ? node.children : filteredChildren.length > 0 ? filteredChildren : undefined,
      });
    }
  }
  return result;
}

function countTags(nodes: TagNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) count += countTags(node.children);
  }
  return count;
}

export function TagsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const { TAG_TREE } = useSpellbookData();
  const [search, setSearch] = useState('');

  const filteredTree = useMemo(() => filterTree(TAG_TREE, search), [TAG_TREE, search]);
  const totalTags = useMemo(() => countTags(TAG_TREE), [TAG_TREE]);
  const filteredCount = useMemo(() => search ? countTags(filteredTree) : totalTags, [filteredTree, search, totalTags]);

  return (
    <div className="space-y-4 flex">
      <div className="w-1/2 pr-2">
        <SharedFeatureCard name="Gameplay Tags hierarchy" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={MODULE_COLORS.content} />
      </div>

      <div className="w-1/2 pl-2">
        <BlueprintPanel color={MODULE_COLORS.content} className="p-4 h-full">
          <SectionHeader icon={Tags} label={`Tag Hierarchy (${totalTags})`} color={MODULE_COLORS.content} />

          {/* Search filter */}
          <div className="relative mt-2 mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tags..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-deep border text-xs font-mono focus:outline-none transition-colors"
              style={{
                borderColor: search ? withOpacity(MODULE_COLORS.content, OPACITY_25) : 'var(--border)',
                color: 'var(--text)',
              }}
            />
            {search && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs font-mono text-text-muted">
                {filteredCount} match{filteredCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <div className="space-y-3 p-3 rounded-lg border max-h-[400px] overflow-y-auto" style={{ borderColor: withOpacity(MODULE_COLORS.content, OPACITY_15), backgroundColor: withOpacity(MODULE_COLORS.content, OPACITY_5) }}>
            {filteredTree.length === 0 ? (
              <div className="text-xs font-mono text-text-muted text-center py-4">No tags matching &ldquo;{search}&rdquo;</div>
            ) : (
              filteredTree.map((node) => (
                <TagTreeNode key={node.name} node={node} depth={0} forceOpen={!!search} />
              ))
            )}
          </div>
        </BlueprintPanel>
      </div>
    </div>
  );
}

function TagTreeNode({ node, depth, forceOpen }: { node: TagNode; depth: number; forceOpen: boolean }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = forceOpen || open;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
      className="overflow-hidden"
    >
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] py-1 hover:bg-surface-hover/50 rounded transition-colors w-full text-left focus:outline-none pr-2${hasChildren ? ' cursor-pointer' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} className="flex-shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </motion.div>
        ) : (
          <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MODULE_COLORS.content }} />
          </span>
        )}
        <span className={`font-mono text-xs ${hasChildren ? 'font-bold' : 'text-text-muted'}`}
          style={hasChildren ? { color: MODULE_COLORS.content, textShadow: `0 0 12px ${withOpacity(MODULE_COLORS.content, OPACITY_25)}` } : undefined}>
          {node.name}
        </span>
        {hasChildren && (
          <span className="text-2xs font-mono ml-auto" style={{ color: withOpacity(MODULE_COLORS.content, OPACITY_10) }}>
            {node.children!.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <TagTreeNode key={child.name} node={child} depth={depth + 1} forceOpen={forceOpen} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
