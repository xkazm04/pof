'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_CYAN, STATUS_SUCCESS, STATUS_NEUTRAL,
  withOpacity, OPACITY_20, OPACITY_25, OPACITY_50,
} from '@/lib/chart-colors';
import { BT_TREE, DETECTED_ENTITIES } from '../_shared/data';

/* ── Perception Legend ────────────────────────────────────────────────── */

export function PerceptionLegend() {
  return (
    <div className="space-y-3 flex-1 min-w-0">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Sense Legend</div>
      {[
        { label: 'Sight Cone', desc: '60 deg, 1500cm', color: withOpacity(ACCENT_CYAN, OPACITY_50), dashed: false },
        { label: 'Hearing Range', desc: '800cm radius', color: withOpacity(ACCENT_CYAN, OPACITY_25), dashed: true },
      ].map(s => (
        <div key={s.label} className="flex items-center gap-2 text-xs">
          <div className="w-5 h-[2px] flex-shrink-0"
            style={{ backgroundColor: s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined }} />
          <span className="font-medium text-text">{s.label}</span>
          <span className="text-text-muted text-xs">{s.desc}</span>
        </div>
      ))}
      <div className="border-t border-border/30 pt-2 space-y-1.5 mt-2">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Detected</div>
        {DETECTED_ENTITIES.map(e => (
          <div key={e.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            <span className="font-medium text-text">{e.label}</span>
            <span className="text-xs text-text-muted">
              {e.inCone ? 'In sight' : e.inHearing ? 'Heard' : 'Undetected'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BT Details Panel ────────────────────────────────────────────────── */

export function BtDetailsPanel({ expandedNodeId }: { expandedNodeId: string | null }) {
  const node = expandedNodeId ? BT_TREE.find(n => n.id === expandedNodeId) : null;
  return (
    <div className="flex-1 min-w-0">
      <AnimatePresence mode="sync">
        {node ? (
          <motion.div key={expandedNodeId}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="bg-surface-deep p-3 rounded-lg border border-border/40 space-y-3">
            <div className="text-xs font-bold text-text">{node.label}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-text-muted">Shape:</span>
              <span className="text-xs font-mono text-text">{node.shape}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: withOpacity(node.active ? STATUS_SUCCESS : STATUS_NEUTRAL, OPACITY_20),
                  color: node.active ? STATUS_SUCCESS : STATUS_NEUTRAL,
                }}>
                {node.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{node.details}</p>
          </motion.div>
        ) : (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-text-muted italic mt-2">
            Click or press Enter on a node to view details. Arrow keys navigate between connected nodes.
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap gap-2 mt-3">
        {[
          { shape: 'diamond', label: 'Selector' },
          { shape: 'rect', label: 'Sequence' },
          { shape: 'rounded', label: 'Task' },
          { shape: 'hexagon', label: 'Decorator' },
        ].map(l => (
          <span key={l.shape} className="text-xs font-mono text-text-muted flex items-center gap-1">
            <span className="w-2 h-2 border border-text-muted/40 flex-shrink-0" style={{
              borderRadius: l.shape === 'rounded' ? '50%' : l.shape === 'diamond' ? '0' : '2px',
              transform: l.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : undefined,
            }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
