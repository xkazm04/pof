'use client';

import { useState } from 'react';
import { GitBranch, ExternalLink, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_ERROR,
  OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_25,
  GLOW_LG,
  withOpacity,
} from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, CornerBrackets } from '../design';
import { CLASS_TREE, type ClassNode } from '../data';

export function ClassHierarchy() {
  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={GitBranch} label="Class Hierarchy" />
      <div className="rounded-lg border border-border/20 bg-surface/30 p-4 relative">
        <CornerBrackets size={8} />
        <ClassTreeNode node={CLASS_TREE} depth={0} index={0} />
      </div>
    </BlueprintPanel>
  );
}

function ClassTreeNode({ node, depth, index }: { node: ClassNode; depth: number; index: number }) {
  const hasChildren = node.children && node.children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * MOTION_CONFIG.stagger, ...MOTION_CONFIG.standard }}
      style={{ paddingLeft: depth === 0 ? 0 : 32 }}
      className="relative"
    >
      {/* Vertical connector line */}
      {depth > 0 && (
        <svg className="absolute pointer-events-none" style={{ left: 4, top: 0, width: 28, height: '100%' }}>
          <motion.line
            x1="4" y1="0" x2="4" y2="18"
            stroke={withOpacity(node.color, OPACITY_25)} strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          <motion.line
            x1="4" y1="18" x2="24" y2="18"
            stroke={withOpacity(node.color, OPACITY_25)} strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
          />
          {/* Animated pulse dot at junction */}
          <motion.circle
            cx="4" cy="18" r="2"
            fill={node.color}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      )}

      {/* Node row */}
      <div className="relative flex items-center gap-2 py-2">
        {/* Expand toggle */}
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded transition-colors hover:bg-surface/50 cursor-pointer"
            style={{ color: node.color }}>
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={MOTION_CONFIG.micro}>
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.div>
          </button>
        ) : (
          <span className="w-[18px]" />
        )}

        {/* Node badge */}
        <motion.div
          className="relative flex items-center gap-2 group cursor-default"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          whileHover={{ scale: 1.02 }}
        >
          {/* Class name chip */}
          <span
            className="relative text-sm font-mono font-bold px-3 py-1.5 rounded-md border transition-all overflow-hidden"
            style={{
              borderColor: withOpacity(node.color, OPACITY_25),
              backgroundColor: withOpacity(node.color, OPACITY_8),
              color: node.color,
              textShadow: `${GLOW_LG} ${withOpacity(node.color, OPACITY_20)}`,
              boxShadow: hovered ? `${GLOW_LG} ${withOpacity(node.color, OPACITY_12)}, inset ${GLOW_LG} ${withOpacity(node.color, OPACITY_5)}` : 'none',
            }}
          >
            {/* Inner glow line at top */}
            <span className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${withOpacity(node.color, OPACITY_25)}, transparent)` }} />
            {node.name}
          </span>

          {/* Subtitle tag */}
          {node.subtitle && (
            <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] px-2 py-1 rounded border border-border/30 bg-surface/50 text-text-muted">
              {node.subtitle}
            </span>
          )}

          {/* Component count badge */}
          {node.componentCount !== undefined && (
            <span className="flex items-center gap-1 text-xs font-mono text-text-muted">
              <Layers className="w-2.5 h-2.5" />
              {node.componentCount}
            </span>
          )}

          {/* Cross-reference link */}
          {node.crossRef && (
            <span
              className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border cursor-pointer hover:brightness-125 transition-all"
              style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8), color: STATUS_ERROR, borderColor: withOpacity(STATUS_ERROR, OPACITY_20) }}>
              <ExternalLink className="w-2.5 h-2.5" />
              {node.crossRef}
            </span>
          )}

          {/* Hover tooltip */}
          <AnimatePresence>
            {hovered && node.headerFile && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={MOTION_CONFIG.micro}
                className="absolute left-0 top-full mt-2 z-50 px-3 py-2 rounded-md border bg-surface-deep shadow-2xl"
                style={{ borderColor: withOpacity(node.color, OPACITY_15), boxShadow: `0 8px 32px ${withOpacity(node.color, OPACITY_8)}` }}
              >
                <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-0.5">Header</div>
                <div className="text-xs font-mono" style={{ color: node.color }}>{node.headerFile}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {hasChildren && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={MOTION_CONFIG.standard}
            className="overflow-hidden"
          >
            <div className="border-l ml-[11px] relative" style={{ borderColor: withOpacity(node.color, OPACITY_12) }}>
              {node.children!.map((child, i) => (
                <ClassTreeNode key={child.name} node={child} depth={depth + 1} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
