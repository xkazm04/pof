'use client';

import { useState } from 'react';
import { Tags, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { FeatureCard as SharedFeatureCard } from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { TagNode } from './data';
import { useSpellbookData } from './context';
import type { SectionProps } from './types';

export function TagsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const { TAG_TREE } = useSpellbookData();
  return (
    <div className="space-y-4 flex">
      <div className="w-1/2 pr-2">
        <SharedFeatureCard name="Gameplay Tags hierarchy" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={MODULE_COLORS.content} />
      </div>

      <div className="w-1/2 pl-2">
        <BlueprintPanel color={MODULE_COLORS.content} className="p-4 h-full">
          <SectionHeader icon={Tags} label="Tag Hierarchy Data" color={MODULE_COLORS.content} />
          <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: `${MODULE_COLORS.content}25`, backgroundColor: `${MODULE_COLORS.content}08` }}>
            {TAG_TREE.map((node) => (
              <TagTreeNode key={node.name} node={node} depth={0} />
            ))}
          </div>
        </BlueprintPanel>
      </div>
    </div>
  );
}

function TagTreeNode({ node, depth }: { node: TagNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
      className="overflow-hidden"
    >
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] py-1 hover:bg-surface-hover/50 rounded transition-colors w-full text-left focus:outline-none pr-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <motion.div animate={{ rotate: open ? 90 : 0 }} className="flex-shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </motion.div>
        ) : (
          <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MODULE_COLORS.content }} />
          </span>
        )}
        <span className={`font-mono text-xs ${hasChildren ? 'font-bold' : 'text-text-muted'}`}
          style={hasChildren ? { color: MODULE_COLORS.content, textShadow: `0 0 12px ${MODULE_COLORS.content}40` } : undefined}>
          {node.name}
        </span>
      </button>
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <TagTreeNode key={child.name} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
