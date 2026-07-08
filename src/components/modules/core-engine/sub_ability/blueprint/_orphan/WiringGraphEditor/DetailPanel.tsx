'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { withOpacity, OPACITY_5, OPACITY_20 } from '@/lib/chart-colors';
import { motionSafe, ANIMATION_PRESETS } from '@/lib/motion';
import type { GASGraphNode, GraphWire } from '../types';

export function DetailPanel({
  selectedDetail, nodes, prefersReduced,
}: {
  selectedDetail: { node: GASGraphNode; inWires: GraphWire[]; outWires: GraphWire[] } | null;
  nodes: GASGraphNode[];
  prefersReduced: boolean | null;
}) {
  return (
    <AnimatePresence>
      {selectedDetail && (
        <motion.div
          initial={prefersReduced ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={motionSafe(ANIMATION_PRESETS.entrance, prefersReduced)}
          className="overflow-hidden"
        >
          <div
            className="p-2.5 rounded-lg border space-y-1.5"
            style={{
              borderColor: `${withOpacity(selectedDetail.node.color, OPACITY_20)}`,
              backgroundColor: `${withOpacity(selectedDetail.node.color, OPACITY_5)}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedDetail.node.color }} />
              <span className="text-xs font-mono font-bold" style={{ color: selectedDetail.node.color }}>
                {selectedDetail.node.label}
              </span>
              <span className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                {selectedDetail.node.type}
              </span>
            </div>

            {selectedDetail.inWires.length > 0 && (
              <div className="text-2xs text-text-muted">
                <span className="font-bold">Inputs:</span>{' '}
                {selectedDetail.inWires.map(w => {
                  const srcNode = nodes.find(n => n.id === w.fromNode);
                  return srcNode?.label;
                }).filter(Boolean).join(', ')}
              </div>
            )}

            {selectedDetail.outWires.length > 0 && (
              <div className="text-2xs text-text-muted">
                <span className="font-bold">Outputs:</span>{' '}
                {selectedDetail.outWires.map(w => {
                  const tgtNode = nodes.find(n => n.id === w.toNode);
                  return tgtNode?.label;
                }).filter(Boolean).join(', ')}
              </div>
            )}

            {selectedDetail.inWires.length === 0 && selectedDetail.outWires.length === 0 && (
              <div className="text-2xs text-text-muted italic">No connections — this node is isolated</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
