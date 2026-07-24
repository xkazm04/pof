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

/** Spoken form of the edge direction. The `▸`/`◂` glyph is decorative, so without this
 *  a screen reader loses which side of the dependency the row sits on. */
const EDGE_WORD = { forward: 'links to', reverse: 'referenced by' } as const;

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
  // A catalog with no registered pipeline has nothing to grade — showing "0%" there
  // reads as "graded and failing", which is a lie. Show an explicit no-data dash.
  const graded = swimlane.cells.length > 0;
  const edge = direction ? EDGE_WORD[direction] : 'focused entity';
  const relation = `${edge}${node.role ? `, as ${node.role}` : ''}`;
  const rowLabel = `${node.name} — ${relation} — ${node.catalogId}${node.missing ? ' — link target not found' : ''}. Focus this entity.`;
  const pctLabel = graded
    ? `${swimlane.verifiedPct}% of ${swimlane.cells.length} steps gate-verified · credible ${swimlane.credibleGePct}% · any artifact ${swimlane.wiredPct}%`
    : 'No pipeline registered for this catalog — nothing to grade yet';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--lab-s2)',
        marginBottom: 'var(--lab-s2)',
        minWidth: 'max-content',
        // Constant on every row so the focus row's stripe/tint never shifts alignment.
        padding: '0 var(--lab-s2)',
        borderRadius: 'var(--lab-r-sm)',
        // The focused entity was only a 1px font bump apart from its neighbours; give it
        // an accent stripe + tint so "this is the row you are looking at" reads instantly.
        boxShadow: emphasis ? 'inset 3px 0 0 var(--lab-accent)' : undefined,
        background: emphasis ? 'color-mix(in srgb, var(--lab-ink) 7%, transparent)' : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onFocus(node.catalogId, node.entityId)}
        className="focus-ring"
        aria-label={rowLabel}
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
          {node.missing && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 12 }}>(missing)</span>}
        </span>
        {/* 12px on the AA-safe subtle tier — the 10px muted line sat under the legibility
            floor for the one piece of text that disambiguates same-named entities. */}
        <span style={{ fontSize: 12, fontFamily: 'var(--lab-font-mono)', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.catalogId}{node.role ? ` · ${node.role}` : ''}
        </span>
      </button>
      <span
        role="img"
        aria-label={pctLabel}
        title={pctLabel}
        style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: !graded ? 'var(--text-subtle)' : swimlane.verifiedPct > 0 ? 'var(--lab-ok)' : 'var(--lab-muted)' }}
      >
        {graded ? `${swimlane.verifiedPct}%` : '—'}
      </span>
      <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
        {!graded && (
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--text-subtle)', fontStyle: 'italic', alignSelf: 'center' }}>
            no pipeline registered for this catalog
          </span>
        )}
        {swimlane.cells.map((cell) => (
          <StatusCell key={cell.label} cell={cell} />
        ))}
      </div>
    </div>
  );
}
