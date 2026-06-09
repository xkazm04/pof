'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import {
  STATUS_INFO, STATUS_WARNING, OVERLAY_WHITE,
  withOpacity, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { SHAPE_LABELS, INDENT, type FlatRow } from './bt-flowchart-utils';

interface BTFlowchartRowProps {
  row: FlatRow;
  idx: number;
  isSelected: boolean;
  isMatch: boolean | undefined;
  isCollapsed: boolean;
  accent: string;
  onNodeClick: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, idx: number) => void;
}

export function BTFlowchartRow({
  row, idx, isSelected, isMatch, isCollapsed,
  accent, onNodeClick, onToggleCollapse, onKeyDown,
}: BTFlowchartRowProps) {
  const { node, depth, hasChildren } = row;
  return (
    <div
      key={node.id}
      tabIndex={0}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      aria-label={`${node.label} — ${SHAPE_LABELS[node.shape]}, ${node.active ? 'active' : 'inactive'}`}
      onKeyDown={(e) => onKeyDown(e, idx)}
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
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
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

      {/* Label — inactive nodes use the AA --text-subtle tier, not white@50% under an
          extra opacity-50 (which compounded to well below WCAG AA). */}
      <span className="font-mono font-bold truncate"
        style={{ color: isSelected ? STATUS_INFO : node.active ? accent : 'var(--text-subtle)' }}>
        {node.label}
      </span>

      {/* Shape type badge — 12px-floor subtle micro-label (was text-[9px] text-text-muted/50) */}
      <MicroLabel mono uppercase className="ml-auto flex-shrink-0">
        {SHAPE_LABELS[node.shape]}
      </MicroLabel>
    </div>
  );
}
