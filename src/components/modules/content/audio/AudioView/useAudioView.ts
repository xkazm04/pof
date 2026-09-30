'use client';
import { getModuleChecklist } from '@/lib/module-registry';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import type { AudioZone } from '@/types/audio-scene';
import type { AudioEventCatalogConfig } from '@/components/modules/content/audio/AudioEventCatalog';
import { MODULE_COLORS } from '@/lib/constants';
import type { TabId } from './types';
import { useSceneSession } from './useSceneSession';

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

  // ── The open scene's edit session ──
  // One op buffer for every tab (see useSceneSession): the painter and the
  // soundscapes write through it, and a scene switch waits for its write.

  const switchTo = useCallback((id: number) => {
    setActiveDocId(id);
    setSelectedZoneId(null);
    setSelectedEmitterId(null);
  }, [setActiveDocId]);

  const sceneSession = useSceneSession({ activeDoc, commitDoc, switchTo });
  const { settle, buffer: sceneBuffer } = sceneSession;

  // ── Scene CLI session ──

  // The scene a run was dispatched FOR. `onComplete` fires long after dispatch —
  // the user may be on another scene by then — so it stamps this, not activeDoc.
  const dispatchedSceneIdRef = useRef<number | null>(null);

  const audioCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-codegen',
    label: 'Audio Code Gen',
    accentColor: MODULE_COLORS.content,
    onComplete: (success) => {
      const id = dispatchedSceneIdRef.current;
      if (success && id !== null) {
        updateDoc({
          id,
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

  // The event code runs on the open scene's budget (UAudioSceneManager's pool and
  // voice limit), read from the scene as the user sees it (`settle`).
  const handleGenerateEvents = useCallback((config: AudioEventCatalogConfig) => {
    const doc = settle();
    const scene = doc ? { soundPoolSize: doc.soundPoolSize, maxConcurrentSounds: doc.maxConcurrentSounds } : null;
    eventCli.sendPrompt(buildAudioEventPrompt(config, ctx, scene));
  }, [eventCli, ctx, settle]);

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
    // Creating opens the new scene: send the open scene's buffered ops first.
    sceneBuffer.flush();
    setIsCreating(true);
    await createDoc({ name: newDocName.trim() });
    setNewDocName('');
    setIsCreating(false);
  }, [newDocName, createDoc, sceneBuffer]);

  // ── Generate ──
  // Prompts are built from the scene as the user SEES it (`settle`: the server
  // copy with the session's buffered ops, which it also writes now), never from
  // the round-trip-stale `activeDoc`.

  const handleGenerateAll = useCallback(() => {
    const doc = settle();
    if (!doc) return;
    dispatchedSceneIdRef.current = doc.id;
    audioCli.sendPrompt(buildAudioSystemPrompt(doc, ctx));
  }, [settle, ctx, audioCli]);

  const handleGenerateZoneCode = useCallback((zone: AudioZone) => {
    const doc = settle();
    if (!doc) return;
    dispatchedSceneIdRef.current = doc.id;
    audioCli.sendPrompt(buildZoneCodegenPrompt(zone, doc, ctx));
  }, [settle, ctx, audioCli]);

  const activeDocId = activeDoc?.id ?? null;
  const handleGenerateSoundscape = useCallback((zone: AudioZone) => {
    dispatchedSceneIdRef.current = activeDocId;
    audioCli.sendPrompt(buildSoundscapeNarrativePrompt(zone, ctx));
  }, [activeDocId, ctx, audioCli]);

  // ── Doc-level field writes ──
  // Zones and emitters go through the session buffer above; these are the
  // scene's own fields, one debounced field each (`useDebouncedCommit`, flushed
  // on unmount). They use the THROWING `commitDoc` so a field keeps its draft and
  // offers a retry; `updateDoc` swallows failures and is reserved for
  // fire-and-forget bookkeeping (lastGeneratedAt).

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
    sceneSession,
    handleGenerateAll,
    handleGenerateZoneCode,
    handleGenerateSoundscape,
    commitDescription,
    commitSetting,
  };
}
