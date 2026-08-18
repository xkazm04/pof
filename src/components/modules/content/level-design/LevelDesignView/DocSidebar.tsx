'use client';
import { Map, Plus, FileText } from 'lucide-react';
import { ModuleHeaderDecoration } from '@/components/modules/ModuleHeaderDecoration';
import { MODULE_COLORS } from '@/lib/constants';
import { SyncDot } from './SyncDot';
import type { LevelDesignVM } from './useLevelDesignView';

export function DocSidebar({ vm }: { vm: LevelDesignVM }) {
  const {
    docs,
    summary,
    activeDoc,
    setActiveDocId,
    setSelectedRoomId,
    isCreating,
    newDocName,
    setNewDocName,
    handleCreateDoc,
  } = vm;

  return (
    <div className="w-52 border-r border-border bg-surface-deep flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden flex items-center gap-2 px-3 py-3 border-b border-border">
        <ModuleHeaderDecoration moduleId="level-design" variant="compact" />
        <Map className="w-3.5 h-3.5 relative" style={{ color: MODULE_COLORS.content }} />
        <h2 className="text-xs font-semibold text-text relative">Level Designs</h2>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>{summary.totalDocs} docs</span>
          <span>{summary.totalRooms} rooms</span>
        </div>
        {summary.totalDocs > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            {summary.syncedCount > 0 && (
              <span className="text-2xs text-[#4ade80]">{summary.syncedCount} synced</span>
            )}
            {summary.divergedCount > 0 && (
              <span className="text-2xs text-[#f87171]">{summary.divergedCount} diverged</span>
            )}
            {summary.unlinkedCount > 0 && (
              <span className="text-2xs text-text-muted">{summary.unlinkedCount} new</span>
            )}
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-500/20"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <line x1="10" y1="6.5" x2="14" y2="6.5" />
              <line x1="6.5" y1="10" x2="6.5" y2="14" />
            </svg>
            <span className="text-xs text-text-muted text-center">No levels yet</span>
            <span className="text-2xs text-text-muted text-center leading-relaxed">Create your first level design below</span>
          </div>
        ) : (
        <div className="p-2 space-y-0.5">
          {docs.map((doc) => {
            const isActive = activeDoc?.id === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => { setActiveDocId(doc.id); setSelectedRoomId(null); }}
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
                  <span className="text-2xs text-text-muted">{doc.rooms.length} rooms</span>
                  <SyncDot status={doc.syncStatus} lastCodeHash={doc.lastCodeHash} />
                </div>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* New doc input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); }}
            placeholder="New level design..."
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
