import { Plug } from 'lucide-react';
import type { BridgeManifestSummary } from './types';

export function BridgeManifestCard({ summary, className = '' }: { summary: BridgeManifestSummary; className?: string }) {
  return (
    <div className={`rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
          <Plug className="w-3 h-3" />
          Bridge Manifest
        </h4>
        <span className="text-2xs text-text-muted font-mono">{summary.checksum}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {([
          ['Blueprints', summary.blueprints],
          ['Materials', summary.materials],
          ['Animations', summary.animations],
          ['DataTables', summary.dataTables],
          ['Other', summary.other],
        ] as const).map(([label, count]) => (
          <div key={label} className="text-center">
            <div className="text-sm font-bold text-text">{count}</div>
            <div className="text-2xs text-text-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="text-2xs text-text-muted">
        {summary.total} total assets · Last updated {new Date(summary.generatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
