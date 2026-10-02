'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Music, Plus, FileText, AlertTriangle } from 'lucide-react';
import { ModuleHeaderDecoration } from '@/components/modules/ModuleHeaderDecoration';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_ERROR, OPACITY_8, OPACITY_15 } from '@/lib/chart-colors';
import type { AudioSceneDocument, AudioSceneSummary } from '@/types/audio-scene';

interface SceneSidebarProps {
  summary: AudioSceneSummary;
  docs: AudioSceneDocument[];
  activeDoc: AudioSceneDocument | null;
  /** Ask the scene session to open `id` — it writes the open scene's edit first. */
  onSelectScene: (id: number) => void;
  /** Scene a switch is waiting to open (its predecessor's write is in flight or refused). */
  pendingSwitch: number | null;
  /** The held switch is blocked by a refused write; `saveError` says why. */
  switchBlocked: boolean;
  saveError: string | null;
  onRetrySwitch: () => void;
  onDiscardSwitch: () => void;
  newDocName: string;
  setNewDocName: Dispatch<SetStateAction<string>>;
  handleCreateDoc: () => void;
  isCreating: boolean;
}

export function SceneSidebar({
  summary,
  docs,
  activeDoc,
  onSelectScene,
  pendingSwitch,
  switchBlocked,
  saveError,
  onRetrySwitch,
  onDiscardSwitch,
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

      {/* A switch held by a refused write: the edit is stated, never silently lost. */}
      {switchBlocked && activeDoc && (
        <div
          role="alert"
          aria-label="Unsaved scene change"
          className="m-2 p-2 rounded-md text-2xs space-y-1.5"
          style={{
            color: STATUS_ERROR,
            backgroundColor: `${STATUS_ERROR}${OPACITY_8}`,
            border: `1px solid ${STATUS_ERROR}${OPACITY_15}`,
          }}
        >
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              {activeDoc.name} has an unsaved change the server refused{saveError ? ` (${saveError})` : ''}.
              Retry to save it, or discard it to switch.
            </span>
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={onRetrySwitch}
              className="focus-ring px-2 py-0.5 rounded font-medium hover:opacity-80"
              style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
            >
              Retry
            </button>
            <button onClick={onDiscardSwitch} className="focus-ring px-2 py-0.5 rounded font-medium hover:opacity-80">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {docs.map((doc) => {
            const isActive = activeDoc?.id === doc.id;
            const isWaiting = pendingSwitch === doc.id && !switchBlocked;
            return (
              <button
                key={doc.id}
                onClick={() => onSelectScene(doc.id)}
                aria-busy={isWaiting || undefined}
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
                    {isWaiting ? 'saving the open scene…' : `${doc.zones.length} zones · ${doc.emitters.length} emitters`}
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
