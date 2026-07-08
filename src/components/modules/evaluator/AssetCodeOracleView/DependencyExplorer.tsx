'use client';

import { useState, useMemo } from 'react';
import { Link2, FileCode, Box, Package } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { STATUS_ERROR, statusBg } from '@/lib/chart-colors';

// ── Dependency Explorer ────────────────────────────────────────────────────

export function DependencyExplorer({
  nodes,
  edges,
}: {
  nodes: { name: string; type: string; inDegree: number; outDegree: number }[];
  edges: { from: string; to: string; relation: string }[];
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const types = useMemo(() => {
    const set = new Set(nodes.map((n) => n.type));
    return ['all', ...Array.from(set).sort()];
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const list = typeFilter === 'all' ? nodes : nodes.filter((n) => n.type === typeFilter);
    // Sort by total connections descending
    return list.sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree));
  }, [nodes, typeFilter]);

  const selectedEdges = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    return {
      incoming: edges.filter((e) => e.to === selectedNode),
      outgoing: edges.filter((e) => e.from === selectedNode),
    };
  }, [edges, selectedNode]);

  const TYPE_ICONS: Record<string, typeof Box> = {
    mesh: Box,
    texture: Package,
    material: Package,
    blueprint: FileCode,
    class: FileCode,
  };

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3" style={{ minHeight: 300 }}>
      {/* Node list */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors border ${
                typeFilter === t
                  ? 'bg-surface-hover text-text border-border-bright'
                  : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
              }`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-0.5 rounded-lg border border-border bg-surface-deep p-1">
          {filteredNodes.slice(0, 100).map((node) => {
            const isSelected = selectedNode === node.name;
            const NodeIcon = TYPE_ICONS[node.type] ?? Link2;
            return (
              <button
                key={node.name}
                onClick={() => setSelectedNode(isSelected ? null : node.name)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                  isSelected ? 'text-text' : 'hover:bg-surface-hover text-text-muted-hover'
                }`}
                style={isSelected ? { backgroundColor: statusBg(STATUS_ERROR) } : undefined}
              >
                <NodeIcon className="w-3 h-3 flex-shrink-0 text-text-muted" />
                <span className="flex-1 truncate font-mono text-2xs">{node.name}</span>
                <span className="text-2xs text-text-muted tabular-nums flex-shrink-0">
                  {node.inDegree}↓ {node.outDegree}↑
                </span>
              </button>
            );
          })}
          {filteredNodes.length > 100 && (
            <p className="text-2xs text-text-muted text-center py-1">
              Showing 100 of {filteredNodes.length}
            </p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3 overflow-y-auto">
        {selectedNode ? (
          <>
            <div>
              <h4 className="text-xs font-semibold text-text truncate">{selectedNode}</h4>
              <p className="text-2xs text-text-muted mt-0.5">
                {nodes.find((n) => n.name === selectedNode)?.type ?? 'unknown'}
              </p>
            </div>

            {selectedEdges.incoming.length > 0 && (
              <div>
                <h5 className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                  Referenced by ({selectedEdges.incoming.length})
                </h5>
                <div className="space-y-0.5">
                  {selectedEdges.incoming.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNode(e.from)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-2xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className="text-[#4ade80]">←</span>
                      <span className="text-text-muted-hover truncate flex-1 font-mono">{e.from}</span>
                      <Badge>{e.relation}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedEdges.outgoing.length > 0 && (
              <div>
                <h5 className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                  References ({selectedEdges.outgoing.length})
                </h5>
                <div className="space-y-0.5">
                  {selectedEdges.outgoing.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNode(e.to)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-2xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className="text-[#60a5fa]">→</span>
                      <span className="text-text-muted-hover truncate flex-1 font-mono">{e.to}</span>
                      <Badge>{e.relation}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedEdges.incoming.length === 0 && selectedEdges.outgoing.length === 0 && (
              <p className="text-2xs text-text-muted">No dependency connections found.</p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-2xs text-text-muted text-center">
              Select a node to explore its<br />dependency connections
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
