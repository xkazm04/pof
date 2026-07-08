'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import type { ScanFinding } from '@/types/scan';

export function ResolvedSection({ findings }: { findings: ScanFinding[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <CheckCircle className="w-3 h-3 text-green-400" />
        {findings.length} resolved finding{findings.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden opacity-60">
          {findings.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 last:border-b-0">
              <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
              <span className="text-xs text-text-muted line-through">{f.category}: {f.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
