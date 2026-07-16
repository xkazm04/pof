import { TYPE_CONFIG } from './constants';
import type { DependencyGraphProps } from './types';
import type { ScannedAsset } from '@/app/api/filesystem/scan-assets/route';

export function DependencyGraph({ asset, allAssets, dependencies }: DependencyGraphProps) {
  // Edges are keyed by relativePath (unique), not basename (can collide).
  const outEdges = dependencies.filter(e => e.from === asset.relativePath);
  const inEdges = dependencies.filter(e => e.to === asset.relativePath);

  if (outEdges.length === 0 && inEdges.length === 0) {
    return (
      <div className="text-xs text-text-muted italic py-2 pl-2">
        No known dependencies
      </div>
    );
  }

  const assetMap: Record<string, ScannedAsset> = {};
  for (const a of allAssets) assetMap[a.relativePath] = a;

  // Build node list: center = this asset, left = sources (things that reference this), right = targets (things this references).
  // `key` is the unique relativePath; `name` is the display basename (falls back to the path if the asset isn't in the current list).
  const sources = inEdges.map(e => ({ key: e.from, name: assetMap[e.from]?.name ?? e.from, relation: e.relation, asset: assetMap[e.from] as ScannedAsset | undefined }));
  const targets = outEdges.map(e => ({ key: e.to, name: assetMap[e.to]?.name ?? e.to, relation: e.relation, asset: assetMap[e.to] as ScannedAsset | undefined }));

  const nodeH = 28;
  const maxNodes = Math.max(sources.length, targets.length, 1);
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
    <svg width={svgW} height={svgH} className="block">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
        </marker>
      </defs>

      {/* Source nodes (left) */}
      {sources.map((s, i) => {
        const y = nodeY(i, sources.length);
        const conf = s.asset ? TYPE_CONFIG[s.asset.type] : TYPE_CONFIG.other;
        return (
          <g key={`src-${s.key}`}>
            <line x1={160} y1={y} x2={centerX - 60} y2={centerY}
              stroke="var(--border)" strokeWidth={1} markerEnd="url(#arrowhead)" />
            <rect x={10} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
            <circle cx={22} cy={y} r={4} fill={conf.color} />
            <text x={30} y={y + 3.5} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">{s.name.length > 18 ? s.name.slice(0, 17) + '…' : s.name}</text>
          </g>
        );
      })}

      {/* Center node */}
      <rect x={centerX - 55} y={centerY - 14} width={110} height={28} rx={6}
        fill={typeConf.color + '18'} stroke={typeConf.color} strokeWidth={1.5} />
      <circle cx={centerX - 38} cy={centerY} r={5} fill={typeConf.color} />
      <text x={centerX - 28} y={centerY + 3.5} fill="var(--text)" fontSize={11} fontWeight="600" fontFamily="monospace">
        {asset.name.length > 12 ? asset.name.slice(0, 11) + '…' : asset.name}
      </text>

      {/* Target nodes (right) */}
      {targets.map((t, i) => {
        const y = nodeY(i, targets.length);
        const conf = t.asset ? TYPE_CONFIG[t.asset.type] : TYPE_CONFIG.other;
        return (
          <g key={`tgt-${t.key}`}>
            <line x1={centerX + 55} y1={centerY} x2={svgW - 160} y2={y}
              stroke="var(--border)" strokeWidth={1} markerEnd="url(#arrowhead)" />
            <rect x={svgW - 160} y={y - 12} width={150} height={24} rx={4} fill="var(--surface-deep)" stroke={conf.color + '40'} strokeWidth={1} />
            <circle cx={svgW - 148} cy={y} r={4} fill={conf.color} />
            <text x={svgW - 140} y={y + 3.5} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">{t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
