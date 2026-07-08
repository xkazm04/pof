'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { AudioPipelineDiagram } from '@/components/modules/content/audio/AudioPipelineDiagram';
import { MODULE_COLORS } from '@/lib/constants';

interface EmptyStateProps {
  pipelineCli: ReturnType<typeof useChecklistCLI>;
  newDocName: string;
  setNewDocName: Dispatch<SetStateAction<string>>;
  handleCreateDoc: () => void;
  isCreating: boolean;
}

export function EmptyState({
  pipelineCli,
  newDocName,
  setNewDocName,
  handleCreateDoc,
  isCreating,
}: EmptyStateProps) {
  return (
    /* Empty state — Pipeline diagram + scene creation */
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-md space-y-8">
        {/* Pipeline Diagram */}
        <AudioPipelineDiagram
          onRunPrompt={pipelineCli.sendPrompt}
          isRunning={pipelineCli.isRunning}
          activeItemId={pipelineCli.activeItemId}
        />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-2xs text-text-muted uppercase tracking-widest">or design a scene</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Scene creation */}
        <div className="text-center space-y-2.5">
          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
            Paint audio zones on a 2D map, place emitters, and generate production-ready C++ audio systems.
          </p>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="text"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); }}
              placeholder="My dungeon audio..."
              className="px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
            />
            <button
              onClick={handleCreateDoc}
              disabled={!newDocName.trim() || isCreating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${MODULE_COLORS.content}15`,
                color: MODULE_COLORS.content,
                border: `1px solid ${MODULE_COLORS.content}30`,
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Scene
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
