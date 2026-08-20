'use client';
import { getModuleChecklist } from '@/lib/module-registry';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useDesignDocument } from '@/hooks/useDesignDocument';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useModuleReviewCli } from '@/hooks/useModuleReviewCli';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { lintLevelPacing } from '@/lib/level-design/pacing-linter';
import { adoptCodeValue } from '@/lib/level-design/reconcile';
import {
  buildRoomCodegenPrompt,
  buildReconcilePrompt,
  buildNarrativeCodegenPrompt,
  buildStreamingZonePrompt,
  buildProceduralLevelPrompt,
} from '@/lib/prompts/level-design';
import type { RoomNode, SyncDivergence, LevelDesignDocument } from '@/types/level-design';
import type { StreamingZonePlannerConfig } from '../StreamingZonePlanner';
import type { ProceduralLevelConfig } from '../ProceduralLevelWizard';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { MODULE_COLORS, getAppOrigin } from '@/lib/constants';
import type { TabId } from './types';
import type { EditCommitMode } from '@/hooks/useEntityCommitBuffer';
import { useDocCommitBuffer, type CommitOptions, type DocPatch } from './useDocCommitBuffer';

export function useLevelDesignView() {
  const {
    docs,
    summary,
    activeDoc: serverDoc,
    isLoading,
    error,
    retry,
    setActiveDocId,
    createDoc,
    updateDoc,
    deleteDoc,
    refetch,
  } = useDesignDocument();

  // Every edit below goes through the buffer: local immediately, written on a
  // real commit boundary. `activeDoc` is the buffered view, so the whole tree
  // renders the user's latest keystroke/drag frame without waiting on a PUT.
  const buffer = useDocCommitBuffer({ baseDoc: serverDoc, updateDoc });
  const {
    doc: activeDoc,
    stage,
    stageDebounced,
    commit,
    flush: flushDoc,
    retry: retrySave,
    dismissError: dismissSaveError,
    saveError,
    isSaving,
    isDirty,
  } = buffer;

  const applyEdit = useCallback((patch: DocPatch, mode: EditCommitMode = 'commit', opts?: CommitOptions) => {
    if (mode === 'stage') stage(patch, opts);
    else if (mode === 'debounce') stageDebounced(patch, opts);
    else commit(patch, opts);
  }, [stage, stageDebounced, commit]);

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [activeTab, setActiveTab] = useState<TabId>('flow');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocName, setNewDocName] = useState('');

  const ctx = useMemo(() => ({ projectName, projectPath, ueVersion }), [projectName, projectPath, ueVersion]);

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
        // An explicit syncStatus wins over the buffer's doc-ahead escalation.
        commit({ syncStatus: 'synced', lastGeneratedAt: new Date().toISOString() });
      }
    },
  });

  // The sync run writes its verdict SERVER-side (the task callback POSTs to
  // /api/level-design/sync-result, which is the only validated writer of
  // syncReport/lastCodeHash). So completion re-reads the document rather than
  // guessing a status here — a rejected report leaves the old verdict standing,
  // which is exactly what should happen.
  const syncCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-sync',
    label: 'Level Sync Check',
    accentColor: MODULE_COLORS.content,
    onComplete: () => { void refetch(); },
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

  // The wizard publishes its settled ProcgenSpec here so the UE dungeon tab can
  // adopt it. Held at the view level because the two panels are sibling tabs;
  // null until the wizard tab has been opened at least once, which is why the
  // dungeon tab must render perfectly well without it.
  const [procgenSpec, setProcgenSpec] = useState<ProcgenSpec | null>(null);

  const handleGenerateProcgen = useCallback((config: ProceduralLevelConfig) => {
    const prompt = buildProceduralLevelPrompt(config, { projectName, projectPath, ueVersion });
    procgenCli.sendPrompt(prompt);
  }, [procgenCli, projectName, projectPath, ueVersion]);

  // ── Dungeon (UE): drive the real ARPGLevelGenerator via build_procgen_dungeon.py ──

  const dungeonCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-procgen-ue',
    label: 'Dungeon (UE)',
    accentColor: MODULE_COLORS.content,
  });

  // The open document rides along so the run is a row LINKED to the design it
  // was generated for, not an anonymous entry in a global ledger.
  const handleGenerateDungeon = useCallback((roomCount: number, seed: number) => {
    dungeonCli.execute(
      TaskFactory.procgenDungeon(
        'level-design',
        { roomCount, seed, docId: activeDoc?.id ?? null },
        getAppOrigin(),
        'Dungeon (UE)',
      ),
    );
  }, [dungeonCli, activeDoc]);

  const scatterCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-scatter-ue',
    label: 'Scatter (UE)',
    accentColor: MODULE_COLORS.content,
  });

  const handleScatter = useCallback((density: number, seed: number) => {
    scatterCli.execute(
      TaskFactory.scatterBiome(
        'level-design',
        { density, seed, docId: activeDoc?.id ?? null },
        getAppOrigin(),
        'Scatter (UE)',
      ),
    );
  }, [scatterCli, activeDoc]);

  // ── Review/Checklist CLI sessions (shared harness) ──

  const MODULE_ID = 'level-design' as const;
  const MODULE_LABEL = 'Level Design';

  // Toast presentation stays per-view (sonner) — the shared hook only decides
  // the message; this view routes it to the global sonner toaster.
  const handleRvToast = useCallback((message: string, type: 'success' | 'error') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  }, []);

  const {
    refetchKey: rvRefetch,
    lastCompletedId: rvLastCompletedId,
    checklistCli: rvChecklistCli,
    isReviewing,
    isFixing,
    startReview: startRvReview,
    handleFix: handleRvFix,
    handleSync: handleRvSync,
  } = useModuleReviewCli({
    moduleId: MODULE_ID,
    moduleLabel: MODULE_LABEL,
    accentColor: MODULE_COLORS.content,
    onToast: handleRvToast,
  });

  const rvChecklist = getModuleChecklist(MODULE_ID);

  // ── Handlers ──

  const handleCreateDoc = useCallback(async () => {
    if (!newDocName.trim()) return;
    setIsCreating(true);
    const result = await createDoc({ name: newDocName.trim(), description: '' });
    setIsCreating(false);
    if (!result.ok) {
      toast.error(`Could not create the level design: ${result.error}`);
      return;
    }
    setNewDocName('');
  }, [newDocName, createDoc]);

  /** Switching documents must not abandon a buffered edit on the one being left. */
  const selectDoc = useCallback((id: number | null) => {
    flushDoc();
    setActiveDocId(id);
  }, [flushDoc, setActiveDocId]);

  const handleDeleteDoc = useCallback(async (id: number) => {
    const result = await deleteDoc(id);
    if (!result.ok) toast.error(`Could not delete the level design: ${result.error}`);
  }, [deleteDoc]);

  const handleUpdateRooms = useCallback((rooms: RoomNode[], mode?: EditCommitMode) => {
    applyEdit({ rooms }, mode, { marksDocAhead: true });
  }, [applyEdit]);

  const handleUpdateConnections = useCallback((connections: LevelDesignDocument['connections']) => {
    applyEdit({ connections });
  }, [applyEdit]);

  const handleRoomUpdate = useCallback((updatedRoom: RoomNode, mode?: EditCommitMode) => {
    if (!activeDoc) return;
    const rooms = activeDoc.rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r));
    applyEdit({ rooms }, mode, { marksDocAhead: true });
  }, [activeDoc, applyEdit]);

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
    // Write any buffered edit first: the comparison should judge the document
    // the user is looking at, not the one the server still holds.
    flushDoc();
    void syncCli.execute(
      TaskFactory.levelSync('level-design', activeDoc, getAppOrigin(), 'Level Sync Check'),
    );
  }, [activeDoc, flushDoc, syncCli]);

  /** Code adopts the doc's value — the existing reconcile codegen task. */
  const handleReconcile = useCallback((divergence: SyncDivergence) => {
    if (!activeDoc) return;
    const prompt = buildReconcilePrompt(divergence, activeDoc, ctx);
    codegenCli.sendPrompt(prompt);
  }, [activeDoc, ctx, codegenCli]);

  /**
   * Doc adopts the code's value — a local document edit, no CLI run. Refused
   * with a reason when the reported field is not one the document actually has
   * (the sync report's `field` is LLM free text, so guessing would silently
   * rewrite a designer's level).
   */
  const handleAdoptCode = useCallback((divergence: SyncDivergence) => {
    if (!activeDoc) return;
    const result = adoptCodeValue(activeDoc, divergence);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    commit(result.data);
    toast.success(`${divergence.roomName}: ${divergence.field} now matches the code.`);
  }, [activeDoc, commit]);

  // Free-text fields: applied locally on every keystroke (so the textarea is never
  // a round trip behind the cursor) and written once the typing pauses.
  const handleNarrativeChange = useCallback((designNarrative: string) => {
    stageDebounced({ designNarrative });
  }, [stageDebounced]);

  const handlePacingNotesChange = useCallback((pacingNotes: string) => {
    stageDebounced({ pacingNotes });
  }, [stageDebounced]);

  const handleDescriptionChange = useCallback((description: string) => {
    stageDebounced({ description });
  }, [stageDebounced]);

  const selectedRoom = activeDoc?.rooms.find((r) => r.id === selectedRoomId) ?? null;
  const isAnyRunning = codegenCli.isRunning || syncCli.isRunning;

  const pacingLint = useMemo(
    () => (activeDoc ? lintLevelPacing(activeDoc) : null),
    [activeDoc],
  );

  return {
    docs,
    summary,
    activeDoc,
    isLoading,
    error,
    retry,
    setActiveDocId: selectDoc,
    deleteDoc: handleDeleteDoc,
    // Buffer surface — a failed save stays on screen and stays retryable.
    saveError,
    retrySave,
    dismissSaveError,
    isSaving,
    isDirty,
    flushDoc,
    activeTab,
    setActiveTab,
    selectedRoomId,
    setSelectedRoomId,
    isCreating,
    newDocName,
    setNewDocName,
    spatialCli,
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
    procgenSpec,
    setProcgenSpec,
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
    handleCreateDoc,
    handleUpdateRooms,
    handleUpdateConnections,
    handleRoomUpdate,
    handleGenerateRoomCode,
    handleGenerateAllCode,
    handleCheckSync,
    handleReconcile,
    handleAdoptCode,
    handleNarrativeChange,
    handlePacingNotesChange,
    handleDescriptionChange,
    selectedRoom,
    isAnyRunning,
    pacingLint,
  };
}

export type LevelDesignVM = ReturnType<typeof useLevelDesignView>;
