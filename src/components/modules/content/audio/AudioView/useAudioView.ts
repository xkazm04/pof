'use client';
import { getModuleChecklist } from '@/lib/module-registry';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAudioScene } from '@/hooks/useAudioScene';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useModuleReviewCli } from '@/hooks/useModuleReviewCli';
import { useProjectStore } from '@/stores/projectStore';
import {
  buildAudioSystemPrompt,
  buildZoneCodegenPrompt,
  buildSoundscapeNarrativePrompt,
} from '@/lib/prompts/audio-scene';
import { buildAudioEventPrompt } from '@/lib/prompts/audio-events';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import type { AudioEventCatalogConfig } from '@/components/modules/content/audio/AudioEventCatalog';
import { MODULE_COLORS } from '@/lib/constants';
import type { TabId } from './types';

export function useAudioView() {
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
    commitDoc,
    deleteDoc,
    refetch,
  } = useAudioScene();

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [activeTab, setActiveTab] = useState<TabId>('painter');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedEmitterId, setSelectedEmitterId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocName, setNewDocName] = useState('');

  const ctx = useMemo(
    () => ({ projectName, projectPath, ueVersion }),
    [projectName, projectPath, ueVersion]
  );

  // ── Pipeline CLI session ──

  const pipelineCli = useChecklistCLI({
    moduleId: 'audio',
    sessionKey: 'audio-pipeline',
    label: 'Audio Pipeline',
    accentColor: MODULE_COLORS.content,
  });

  // ── Scene CLI session ──

  const audioCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-codegen',
    label: 'Audio Code Gen',
    accentColor: MODULE_COLORS.content,
    onComplete: (success) => {
      if (success && activeDoc) {
        updateDoc({
          id: activeDoc.id,
          lastGeneratedAt: new Date().toISOString(),
        });
      }
    },
  });

  // ── Event catalog CLI session ──

  const eventCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-events',
    label: 'Audio Events Gen',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerateEvents = useCallback((config: AudioEventCatalogConfig) => {
    const prompt = buildAudioEventPrompt(config, { projectName, projectPath, ueVersion });
    eventCli.sendPrompt(prompt);
  }, [eventCli, projectName, projectPath, ueVersion]);

  // ── Review/Checklist CLI sessions (shared harness) ──

  const AUD_MODULE_ID = 'audio' as const;
  const AUD_MODULE_LABEL = 'Audio';

  // Toast presentation stays inline (JSX toast + auto-dismiss) — the shared hook
  // only decides the message; this view owns how it's rendered.
  const [rvToast, setRvToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!rvToast) return;
    const t = setTimeout(() => setRvToast(null), 3000);
    return () => clearTimeout(t);
  }, [rvToast]);

  const handleRvToast = useCallback((message: string, type: 'success' | 'error') => {
    setRvToast({ message, type });
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
    moduleId: AUD_MODULE_ID,
    moduleLabel: AUD_MODULE_LABEL,
    accentColor: MODULE_COLORS.content,
    onToast: handleRvToast,
  });

  const rvChecklist = getModuleChecklist(AUD_MODULE_ID);

  // ── Handlers ──

  const handleCreateDoc = useCallback(async () => {
    if (!newDocName.trim()) return;
    setIsCreating(true);
    await createDoc({ name: newDocName.trim() });
    setNewDocName('');
    setIsCreating(false);
  }, [newDocName, createDoc]);

  // ── Commit helpers ──
  // These all use the THROWING `commitDoc`: their callers (the painter's gesture
  // buffer, the debounced text fields) hold the user's edit locally and must learn
  // that a write failed so they can keep it and offer a retry. `updateDoc` swallows
  // failures and is reserved for fire-and-forget bookkeeping (e.g. lastGeneratedAt).

  /** One write for a whole painter gesture — zones and emitters together. */
  const commitScene = useCallback(async (next: { zones: AudioZone[]; emitters: SoundEmitter[] }) => {
    if (!activeDoc) return;
    await commitDoc({ id: activeDoc.id, zones: next.zones, emitters: next.emitters });
  }, [activeDoc, commitDoc]);

  const commitZones = useCallback(async (zones: AudioZone[]) => {
    if (!activeDoc) return;
    await commitDoc({ id: activeDoc.id, zones });
  }, [activeDoc, commitDoc]);

  const commitEmitters = useCallback(async (emitters: SoundEmitter[]) => {
    if (!activeDoc) return;
    await commitDoc({ id: activeDoc.id, emitters });
  }, [activeDoc, commitDoc]);

  const handleZoneUpdate = useCallback((updatedZone: AudioZone) => {
    if (!activeDoc) return;
    const zones = activeDoc.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z));
    updateDoc({ id: activeDoc.id, zones });
  }, [activeDoc, updateDoc]);

  const handleEmitterUpdate = useCallback((updatedEmitter: SoundEmitter) => {
    if (!activeDoc) return;
    const emitters = activeDoc.emitters.map((e) => (e.id === updatedEmitter.id ? updatedEmitter : e));
    updateDoc({ id: activeDoc.id, emitters });
  }, [activeDoc, updateDoc]);

  const handleGenerateAll = useCallback(() => {
    if (!activeDoc) return;
    const prompt = buildAudioSystemPrompt(activeDoc, ctx);
    audioCli.sendPrompt(prompt);
  }, [activeDoc, ctx, audioCli]);

  const handleGenerateZoneCode = useCallback((zone: AudioZone) => {
    if (!activeDoc) return;
    const prompt = buildZoneCodegenPrompt(zone, activeDoc, ctx);
    audioCli.sendPrompt(prompt);
  }, [activeDoc, ctx, audioCli]);

  const handleGenerateSoundscape = useCallback((zone: AudioZone) => {
    const prompt = buildSoundscapeNarrativePrompt(zone, ctx);
    audioCli.sendPrompt(prompt);
  }, [ctx, audioCli]);

  const commitDescription = useCallback(async (description: string) => {
    if (!activeDoc) return;
    await commitDoc({ id: activeDoc.id, description });
  }, [activeDoc, commitDoc]);

  const commitSetting = useCallback(async (
    key: 'soundPoolSize' | 'maxConcurrentSounds' | 'globalReverbPreset',
    value: unknown,
  ) => {
    if (!activeDoc) return;
    await commitDoc({ id: activeDoc.id, [key]: value });
  }, [activeDoc, commitDoc]);

  const selectedZone = activeDoc?.zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedEmitter = activeDoc?.emitters.find((e) => e.id === selectedEmitterId) ?? null;

  return {
    docs,
    summary,
    activeDoc,
    isLoading,
    error,
    retry,
    setActiveDocId,
    updateDoc,
    deleteDoc,
    refetch,
    activeTab,
    setActiveTab,
    selectedZoneId,
    setSelectedZoneId,
    selectedEmitterId,
    setSelectedEmitterId,
    isCreating,
    newDocName,
    setNewDocName,
    pipelineCli,
    audioCli,
    eventCli,
    handleGenerateEvents,
    rvToast,
    rvRefetch,
    rvLastCompletedId,
    rvChecklistCli,
    isReviewing,
    isFixing,
    startRvReview,
    handleRvFix,
    handleRvSync,
    rvChecklist,
    AUD_MODULE_ID,
    handleCreateDoc,
    commitScene,
    commitZones,
    commitEmitters,
    handleZoneUpdate,
    handleEmitterUpdate,
    handleGenerateAll,
    handleGenerateZoneCode,
    handleGenerateSoundscape,
    commitDescription,
    commitSetting,
    selectedZone,
    selectedEmitter,
  };
}
