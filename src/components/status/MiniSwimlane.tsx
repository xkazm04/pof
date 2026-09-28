'use client';

/**
 * One entity's realization as a compact swimlane row — the shared building block of the
 * Item Focus view. Reuses StatusCell so a connected node shows ITS OWN realization state
 * (e.g. is the loot table that drops this sword itself gate-verified?). An optional
 * direction glyph (`▸` forward / `◂` reverse) + role prefix names the connecting edge.
 * The label/row refocuses the whole view onto this node when clicked.
 *
 * A node whose evidence could not be read (`node.unknown`) renders UNKNOWN + the reason and
 * an em dash where the percentage goes — never 0%, never a row of R0 cells. A node graded
 * without judge verdicts (`node.verdictsUnknown`) says so in its readiness label.
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
  const graded = !!swimlane && swimlane.cells.length > 0;
  const edge = direction ? EDGE_WORD[direction] : 'focused entity';
  const relation = `${edge}${node.role ? `, as ${node.role}` : ''}`;
  const rowLabel = `${node.name} — ${relation} — ${node.catalogId}${node.missing ? ' — link target not found' : ''}. Focus this entity.`;
  const unknownText = `UNKNOWN — ${node.catalogId} not graded (${node.unknownReason ?? 'no reason given'}) — not R0`;
  const verdictNote = node.verdictsUnknown ? ' · judge verdicts unknown: checker status only' : '';
  const pctLabel = !swimlane
    ? unknownText
    : graded
      ? `${swimlane.readyPct}% of ${swimlane.cells.length} steps production-ready (R4+) · credible (R3+) ${swimlane.crediblePct}% · started (R1+) ${swimlane.startedPct}%${swimlane.blockedCount ? ` · ${swimlane.blockedCount} blocked` : ''}${verdictNote}`
      : 'No pipeline registered for this catalog — nothing to grade yet';
  return (
    <div
      data-testid={node.unknown ? `unknown-node-${node.catalogId}-${node.entityId}` : undefined}
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
        style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: graded && swimlane.readyPct > 0 ? 'var(--lab-ok)' : graded ? 'var(--lab-muted)' : 'var(--text-subtle)' }}
      >
        {graded ? `${swimlane.readyPct}%` : '—'}
      </span>
      <div style={{ display: 'flex', gap: 'var(--lab-s1)' }}>
        {!swimlane ? (
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-warn)', alignSelf: 'center' }}>
            <strong style={{ fontFamily: 'var(--lab-font-mono)' }}>UNKNOWN</strong> — not graded: {node.unknownReason ?? 'no reason given'}
          </span>
        ) : !graded && (
          <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--text-subtle)', fontStyle: 'italic', alignSelf: 'center' }}>
            no pipeline registered for this catalog
          </span>
        )}
        {swimlane?.cells.map((cell) => (
          <StatusCell key={cell.label} cell={cell} />
        ))}
      </div>
    </div>
  );
}

/**
 * The degraded-read notice the entity-scoped tabs share — same wording family as the
 * Pipelines banners. `artifacts`: a catalog's rows could not be read, so its rows are
 * UNKNOWN (not R0). `verdicts`: judge verdicts did not load, so cells show checker status
 * only. Either way the failure is SAID, with an operator-driven retry (nothing auto-retries).
 */
export function EvidenceReadNotice({
  kind,
  subject,
  error,
  onRetry,
}: {
  kind: 'artifacts' | 'verdicts';
  subject?: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--lab-s3)',
        padding: 'var(--lab-s2) var(--lab-s3)',
        margin: 'var(--lab-s2) 0 var(--lab-s3)',
        fontSize: 'var(--lab-fs-xs)',
        color: 'var(--lab-text)',
        // shorthand first — a later `border` would wipe the warn stripe.
        border: '1px solid var(--lab-line)',
        borderLeft: '3px solid var(--lab-warn)',
        borderRadius: 'var(--lab-r-sm)',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <strong style={{ fontFamily: 'var(--lab-font-mono)' }}>PARTIAL</strong>
        {kind === 'verdicts'
          ? ' — judge verdicts did not load, so cells show gate/checker status only: a judged pass or fail is not reflected below.'
          : ` — ${subject ?? 'this catalog'}'s artifacts could not be read, so its rows are UNKNOWN below, not R0 NOT WIRED.`}
        {' '}({error})
      </span>
      <button
        type="button"
        className="focus-ring"
        onClick={onRetry}
        style={{
          flexShrink: 0,
          padding: 'var(--lab-s1) var(--lab-s2)',
          fontSize: 'var(--lab-fs-xs)',
          fontFamily: 'var(--lab-font-mono)',
          fontWeight: 700,
          color: 'var(--lab-ink)',
          background: 'transparent',
          border: '1px solid var(--lab-ink)',
          borderRadius: 'var(--lab-r-sm)',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
