'use client';
import { getModuleChecklist } from '@/lib/module-registry';

import { useState, useCallback, useEffect } from 'react';
import {
  Map, Plus, Trash2, FileText, Loader2,
  Zap, BookOpen, GitCompare, BarChart3, Layers, Grid3X3, Eye, ListChecks,
} from 'lucide-react';
import { useDesignDocument } from '@/hooks/useDesignDocument';
import { FetchError } from '../../shared/FetchError';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

import { RoadmapChecklist } from '../../shared/RoadmapChecklist';
import { FeatureMatrix } from '../../shared/FeatureMatrix';
import type { FeatureRow } from '@/types/feature-matrix';
import { ModuleHeaderDecoration } from '@/components/modules/ModuleHeaderDecoration';
import { LevelFlowEditor } from './LevelFlowEditor';
import { RoomDetailPanel } from './RoomDetailPanel';
import { SyncStatusPanel } from './SyncStatusPanel';
import { DifficultyArcChart } from './DifficultyArcChart';
import { LevelDesignSpatialDiagram } from './LevelDesignSpatialDiagram';
import { StreamingZonePlanner } from './StreamingZonePlanner';
import { ProceduralLevelWizard } from './ProceduralLevelWizard';
import {
  buildRoomCodegenPrompt,
  buildSyncCheckPrompt,
  buildReconcilePrompt,
  buildNarrativeCodegenPrompt,
  buildStreamingZonePrompt,
  buildProceduralLevelPrompt,
} from '@/lib/prompts/level-design';
import type { RoomNode, SyncDivergence, LevelDesignDocument } from '@/types/level-design';
import type { StreamingZonePlannerConfig } from './StreamingZonePlanner';
import type { ProceduralLevelConfig } from './ProceduralLevelWizard';
import { MODULE_COLORS, getAppOrigin } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';

type TabId = 'overview' | 'roadmap' | 'flow' | 'procgen' | 'narrative' | 'sync' | 'arc' | 'streaming';

export function LevelDesignView() {
  const {
    docs,
    summary,
    activeDoc,
    isLoading,
    error,
    retry,
    setActiveDocId,
    createDoc,
    updateDoc,
    deleteDoc,
  } = useDesignDocument();

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [activeTab, setActiveTab] = useState<TabId>('flow');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocName, setNewDocName] = useState('');

  const ctx = { projectName, projectPath, ueVersion };

  // ── Spatial diagram CLI session ──

  const spatialCli = useChecklistCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-spatial',
    label: 'Level Systems',
    accentColor: MODULE_COLORS.content,
  });

  // ── Document CLI sessions ──

  const codegenCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-codegen',
    label: 'Level Code Gen',
    accentColor: MODULE_COLORS.content,
    onComplete: (success) => {
      if (success && activeDoc) {
        updateDoc({
          id: activeDoc.id,
          syncStatus: 'synced',
          lastGeneratedAt: new Date().toISOString(),
        });
      }
    },
  });

  const syncCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-sync',
    label: 'Level Sync Check',
    accentColor: MODULE_COLORS.content,
  });

  // ── Streaming zone CLI session ──

  const streamingCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-streaming',
    label: 'Streaming Gen',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerateStreaming = useCallback((config: StreamingZonePlannerConfig) => {
    const prompt = buildStreamingZonePrompt(config, { projectName, projectPath, ueVersion });
    streamingCli.sendPrompt(prompt);
  }, [streamingCli, projectName, projectPath, ueVersion]);

  // ── Procedural generation CLI session ──

  const procgenCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-procgen',
    label: 'Procedural Gen',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerateProcgen = useCallback((config: ProceduralLevelConfig) => {
    const prompt = buildProceduralLevelPrompt(config, { projectName, projectPath, ueVersion });
    procgenCli.sendPrompt(prompt);
  }, [procgenCli, projectName, projectPath, ueVersion]);

  // ── Review/Checklist inline CLI sessions ──

  const MODULE_ID = 'level-design' as const;
  const MODULE_LABEL = 'Level Design';

  const [rvLastCompletedId, setRvLastCompletedId] = useState<string | null>(null);
  const [rvToast, setRvToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [rvRefetch, setRvRefetch] = useState(0);

  useEffect(() => {
    if (!rvToast) return;
    const t = setTimeout(() => setRvToast(null), 3000);
    return () => clearTimeout(t);
  }, [rvToast]);

  const handleRvItemCompleted = useCallback((itemId: string) => {
    setRvLastCompletedId(itemId);
    setTimeout(() => setRvLastCompletedId(null), 2000);
  }, []);

  const rvChecklistCli = useChecklistCLI({
    moduleId: MODULE_ID,
    sessionKey: `${MODULE_ID}-rv-cli`,
    label: MODULE_LABEL,
    accentColor: MODULE_COLORS.content,
    onItemCompleted: handleRvItemCompleted,
  });

  const handleRvReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: MODULE_ID, projectPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }));
        setRvToast({ message: err.error ?? `Import failed (${res.status})`, type: 'error' });
        return;
      }
      const data = await res.json();
      setRvToast({ message: `Imported ${data.imported} features`, type: 'success' });
    } catch (err) {
      setRvToast({ message: err instanceof Error ? err.message : 'Failed to import review results', type: 'error' });
      return;
    }
    setRvRefetch((n) => n + 1);
  }, [projectPath]);

  const rvReviewCli = useModuleCLI({
    moduleId: MODULE_ID,
    sessionKey: `${MODULE_ID}-rv-review`,
    label: `${MODULE_LABEL} Review`,
    accentColor: MODULE_COLORS.content,
    onComplete: handleRvReviewComplete,
  });

  const rvFixCli = useModuleCLI({
    moduleId: MODULE_ID,
    sessionKey: `${MODULE_ID}-rv-fix`,
    label: `${MODULE_LABEL} Fix`,
    accentColor: MODULE_COLORS.content,
  });

  const handleRvFix = useCallback((feature: FeatureRow) => {
    if (!feature.nextSteps) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureFix(MODULE_ID, feature, `${MODULE_LABEL} Fix`, appOrigin);
    rvFixCli.execute(task);
  }, [rvFixCli]);

  const handleRvSync = useCallback(async () => {
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: MODULE_ID, projectPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Sync failed' }));
        setRvToast({ message: err.error ?? `Sync failed (${res.status})`, type: 'error' });
        return;
      }
      const data = await res.json();
      setRvToast({ message: `Imported ${data.imported} features`, type: 'success' });
    } catch (err) {
      setRvToast({ message: err instanceof Error ? err.message : 'Failed to sync', type: 'error' });
    }
  }, [projectPath]);

  const startRvReview = useCallback(() => {
    const defs = MODULE_FEATURE_DEFINITIONS[MODULE_ID] ?? [];
    if (defs.length === 0) return;
    const appOrigin = getAppOrigin();
    const task = TaskFactory.featureReview(MODULE_ID, MODULE_LABEL, defs, appOrigin, `${MODULE_LABEL} Review`);
    rvReviewCli.execute(task);
  }, [rvReviewCli]);

  const rvChecklist = getModuleChecklist(MODULE_ID);

  // ── Handlers ──

  const handleCreateDoc = useCallback(async () => {
    if (!newDocName.trim()) return;
    setIsCreating(true);
    await createDoc({ name: newDocName.trim(), description: '' });
    setNewDocName('');
    setIsCreating(false);
  }, [newDocName, createDoc]);

  const handleUpdateRooms = useCallback((rooms: RoomNode[]) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, rooms, syncStatus: activeDoc.syncStatus === 'synced' ? 'doc-ahead' : activeDoc.syncStatus });
  }, [activeDoc, updateDoc]);

  const handleUpdateConnections = useCallback((connections: LevelDesignDocument['connections']) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, connections });
  }, [activeDoc, updateDoc]);

  const handleRoomUpdate = useCallback((updatedRoom: RoomNode) => {
    if (!activeDoc) return;
    const rooms = activeDoc.rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r));
    updateDoc({ id: activeDoc.id, rooms, syncStatus: activeDoc.syncStatus === 'synced' ? 'doc-ahead' : activeDoc.syncStatus });
  }, [activeDoc, updateDoc]);

  const handleGenerateRoomCode = useCallback((room: RoomNode) => {
    if (!activeDoc) return;
    const prompt = buildRoomCodegenPrompt(room, activeDoc, ctx);
    codegenCli.sendPrompt(prompt);
  }, [activeDoc, ctx, codegenCli]);

  const handleGenerateAllCode = useCallback(() => {
    if (!activeDoc) return;
    const prompt = buildNarrativeCodegenPrompt(activeDoc, ctx);
    codegenCli.sendPrompt(prompt);
  }, [activeDoc, ctx, codegenCli]);

  const handleCheckSync = useCallback(() => {
    if (!activeDoc) return;
    const prompt = buildSyncCheckPrompt(activeDoc, ctx);
    syncCli.sendPrompt(prompt);
  }, [activeDoc, ctx, syncCli]);

  const handleReconcile = useCallback((divergence: SyncDivergence) => {
    if (!activeDoc) return;
    const prompt = buildReconcilePrompt(divergence, activeDoc, ctx);
    codegenCli.sendPrompt(prompt);
  }, [activeDoc, ctx, codegenCli]);

  const handleNarrativeChange = useCallback((designNarrative: string) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, designNarrative });
  }, [activeDoc, updateDoc]);

  const handlePacingNotesChange = useCallback((pacingNotes: string) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, pacingNotes });
  }, [activeDoc, updateDoc]);

  const handleDescriptionChange = useCallback((description: string) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, description });
  }, [activeDoc, updateDoc]);

  const selectedRoom = activeDoc?.rooms.find((r) => r.id === selectedRoomId) ?? null;
  const isAnyRunning = codegenCli.isRunning || syncCli.isRunning;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={retry} />;
  }

  return (
    <div className="flex h-full relative">
      {/* Toast notification */}
      {rvToast && (
        <div
          className={`absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium shadow-lg border animate-in fade-in slide-in-from-bottom-2 ${
            rvToast.type === 'success'
              ? 'bg-surface border-green-500/30 text-green-400'
              : 'bg-surface border-status-red-strong text-red-400'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: rvToast.type === 'success' ? STATUS_SUCCESS : STATUS_ERROR }}
          />
          {rvToast.message}
        </div>
      )}

      {/* Left sidebar — Document list */}
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
                    <SyncDot status={doc.syncStatus} />
                  </div>
                </button>
              );
            })}
          </div>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDoc ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold text-text truncate">{activeDoc.name}</h1>
                <p className="text-xs text-text-muted mt-0.5">
                  {activeDoc.rooms.length} rooms &middot; {activeDoc.connections.length} connections
                </p>
              </div>

              <button
                onClick={handleGenerateAllCode}
                disabled={isAnyRunning || activeDoc.rooms.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${MODULE_COLORS.content}15`,
                  color: MODULE_COLORS.content,
                  border: `1px solid ${MODULE_COLORS.content}30`,
                }}
              >
                {codegenCli.isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                {codegenCli.isRunning ? 'Generating...' : 'Generate All Code'}
              </button>

              <button
                onClick={() => deleteDoc(activeDoc.id)}
                className="px-2 py-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
                title="Delete document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 border-b border-border">
              <TabButton label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accent={MODULE_COLORS.content} />
              <TabButton label="Roadmap" icon={ListChecks} active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accent={MODULE_COLORS.content} />
              <TabButton label="Flow Editor" icon={Map} active={activeTab === 'flow'} onClick={() => setActiveTab('flow')} accent={MODULE_COLORS.content} />
              <TabButton label="Procgen" icon={Grid3X3} active={activeTab === 'procgen'} onClick={() => setActiveTab('procgen')} accent={MODULE_COLORS.content} />
              <TabButton label="Streaming" icon={Layers} active={activeTab === 'streaming'} onClick={() => setActiveTab('streaming')} accent={MODULE_COLORS.content} />
              <TabButton label="Narrative" icon={BookOpen} active={activeTab === 'narrative'} onClick={() => setActiveTab('narrative')} accent={MODULE_COLORS.content} />
              <TabButton label="Sync" icon={GitCompare} active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} accent={MODULE_COLORS.content} />
              <TabButton label="Difficulty" icon={BarChart3} active={activeTab === 'arc'} onClick={() => setActiveTab('arc')} accent={MODULE_COLORS.content} />
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'overview' && (
                <div className="overflow-y-auto p-5">
                  <FeatureMatrix
                    key={rvRefetch}
                    moduleId={MODULE_ID}
                    accentColor={MODULE_COLORS.content}
                    onReview={startRvReview}
                    onSync={handleRvSync}
                    isReviewing={rvReviewCli.isRunning}
                    onFix={handleRvFix}
                    isFixing={rvFixCli.isRunning}
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
                    />
                  </div>

                  {/* Room detail sidebar */}
                  {selectedRoom && (
                    <div className="w-72 border-l border-border bg-surface-deep flex-shrink-0 overflow-y-auto">
                      <RoomDetailPanel
                        room={selectedRoom}
                        onUpdate={handleRoomUpdate}
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
                      <div className="grid grid-cols-4 gap-2">
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
          </>
        ) : (
          /* Empty state — Spatial diagram + doc creation */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
            <div className="w-full max-w-lg space-y-8">
              {/* Spatial Diagram */}
              <LevelDesignSpatialDiagram
                onRunPrompt={spatialCli.sendPrompt}
                isRunning={spatialCli.isRunning}
                activeItemId={spatialCli.activeItemId}
              />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-2xs text-text-muted uppercase tracking-widest">or generate procedurally</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Procedural Level Wizard */}
              <ProceduralLevelWizard
                onGenerate={handleGenerateProcgen}
                isGenerating={procgenCli.isRunning}
              />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-2xs text-text-muted uppercase tracking-widest">or start a design doc</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Doc creation */}
              <div className="text-center space-y-2.5">
                <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                  Create level designs in natural language with a visual flow editor and bidirectional C++ code sync.
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); }}
                    placeholder="My first level..."
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
                    Create Doc
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  accent,
}: {
  label: string;
  icon: typeof Map;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accent }}
        />
      )}
    </button>
  );
}

function SyncDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    synced: STATUS_SUCCESS,
    'doc-ahead': STATUS_WARNING,
    'code-ahead': STATUS_INFO,
    diverged: STATUS_ERROR,
    unlinked: 'var(--text-muted)',
  };
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block"
      style={{ backgroundColor: colors[status] ?? 'var(--text-muted)' }}
    />
  );
}

function countRoomTypes(rooms: RoomNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const room of rooms) {
    counts[room.type] = (counts[room.type] ?? 0) + 1;
  }
  return counts;
}
