'use client';

import { useState, useCallback } from 'react';
import { FileCode, Copy, Check, FolderOpen } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { UI_TIMEOUTS } from '@/lib/constants';

interface ProjectFilesPanelProps {
  projectPath: string;
  projectFiles: string[];
  onOpenInExplorer: () => void;
}

export function ProjectFilesPanel({ projectPath, projectFiles, onOpenInExplorer }: ProjectFilesPanelProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(text);
      setTimeout(() => setCopiedPath(null), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Clipboard API not available
    }
  }, []);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Project Files
      </h2>
      <SurfaceCard className="divide-y divide-border">
        {projectFiles.map((filePath) => (
          <div key={filePath} className="flex items-center gap-2 px-4 py-2 group">
            <FileCode className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-xs text-text font-mono truncate flex-1">
              {filePath}
            </span>
            <button
              onClick={() => copyToClipboard(filePath)}
              className="opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 p-1 text-text-muted hover:text-[#00ff88] transition-all"
              title="Copy path"
            >
              {copiedPath === filePath ? (
                <Check className="w-3.5 h-3.5 text-[#00ff88]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onOpenInExplorer}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open in Explorer
          </button>
          <button
            onClick={() => copyToClipboard(projectPath)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedPath === projectPath ? 'Copied!' : 'Copy Root Path'}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}
