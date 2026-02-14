'use client';

import { Wrench, Loader2 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

interface ToolingBootstrapPanelProps {
  missingToolCount: number;
  isRunning: boolean;
  scanning: boolean;
  onFixAllMissing: () => void;
}

export function ToolingBootstrapPanel({
  missingToolCount,
  isRunning,
  scanning,
  onFixAllMissing,
}: ToolingBootstrapPanelProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Dev Environment
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          {missingToolCount} required tool{missingToolCount > 1 ? 's are' : ' is'} missing.
          Let Claude install everything automatically using winget (Windows Package Manager),
          or manually install from the links in the sidebar.
        </p>
        <button
          onClick={onFixAllMissing}
          disabled={isRunning || scanning}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 rounded-lg text-sm hover:bg-[#3b82f6]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Installing Tools...
            </>
          ) : (
            <>
              <Wrench className="w-4 h-4" />
              Fix All Missing Tools
            </>
          )}
        </button>
      </SurfaceCard>
    </div>
  );
}
