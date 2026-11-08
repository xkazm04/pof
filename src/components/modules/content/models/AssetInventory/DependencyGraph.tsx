import { useId } from 'react';
import { TYPE_CONFIG } from './constants';
import type { DependencyGraphProps } from './types';
import type { ScannedAsset } from '@/app/api/filesystem/scan-assets/route';
import type { EdgeProvenance } from '@/lib/asset-inventory/declared-edges';

/** Declared (UE's manifest) edges are solid; name guesses are dashed. */
const EDGE_STYLE: Record<EdgeProvenance, { stroke: string; dash?: string; label: string }> = {
  declared: { stroke: 'var(--text-muted)', label: 'UE-declared' },
  inferred: { stroke: 'var(--border)', dash: '4 3', label: 'Guessed from names' },
};

/** Rows per side. A hub asset (a master material with 300 instances) would otherwise draw a 10k px graph. */
export const GRAPH_MAX_ROWS = 12;

function emptyMessage(ueListed: boolean | null): string {
  if (ueListed === true) return 'UE declares no references to or from this asset';
  if (ueListed === false) return 'No known dependencies - not in the UE manifest, and name matching found none';
  return 'No known dependencies - name matching found none (connect PoF Bridge for UE-declared references)';
}

function Swatch({ provenance }: { provenance: EdgeProvenance }) {
  const s = EDGE_STYLE[provenance];
  return (
    <svg width={18} height={6} aria-hidden="true" className="inline-block mr-1 align-middle">
      <line x1={0} y1={3} x2={18} y2={3} stroke={s.stroke} strokeWidth={1.5} strokeDasharray={s.dash} />
    </svg>
  );
}

function MoreNode({ x, y, count }: { x: number; y: number; count: number }) {
  return (
    <g data-testid="dependency-more">
      <rect x={x} y={y - 12} width={150} height={24} rx={4} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
      <text x={x + 12} y={y + 3.5} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">{`+${count} more (listed below)`}</text>
    </g>
  );
}

export function DependencyGraph({ asset, allAssets, dependencies, ueListed }: DependencyGraphProps) {
  // Per-instance marker id: a document-global 'arrowhead' collides with other
  // graphs kept mounted by the module LRU, and url(#id) resolves to the first.
  const markerId = `asset-dep-arrow-${useId().replace(/:/g, '')}`;
  // Edges are keyed by relativePath (unique), not basename (can collide).
  const outEdges = dependencies.filter(e => e.from === asset.relativePath);
  const inEdges = dependencies.filter(e => e.to === asset.relativePath);

  if (outEdges.length === 0 && inEdges.length === 0) {
    return (
      <div className="text-xs text-text-muted italic py-2 pl-2">
        {emptyMessage(ueListed)}
      </div>
    );
  }

  const own = [...outEdges, ...inEdges];
  const declaredCount = own.filter(e => e.provenance === 'declared').length;
  const guessedCount = own.length - declaredCount;

  const assetMap: Record<string, ScannedAsset> = {};
  for (const a of allAssets) assetMap[a.relativePath] = a;

  // Build node list: center = this asset, left = sources (things that reference this), right = targets (things this references).
  // `key` is the unique relativePath; `name` is the display basename (falls back to the path if the asset isn't in the current list).
  const sources = inEdges.map(e => ({ key: e.from, name: assetMap[e.from]?.name ?? e.from, relation: e.relation, provenance: e.provenance, asset: assetMap[e.from] as ScannedAsset | undefined }));
  const targets = outEdges.map(e => ({ key: e.to, name: assetMap[e.to]?.name ?? e.to, relation: e.relation, provenance: e.provenance, asset: assetMap[e.to] as ScannedAsset | undefined }));

  // Past the row cap a side shows (cap - 1) nodes and one '+N more' node; the rest are listed below.
  const sideShown = <T,>(list: T[]) => (list.length > GRAPH_MAX_ROWS ? list.slice(0, GRAPH_MAX_ROWS - 1) : list);
  const shownSources = sideShown(sources);
  const shownTargets = sideShown(targets);
  const moreSources = sources.length - shownSources.length;
  const moreTargets = targets.length - shownTargets.length;
  const overflow = [
    ...sources.slice(shownSources.length).map(s => ({ ...s, text: `${s.name} ${s.relation} ${asset.name}` })),
    ...targets.slice(shownTargets.length).map(t => ({ ...t, text: `${asset.name} ${t.relation} ${t.name}` })),
  ];
  const leftRows = shownSources.length + (moreSources > 0 ? 1 : 0);
  const rightRows = shownTargets.length + (moreTargets > 0 ? 1 : 0);

  const nodeH = 28;
  const maxNodes = Math.max(leftRows, rightRows, 1);
  const svgH = Math.max(maxNodes * (nodeH + 6) + 20, 60);
  const svgW = 520;
  const centerX = svgW / 2;
  const centerY = svgH / 2;

  function nodeY(idx: number, total: number) {
    if (total === 0) return centerY;
    const spacing = Math.min(nodeH + 6, (svgH - 20) / total);
    const startY = centerY - ((total - 1) * spacing) / 2;
    return startY + idx * spacing;
  }

  const typeConf = TYPE_CONFIG[asset.type];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Legend: every edge says where it came from; a guess is never shown as declared. */}
      <div className="text-2xs text-text-muted font-mono flex items-center gap-3">
        {ueListed === null ? (
          <span><Swatch provenance="inferred" />{guessedCount} guessed from names · no UE manifest connected</span>
        ) : (
          <>
            <span><Swatch provenance="declared" />{declaredCount} UE-declared</span>
            <span><Swatch provenance="inferred" />{guessedCount} guessed from names</span>
          </>
        )}
      </div>
      <svg width={svgW} height={svgH} className="block">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>

        {/* Source nodes (left) */}
        {shownSources.map((s, i) => {
          const y = nodeY(i, leftRows);
          const conf = s.asset ? TYPE_CONFIG[s.asset.type] : TYPE_CONFIG.other;
          const edge = EDGE_STYLE[s.provenance];
          return (
            <g key={`src-${s.key}`}>
              {/* The label below is cut at 18 chars; the node keeps its full name. */}
              <title>{`${s.name} (${s.key})`}</title>
              <line x1={160} y1={y} x2={centerX - 60} y2={centerY}
                stroke={edge.stroke} strokeWidth={1} strokeDasharray={edge.dash} markerEnd={`url(#${markerId})`}>
                <title>{`${edge.label}: ${s.name} ${s.relation} ${asset.name}`}</title>
              </line>
              <rect x={10} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
              <circle cx={22} cy={y} r={4} fill={conf.color} />
              <text x={30} y={y + 3.5} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">{s.name.length > 18 ? s.name.slice(0, 17) + '…' : s.name}</text>
            </g>
          );
        })}

        {/* Center node (label cut at 12 chars; the title keeps the full name) */}
        <g>
          <title>{`${asset.name} (${asset.relativePath})`}</title>
          <rect x={centerX - 55} y={centerY - 14} width={110} height={28} rx={6}
            fill={typeConf.color + '18'} stroke={typeConf.color} strokeWidth={1.5} />
          <circle cx={centerX - 38} cy={centerY} r={5} fill={typeConf.color} />
          <text x={centerX - 28} y={centerY + 3.5} fill="var(--text)" fontSize={11} fontWeight="600" fontFamily="monospace">
            {asset.name.length > 12 ? asset.name.slice(0, 11) + '…' : asset.name}
          </text>
        </g>

        {/* Target nodes (right) */}
        {shownTargets.map((t, i) => {
          const y = nodeY(i, rightRows);
          const conf = t.asset ? TYPE_CONFIG[t.asset.type] : TYPE_CONFIG.other;
          const edge = EDGE_STYLE[t.provenance];
          return (
            <g key={`tgt-${t.key}`}>
              <title>{`${t.name} (${t.key})`}</title>
              <line x1={centerX + 55} y1={centerY} x2={svgW - 160} y2={y}
                stroke={edge.stroke} strokeWidth={1} strokeDasharray={edge.dash} markerEnd={`url(#${markerId})`}>
                <title>{`${edge.label}: ${asset.name} ${t.relation} ${t.name}`}</title>
              </line>
              <rect x={svgW - 160} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
              <circle cx={svgW - 148} cy={y} r={4} fill={conf.color} />
              <text x={svgW - 140} y={y + 3.5} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">{t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name}</text>
            </g>
          );
        })}

        {moreSources > 0 && <MoreNode x={10} y={nodeY(shownSources.length, leftRows)} count={moreSources} />}
        {moreTargets > 0 && <MoreNode x={svgW - 160} y={nodeY(shownTargets.length, rightRows)} count={moreTargets} />}
      </svg>
      {overflow.length > 0 && (
        <ul
          data-testid="dependency-overflow"
          className="w-full max-w-[520px] max-h-40 overflow-y-auto text-2xs text-text-muted font-mono space-y-0.5 border border-border rounded-md p-2"
        >
          {overflow.map(o => (
            <li key={`${o.key}-${o.relation}-${o.text}`} className="truncate" title={`${EDGE_STYLE[o.provenance].label}: ${o.text}`}>{o.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
