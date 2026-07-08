'use client';

/**
 * One entity's realization as a compact swimlane row — the shared building block of the
 * Item Focus view. Reuses StatusCell so a connected node shows ITS OWN realization state
 * (e.g. is the loot table that drops this sword itself gate-verified?). An optional
 * direction glyph (`▸` forward / `◂` reverse) + role prefix names the connecting edge.
 * The label/row refocuses the whole view onto this node when clicked.
 */
import type { FocusNode } from '@/lib/status/itemFocusModel';
import { StatusCell } from './StatusCell';

export function MiniSwimlane({
  node,
  direction,
  emphasis = false,
  onFocus,
}: {
  node: FocusNode;
  /** Edge direction relative to the focus, or undefined for the focus itself. */
  direction?: 'forward' | 'reverse';
  /** The focused entity's own row renders slightly stronger. */
  emphasis?: boolean;
  onFocus: (catalogId: string, entityId: string) => void;
}) {
  const arrow = direction === 'forward' ? '▸' : direction === 'reverse' ? '◂' : '';
  const { swimlane } = node;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)', minWidth: 'max-content' }}>
      <button
        type="button"
        onClick={() => onFocus(node.catalogId, node.entityId)}
        className="focus-ring"
        title={`${node.catalogId} · ${node.entityId}${node.role ? ` (${node.role})` : ''}${node.missing ? ' — link target not found' : ''} — click to focus`}
        style={{
          width: 260,
          flexShrink: 0,
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: emphasis ? 'var(--lab-fs-sm)' : 'var(--lab-fs-xs)', fontWeight: 700, fontFamily: 'var(--lab-font-mono)', color: node.missing ? 'var(--lab-bad)' : 'var(--lab-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {arrow && <span aria-hidden="true" style={{ marginRight: 4, color: 'var(--lab-muted)' }}>{arrow}</span>}
          {node.name}
          {node.missing && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 'var(--lab-fs-2xs, 10px)' }}>(missing)</span>}
        </span>
        <span style={{ fontSize: 'var(--lab-fs-2xs, 10px)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.catalogId}{node.role ? ` · ${node.role}` : ''}
        </span>
      </button>
      <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: swimlane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }} title="gate-verified steps">
        {swimlane.verifiedPct}%
      </span>
      <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
        {swimlane.cells.length === 0 && (
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', fontStyle: 'italic', alignSelf: 'center' }}>no pipeline steps</span>
        )}
        {swimlane.cells.map((cell) => (
          <StatusCell key={cell.label} cell={cell} />
        ))}
      </div>
    </div>
  );
}
