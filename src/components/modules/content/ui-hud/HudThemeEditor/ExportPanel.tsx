'use client';

import { Download, Copy, Check } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

export function ExportPanel({
  exportConfig,
  copied,
  handleCopy,
  handleDownload,
}: {
  exportConfig: string;
  copied: boolean;
  handleCopy: () => void;
  handleDownload: () => void;
}) {
  return (
    <SurfaceCard level={2} className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-text-muted uppercase">
          UE5 UMG Configuration
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-2xs font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
            ) : (
              <Copy className="w-3 h-3 text-text-muted" />
            )}
            <span className="text-text-muted">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 text-2xs font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title="Download .h file"
          >
            <Download className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">.h</span>
          </button>
        </div>
      </div>

      <div className="relative rounded-md bg-black/50 border border-border/40 overflow-hidden">
        <pre className="p-3 text-xs font-mono text-text-muted leading-relaxed overflow-auto max-h-[400px] whitespace-pre">
          {exportConfig}
        </pre>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
          <div className="text-xs font-bold text-text">20+</div>
          <div className="text-2xs text-text-muted">UPROPERTYs</div>
        </div>
        <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
          <div className="text-xs font-bold text-text">4</div>
          <div className="text-2xs text-text-muted">Widget Classes</div>
        </div>
        <div className="p-2 rounded-md bg-black/30 border border-border/40 text-center">
          <div className="text-xs font-bold text-text">5</div>
          <div className="text-2xs text-text-muted">Elements</div>
        </div>
      </div>
    </SurfaceCard>
  );
}
