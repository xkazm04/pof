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
import {
  buildRoomCodegenPrompt,
  buildSyncCheckPrompt,
  buildReconcilePrompt,
  buildNarrativeCodegenPrompt,
  buildStreamingZonePrompt,
  buildProceduralLevelPrompt,
} from '@/lib/prompts/level-design';
import type { RoomNode, SyncDivergence, LevelDesignDocument } from '@/types/level-design';
import type { StreamingZonePlannerConfig } from '../StreamingZonePlanner';
import type { ProceduralLevelConfig } from '../ProceduralLevelWizard';
import { MODULE_COLORS, getAppOrigin } from '@/lib/constants';
import type { TabId } from './types';

export function useLevelDesignView() {
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

  // ── Dungeon (UE): drive the real ARPGLevelGenerator via build_procgen_dungeon.py ──

  const dungeonCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-procgen-ue',
    label: 'Dungeon (UE)',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerateDungeon = useCallback((roomCount: number, seed: number) => {
    dungeonCli.execute(
      TaskFactory.procgenDungeon('level-design', { roomCount, seed }, getAppOrigin(), 'Dungeon (UE)'),
    );
  }, [dungeonCli]);

  const scatterCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-scatter-ue',
    label: 'Scatter (UE)',
    accentColor: MODULE_COLORS.content,
  });

  const handleScatter = useCallback((density: number, seed: number) => {
    scatterCli.execute(
      TaskFactory.scatterBiome('level-design', { density, seed }, getAppOrigin(), 'Scatter (UE)'),
    );
  }, [scatterCli]);

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
    setActiveDocId,
    deleteDoc,
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
    handleNarrativeChange,
    handlePacingNotesChange,
    handleDescriptionChange,
    selectedRoom,
    isAnyRunning,
    pacingLint,
  };
}

export type LevelDesignVM = ReturnType<typeof useLevelDesignView>;
