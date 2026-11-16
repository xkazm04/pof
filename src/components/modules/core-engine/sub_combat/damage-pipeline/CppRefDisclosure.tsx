'use client';

import { useState, useCallback, useId, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PipelineNode } from './types';

/**
 * One C++-reference disclosure contract for the Damage / Heal / Direct flows:
 * toggle state, Enter/Space on a node, Escape anywhere in the flow (focus goes
 * back to the node that opened the panel) and a unique panel id per instance.
 */
export function useCppRefDisclosure(nodes: PipelineNode[], idSuffix = 'cppref') {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const uid = useId();
  const panelId = `${uid}-${idSuffix}`;

  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  /** Collapse the panel and hand focus back to the node that opened it. */
  const collapse = useCallback(() => {
    if (expandedNode) document.getElementById(`${uid}-node-${expandedNode}`)?.focus();
    setExpandedNode(null);
  }, [expandedNode, uid]);

  /** Spread on the container: Escape from any descendant closes the panel. */
  const containerProps = {
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape' && expandedNode) {
        e.stopPropagation();
        collapse();
      }
    },
  };

  /** The focus/ARIA contract SVG shapes never get for free (FlowNode owns the mouse click). */
  const nodeProps = (node: PipelineNode) => {
    const interactive = Boolean(node.cppRef);
    const isExpanded = expandedNode === node.id;
    return {
      id: `${uid}-node-${node.id}`,
      role: interactive ? ('button' as const) : ('img' as const),
      tabIndex: interactive ? 0 : undefined,
      'aria-expanded': interactive ? isExpanded : undefined,
      'aria-controls': interactive && isExpanded ? panelId : undefined,
      className: interactive ? 'focus-ring-outline cursor-pointer' : undefined,
      onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle(node.id);
        }
      },
    };
  };

  return {
    expandedNode,
    expandedNodeData: nodes.find((n) => n.id === expandedNode),
    panelId,
    toggle,
    collapse,
    containerProps,
    nodeProps,
  };
}

interface CppRefPanelProps {
  node: PipelineNode | undefined;
  panelId: string;
  onClose: () => void;
}

export function CppRefPanel({ node, panelId, onClose }: CppRefPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {node?.cppRef && (
        <motion.div key={node.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          id={panelId}
          role="region"
          aria-label={`C++ reference for ${node.label}`}
          className="mt-2 px-3 py-2 rounded-lg border border-border/40 bg-surface-deep/80"
          data-testid="pipeline-cpp-ref">
          {/* Name the step the snippet belongs to: the panel sits below a
              scrollable diagram, so "C++ Reference" alone is ambiguous. */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">
              C++ Reference — <span className="text-text">{node.label}</span>
            </div>
            <button type="button"
              onClick={onClose}
              aria-label={`Hide C++ reference for ${node.label}`}
              className="focus-ring shrink-0 rounded p-0.5 text-text-muted hover:text-text"
              data-testid="pipeline-cpp-ref-close">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <code className="text-xs font-mono text-text break-all">{node.cppRef}</code>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
