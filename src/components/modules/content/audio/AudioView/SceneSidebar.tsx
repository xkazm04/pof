'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Music, Plus, FileText } from 'lucide-react';
import { ModuleHeaderDecoration } from '@/components/modules/ModuleHeaderDecoration';
import { MODULE_COLORS } from '@/lib/constants';
import type { AudioSceneDocument, AudioSceneSummary } from '@/types/audio-scene';

interface SceneSidebarProps {
  summary: AudioSceneSummary;
  docs: AudioSceneDocument[];
  activeDoc: AudioSceneDocument | null;
  setActiveDocId: (id: number | null) => void;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmitterId: Dispatch<SetStateAction<string | null>>;
  newDocName: string;
  setNewDocName: Dispatch<SetStateAction<string>>;
  handleCreateDoc: () => void;
  isCreating: boolean;
}

export function SceneSidebar({
  summary,
  docs,
  activeDoc,
  setActiveDocId,
  setSelectedZoneId,
  setSelectedEmitterId,
  newDocName,
  setNewDocName,
  handleCreateDoc,
  isCreating,
}: SceneSidebarProps) {
  return (
    <div className="w-52 border-r border-border bg-surface-deep flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden flex items-center gap-2 px-3 py-3 border-b border-border">
        <ModuleHeaderDecoration moduleId="audio" variant="compact" />
        <Music className="w-3.5 h-3.5 relative" style={{ color: MODULE_COLORS.content }} />
        <h2 className="text-xs font-semibold text-text relative">Audio Scenes</h2>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>{summary.totalScenes} scenes</span>
          <span>{summary.totalZones} zones</span>
          <span>{summary.totalEmitters} emitters</span>
        </div>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {docs.map((doc) => {
            const isActive = activeDoc?.id === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => { setActiveDocId(doc.id); setSelectedZoneId(null); setSelectedEmitterId(null); }}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors ${
                  isActive
                    ? 'bg-surface-hover text-text'
                    : 'text-text-muted-hover hover:bg-surface hover:text-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-5">
                  <span className="text-2xs text-text-muted">
                    {doc.zones.length} zones · {doc.emitters.length} emitters
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* New scene input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); }}
            placeholder="New audio scene..."
            className="flex-1 px-2.5 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors min-w-0"
          />
          <button
            onClick={handleCreateDoc}
            disabled={!newDocName.trim() || isCreating}
            className="px-2 py-2 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
            style={{
              backgroundColor: `${MODULE_COLORS.content}15`,
              color: MODULE_COLORS.content,
              border: `1px solid ${MODULE_COLORS.content}30`,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
