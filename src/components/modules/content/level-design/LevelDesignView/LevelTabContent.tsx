'use client';
import { Zap, Loader2 } from 'lucide-react';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';
import { LevelFlowEditor } from '../LevelFlowEditor';
import { RoomDetailPanel } from '../RoomDetailPanel';
import { SyncStatusPanel } from '../SyncStatusPanel';
import { DifficultyArcChart } from '../DifficultyArcChart';
import { PacingReportPanel } from '../PacingReportPanel';
import { ProceduralLevelWizard } from '../ProceduralLevelWizard';
import { ProcGenDungeonPanel } from '../ProcGenDungeonPanel';
import { BiomeScatterPanel } from '../BiomeScatterPanel';
import { StreamingZonePlanner } from '../StreamingZonePlanner';
import { MODULE_COLORS } from '@/lib/constants';
import { countRoomTypes } from './helpers';
import type { LevelDesignVM } from './useLevelDesignView';

export function LevelTabContent({ vm }: { vm: LevelDesignVM }) {
  const {
    activeDoc,
    activeTab,
    setActiveTab,
    selectedRoomId,
    setSelectedRoomId,
    selectedRoom,
    isAnyRunning,
    pacingLint,
    codegenCli,
    syncCli,
    streamingCli,
    procgenCli,
    dungeonCli,
    scatterCli,
    handleGenerateStreaming,
    handleGenerateProcgen,
    handleGenerateDungeon,
    handleScatter,
    MODULE_ID,
    rvRefetch,
    rvLastCompletedId,
    rvChecklistCli,
    isReviewing,
    isFixing,
    startRvReview,
    handleRvFix,
    handleRvSync,
    rvChecklist,
    handleUpdateRooms,
    handleUpdateConnections,
    handleRoomUpdate,
    handleGenerateRoomCode,
    handleGenerateAllCode,
    handleCheckSync,
    handleReconcile,
    handleNarrativeChange,
    handlePacingNotesChange,
    handleDescriptionChange,
    flushDoc,
  } = vm;

  if (!activeDoc) return null;

  return (
    <div className="flex-1 overflow-hidden">
      {activeTab === 'overview' && (
        <div className="overflow-y-auto p-5">
          <FeatureMatrix
            key={rvRefetch}
            moduleId={MODULE_ID}
            accentColor={MODULE_COLORS.content}
            onReview={startRvReview}
            onSync={handleRvSync}
            isReviewing={isReviewing}
            onFix={handleRvFix}
            isFixing={isFixing}
          />
        </div>
      )}

      {activeTab === 'roadmap' && (
        <div className="overflow-y-auto p-5">
          {rvChecklist.length > 0 ? (
            <RoadmapChecklist
              items={rvChecklist}
              subModuleId={MODULE_ID}
              onRunPrompt={rvChecklistCli.sendPrompt}
              accentColor={MODULE_COLORS.content}
              isRunning={rvChecklistCli.isRunning}
              activeItemId={rvChecklistCli.activeItemId}
              lastCompletedItemId={rvLastCompletedId}
            />
          ) : (
            <p className="text-sm text-text-muted">No checklist items defined for this module yet.</p>
          )}
        </div>
      )}

      {activeTab === 'flow' && (
        <div className="flex h-full">
          {/* Graph editor */}
          <div className="flex-1 min-w-0">
            <LevelFlowEditor
              rooms={activeDoc.rooms}
              connections={activeDoc.connections}
              onUpdateRooms={handleUpdateRooms}
              onUpdateConnections={handleUpdateConnections}
              onSelectRoom={setSelectedRoomId}
              selectedRoomId={selectedRoomId}
              accentColor={MODULE_COLORS.content}
              findingsByRoom={pacingLint?.byRoom}
            />
          </div>

          {/* Room detail sidebar */}
          {selectedRoom && (
            <div className="w-72 border-l border-border bg-surface-deep flex-shrink-0 overflow-y-auto">
              <RoomDetailPanel
                room={selectedRoom}
                onUpdate={handleRoomUpdate}
                onFlush={flushDoc}
                onGenerateCode={handleGenerateRoomCode}
                accentColor={MODULE_COLORS.content}
                isGenerating={codegenCli.isRunning}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'procgen' && (
        <ProceduralLevelWizard
          onGenerate={handleGenerateProcgen}
          isGenerating={procgenCli.isRunning}
        />
      )}

      {activeTab === 'dungeon-ue' && (
        <ProcGenDungeonPanel
          onGenerate={handleGenerateDungeon}
          isGenerating={dungeonCli.isRunning}
        />
      )}

      {activeTab === 'scatter-ue' && (
        <BiomeScatterPanel
          onGenerate={handleScatter}
          isGenerating={scatterCli.isRunning}
        />
      )}

      {activeTab === 'streaming' && (
        <StreamingZonePlanner
          onGenerate={handleGenerateStreaming}
          isGenerating={streamingCli.isRunning}
        />
      )}

      {activeTab === 'narrative' && (
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Description */}
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
              Level Description
            </label>
            <textarea
              value={activeDoc.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={flushDoc}
              placeholder="High-level overview of this level — setting, tone, player objectives..."
              className="w-full px-4 py-3 bg-surface-deep border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
              rows={3}
            />
          </div>

          {/* Design Narrative */}
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
              Design Narrative
            </label>
            <p className="text-xs text-text-muted mb-2">
              Write your level design in natural language. Describe rooms, encounters, pacing curves, difficulty arcs, and player flow. This narrative drives code generation.
            </p>
            <textarea
              value={activeDoc.designNarrative}
              onChange={(e) => handleNarrativeChange(e.target.value)}
              onBlur={flushDoc}
              placeholder={`Example:\n\nThe player enters through a narrow stone corridor (low difficulty, building tension). The corridor opens into a grand hall with 3 pillars — first wave: 4 skeleton warriors patrol the perimeter. After clearing them, wave 2 spawns 2 skeleton archers from the balcony above.\n\nThe east door leads to a puzzle room (rest pacing) where the player must rotate statues to unlock the boss chamber. The boss chamber features a Lich King encounter (difficulty 5) with 3 phases...`}
              className="w-full px-4 py-3 bg-surface-deep border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed font-mono"
              rows={16}
            />
          </div>

          {/* Pacing Notes */}
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
              Pacing Notes
            </label>
            <textarea
              value={activeDoc.pacingNotes}
              onChange={(e) => handlePacingNotesChange(e.target.value)}
              onBlur={flushDoc}
              placeholder="Notes on pacing: tension curve, rest areas, difficulty spikes, narrative beats..."
              className="w-full px-4 py-3 bg-surface-deep border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
              rows={4}
            />
          </div>

          {/* Generate from narrative */}
          <button
            onClick={handleGenerateAllCode}
            disabled={isAnyRunning || !activeDoc.designNarrative.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${MODULE_COLORS.content}15`,
              color: MODULE_COLORS.content,
              border: `1px solid ${MODULE_COLORS.content}30`,
            }}
          >
            {codegenCli.isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {codegenCli.isRunning ? 'Generating from narrative...' : 'Generate Code from Narrative'}
          </button>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="overflow-y-auto p-5">
          <SyncStatusPanel
            syncStatus={activeDoc.syncStatus}
            divergences={activeDoc.syncReport}
            onCheckSync={handleCheckSync}
            onReconcile={handleReconcile}
            isChecking={syncCli.isRunning}
            accentColor={MODULE_COLORS.content}
          />
        </div>
      )}

      {activeTab === 'pacing' && (
        <div className="overflow-y-auto p-5">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-text mb-1">Pacing & Difficulty Linter</h3>
            <p className="text-xs text-text-muted">
              Walks the level&apos;s difficulty arc, room types, and connections to flag pacing anti-patterns —
              consecutive combat rooms, difficulty cliffs, monotonic ramps, missing safe zones before bosses,
              and unreachable rooms.
            </p>
          </div>
          <PacingReportPanel
            doc={activeDoc}
            accentColor={MODULE_COLORS.content}
            onSelectRoom={(id) => { setSelectedRoomId(id); setActiveTab('flow'); }}
          />
        </div>
      )}

      {activeTab === 'arc' && (
        <div className="overflow-y-auto p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Difficulty Arc</h3>
            <p className="text-xs text-text-muted mb-3">
              Visualization of difficulty progression through the level. Click a point to select that room.
            </p>
            <div className="bg-surface-deep rounded-lg border border-border p-3">
              <DifficultyArcChart
                rooms={activeDoc.rooms}
                difficultyArc={activeDoc.difficultyArc}
                accentColor={MODULE_COLORS.content}
                onSelectRoom={(id) => { setSelectedRoomId(id); setActiveTab('flow'); }}
              />
            </div>
          </div>

          {/* Room type distribution */}
          {activeDoc.rooms.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text mb-3">Room Composition</h3>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(countRoomTypes(activeDoc.rooms)).map(([type, count]) => {
                  if (count === 0) return null;
                  return (
                    <div
                      key={type}
                      className="px-3 py-2 rounded-md bg-surface-deep border border-border text-center"
                    >
                      <div className="text-sm font-bold text-text">{count}</div>
                      <div className="text-2xs text-text-muted capitalize">{type}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
