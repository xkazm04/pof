'use client';
import { getModuleChecklist } from '@/lib/module-registry';

import { useState, useCallback, useEffect } from 'react';
import {
  Music, Plus, Trash2, FileText, Loader2,
  Zap, Volume2, Radio, Settings, List, Eye, ListChecks, Code2, Wand2,
} from 'lucide-react';
import { useAudioScene } from '@/hooks/useAudioScene';
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
import { AudioScenePainter } from './AudioScenePainter';
import { ZonePropertyPanel, EmitterPropertyPanel } from './AudioPropertyPanel';
import { AudioPipelineDiagram } from './AudioPipelineDiagram';
import { AudioEventCatalog } from './AudioEventCatalog';
import { AudioCodeGenPanel } from './AudioCodeGenPanel';
import { SpatialAudioGeneratorPanel } from './SpatialAudioGeneratorPanel';
import {
  buildAudioSystemPrompt,
  buildZoneCodegenPrompt,
  buildSoundscapeNarrativePrompt,
} from '@/lib/prompts/audio-scene';
import { buildAudioEventPrompt } from '@/lib/prompts/audio-events';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import type { AudioEventCatalogConfig } from './AudioEventCatalog';

const CONTENT_ACCENT = '#f59e0b';

type TabId = 'overview' | 'roadmap' | 'painter' | 'soundscapes' | 'settings' | 'events' | 'codegen' | 'autogen';

export function AudioView() {
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

  const ctx = { projectName, projectPath, ueVersion };

  // ── Pipeline CLI session ──

  const pipelineCli = useChecklistCLI({
    moduleId: 'audio',
    sessionKey: 'audio-pipeline',
    label: 'Audio Pipeline',
    accentColor: CONTENT_ACCENT,
  });

  // ── Scene CLI session ──

  const audioCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-codegen',
    label: 'Audio Code Gen',
    accentColor: CONTENT_ACCENT,
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
    accentColor: CONTENT_ACCENT,
  });

  const handleGenerateEvents = useCallback((config: AudioEventCatalogConfig) => {
    const prompt = buildAudioEventPrompt(config, { projectName, projectPath, ueVersion });
    eventCli.sendPrompt(prompt);
  }, [eventCli, projectName, projectPath, ueVersion]);

  // ── Review/Checklist inline CLI sessions ──

  const AUD_MODULE_ID = 'audio' as const;
  const AUD_MODULE_LABEL = 'Audio';

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
    moduleId: AUD_MODULE_ID,
    sessionKey: `${AUD_MODULE_ID}-rv-cli`,
    label: AUD_MODULE_LABEL,
    accentColor: CONTENT_ACCENT,
    onItemCompleted: handleRvItemCompleted,
  });

  const handleRvReviewComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: AUD_MODULE_ID, projectPath }),
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
    moduleId: AUD_MODULE_ID,
    sessionKey: `${AUD_MODULE_ID}-rv-review`,
    label: `${AUD_MODULE_LABEL} Review`,
    accentColor: CONTENT_ACCENT,
    onComplete: handleRvReviewComplete,
  });

  const rvFixCli = useModuleCLI({
    moduleId: AUD_MODULE_ID,
    sessionKey: `${AUD_MODULE_ID}-rv-fix`,
    label: `${AUD_MODULE_LABEL} Fix`,
    accentColor: CONTENT_ACCENT,
  });

  const handleRvFix = useCallback((feature: FeatureRow) => {
    if (!feature.nextSteps) return;
    const task = TaskFactory.featureFix(AUD_MODULE_ID, feature, `${AUD_MODULE_LABEL} Fix`);
    rvFixCli.execute(task);
  }, [rvFixCli]);

  const handleRvSync = useCallback(async () => {
    try {
      const res = await fetch('/api/feature-matrix/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: AUD_MODULE_ID, projectPath }),
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
    const defs = MODULE_FEATURE_DEFINITIONS[AUD_MODULE_ID] ?? [];
    if (defs.length === 0) return;
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const task = TaskFactory.featureReview(AUD_MODULE_ID, AUD_MODULE_LABEL, defs, appOrigin, `${AUD_MODULE_LABEL} Review`);
    rvReviewCli.execute(task);
  }, [rvReviewCli]);

  const rvChecklist = getModuleChecklist(AUD_MODULE_ID);

  // ── Handlers ──

  const handleCreateDoc = useCallback(async () => {
    if (!newDocName.trim()) return;
    setIsCreating(true);
    await createDoc({ name: newDocName.trim() });
    setNewDocName('');
    setIsCreating(false);
  }, [newDocName, createDoc]);

  const handleUpdateZones = useCallback((zones: AudioZone[]) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, zones });
  }, [activeDoc, updateDoc]);

  const handleUpdateEmitters = useCallback((emitters: SoundEmitter[]) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, emitters });
  }, [activeDoc, updateDoc]);

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

  const handleDescriptionChange = useCallback((description: string) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, description });
  }, [activeDoc, updateDoc]);

  const handleSettingsChange = useCallback((key: 'soundPoolSize' | 'maxConcurrentSounds' | 'globalReverbPreset', value: unknown) => {
    if (!activeDoc) return;
    updateDoc({ id: activeDoc.id, [key]: value });
  }, [activeDoc, updateDoc]);

  const selectedZone = activeDoc?.zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedEmitter = activeDoc?.emitters.find((e) => e.id === selectedEmitterId) ?? null;

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
            style={{ backgroundColor: rvToast.type === 'success' ? '#4ade80' : '#f87171' }}
          />
          {rvToast.message}
        </div>
      )}

      {/* Left sidebar — Scene list */}
      <div className="w-52 border-r border-border bg-surface-deep flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden flex items-center gap-2 px-3 py-3 border-b border-border">
          <ModuleHeaderDecoration moduleId="audio" variant="compact" />
          <Music className="w-3.5 h-3.5 relative" style={{ color: CONTENT_ACCENT }} />
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
                backgroundColor: `${CONTENT_ACCENT}15`,
                color: CONTENT_ACCENT,
                border: `1px solid ${CONTENT_ACCENT}30`,
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
                  {activeDoc.zones.length} zones &middot; {activeDoc.emitters.length} emitters
                  {activeDoc.lastGeneratedAt && (
                    <span> &middot; Last generated {new Date(activeDoc.lastGeneratedAt).toLocaleDateString()}</span>
                  )}
                </p>
              </div>

              <button
                onClick={handleGenerateAll}
                disabled={audioCli.isRunning || (activeDoc.zones.length === 0 && activeDoc.emitters.length === 0)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${CONTENT_ACCENT}15`,
                  color: CONTENT_ACCENT,
                  border: `1px solid ${CONTENT_ACCENT}30`,
                }}
              >
                {audioCli.isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                {audioCli.isRunning ? 'Generating...' : 'Generate Audio System'}
              </button>

              <button
                onClick={() => deleteDoc(activeDoc.id)}
                className="px-2 py-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
                title="Delete scene"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 border-b border-border">
              <TabButton label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accent={CONTENT_ACCENT} />
              <TabButton label="Roadmap" icon={ListChecks} active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accent={CONTENT_ACCENT} />
              <TabButton label="Scene Painter" icon={Volume2} active={activeTab === 'painter'} onClick={() => setActiveTab('painter')} accent={CONTENT_ACCENT} />
              <TabButton label="Event Catalog" icon={List} active={activeTab === 'events'} onClick={() => setActiveTab('events')} accent={CONTENT_ACCENT} />
              <TabButton label="Soundscapes" icon={Radio} active={activeTab === 'soundscapes'} onClick={() => setActiveTab('soundscapes')} accent={CONTENT_ACCENT} />
              <TabButton label="Settings" icon={Settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} accent={CONTENT_ACCENT} />
              <TabButton label="Code Gen" icon={Code2} active={activeTab === 'codegen'} onClick={() => setActiveTab('codegen')} accent={CONTENT_ACCENT} />
              <TabButton label="Auto Gen" icon={Wand2} active={activeTab === 'autogen'} onClick={() => setActiveTab('autogen')} accent={CONTENT_ACCENT} />
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'overview' && (
                <div className="overflow-y-auto p-5">
                  <FeatureMatrix
                    key={rvRefetch}
                    moduleId={AUD_MODULE_ID}
                    accentColor={CONTENT_ACCENT}
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
                      subModuleId={AUD_MODULE_ID}
                      onRunPrompt={rvChecklistCli.sendPrompt}
                      accentColor={CONTENT_ACCENT}
                      isRunning={rvChecklistCli.isRunning}
                      activeItemId={rvChecklistCli.activeItemId}
                      lastCompletedItemId={rvLastCompletedId}
                    />
                  ) : (
                    <p className="text-sm text-text-muted">No checklist items defined for this module yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'painter' && (
                <div className="flex h-full">
                  <div className="flex-1 min-w-0">
                    <AudioScenePainter
                      zones={activeDoc.zones}
                      emitters={activeDoc.emitters}
                      onUpdateZones={handleUpdateZones}
                      onUpdateEmitters={handleUpdateEmitters}
                      onSelectZone={(id) => { setSelectedZoneId(id); if (id) setSelectedEmitterId(null); }}
                      onSelectEmitter={(id) => { setSelectedEmitterId(id); if (id) setSelectedZoneId(null); }}
                      selectedZoneId={selectedZoneId}
                      selectedEmitterId={selectedEmitterId}
                      accentColor={CONTENT_ACCENT}
                    />
                  </div>

                  {/* Property sidebar */}
                  {(selectedZone || selectedEmitter) && (
                    <div className="w-72 border-l border-border bg-surface-deep flex-shrink-0 overflow-y-auto">
                      {selectedZone && (
                        <ZonePropertyPanel
                          zone={selectedZone}
                          onUpdate={handleZoneUpdate}
                          onGenerateCode={handleGenerateZoneCode}
                          onGenerateSoundscape={handleGenerateSoundscape}
                          accentColor={CONTENT_ACCENT}
                          isGenerating={audioCli.isRunning}
                        />
                      )}
                      {selectedEmitter && !selectedZone && (
                        <EmitterPropertyPanel
                          emitter={selectedEmitter}
                          onUpdate={handleEmitterUpdate}
                          accentColor={CONTENT_ACCENT}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <AudioEventCatalog
                  onGenerate={handleGenerateEvents}
                  isGenerating={eventCli.isRunning}
                />
              )}

              {activeTab === 'soundscapes' && (
                <div className="overflow-y-auto p-5 space-y-5">
                  {/* Scene description */}
                  <div>
                    <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
                      Scene Description
                    </label>
                    <textarea
                      value={activeDoc.description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      placeholder="Describe the overall audio atmosphere for this scene..."
                      className="w-full px-4 py-3 bg-surface-deep border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
                      rows={3}
                    />
                  </div>

                  {/* Per-zone soundscapes */}
                  {activeDoc.zones.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold text-text">Zone Soundscapes</h3>
                      {activeDoc.zones.map((zone) => {
                        const zoneEmitters = activeDoc.emitters.filter((e) => e.zoneId === zone.id);
                        return (
                          <div key={zone.id} className="p-3 rounded-lg bg-surface-deep border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
                              <h4 className="text-xs font-semibold text-text">{zone.name}</h4>
                              <span className="text-2xs text-text-muted">{zone.reverbPreset} · {zone.occlusionMode}</span>
                            </div>
                            <textarea
                              value={zone.soundscapeDescription}
                              onChange={(e) => {
                                const zones = activeDoc.zones.map((z) =>
                                  z.id === zone.id ? { ...z, soundscapeDescription: e.target.value } : z
                                );
                                updateDoc({ id: activeDoc.id, zones });
                              }}
                              placeholder={`Describe the soundscape for "${zone.name}"...\ne.g., 'dripping water echoing off stone walls, distant machinery hum'`}
                              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed font-mono"
                              rows={3}
                            />
                            {zoneEmitters.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {zoneEmitters.map((em) => (
                                  <span key={em.id} className="px-2 py-0.5 rounded text-2xs bg-surface border border-border text-text-muted-hover">
                                    {em.name} ({em.type})
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => handleGenerateSoundscape(zone)}
                              disabled={audioCli.isRunning || !zone.soundscapeDescription.trim()}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                              style={{
                                backgroundColor: '#a78bfa15',
                                color: '#a78bfa',
                                border: '1px solid #a78bfa30',
                              }}
                            >
                              <Zap className="w-3 h-3" />
                              Generate from Description
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Volume2 className="w-8 h-8 mx-auto text-border-bright mb-2" />
                      <p className="text-xs text-text-muted">
                        No zones yet. Switch to the Scene Painter tab to paint audio zones.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="overflow-y-auto p-5 space-y-5">
                  <h3 className="text-xs font-semibold text-text">Audio System Settings</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
                        Sound Pool Size
                      </label>
                      <input
                        type="number"
                        value={activeDoc.soundPoolSize}
                        onChange={(e) => handleSettingsChange('soundPoolSize', Math.max(1, Number(e.target.value)))}
                        min={1} max={256}
                        className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text outline-none focus:border-border-bright transition-colors"
                      />
                      <p className="text-2xs text-text-muted mt-1">Pre-allocated audio components for pooling</p>
                    </div>

                    <div>
                      <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
                        Max Concurrent Sounds
                      </label>
                      <input
                        type="number"
                        value={activeDoc.maxConcurrentSounds}
                        onChange={(e) => handleSettingsChange('maxConcurrentSounds', Math.max(1, Number(e.target.value)))}
                        min={1} max={128}
                        className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text outline-none focus:border-border-bright transition-colors"
                      />
                      <p className="text-2xs text-text-muted mt-1">Limit on simultaneous active sounds</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
                      Global Reverb Fallback
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'small-room', 'large-hall', 'outdoor'] as const).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleSettingsChange('globalReverbPreset', preset)}
                          className={`px-2.5 py-1.5 rounded text-xs transition-colors ${
                            activeDoc.globalReverbPreset === preset
                              ? 'bg-border-bright text-text border-[#3e3e6a]'
                              : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
                          }`}
                          style={{ border: '1px solid' }}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <p className="text-2xs text-text-muted mt-1">Default reverb when player is outside all zones</p>
                  </div>

                  {/* Zone overview table */}
                  {activeDoc.zones.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-text mb-3">Zone Overview</h3>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface text-text-muted">
                              <th className="text-left px-3 py-2 font-semibold">Zone</th>
                              <th className="text-left px-3 py-2 font-semibold">Reverb</th>
                              <th className="text-left px-3 py-2 font-semibold">Occlusion</th>
                              <th className="text-right px-3 py-2 font-semibold">Attenuation</th>
                              <th className="text-right px-3 py-2 font-semibold">Priority</th>
                              <th className="text-right px-3 py-2 font-semibold">Emitters</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeDoc.zones.map((zone) => {
                              const emCount = activeDoc.emitters.filter((e) => e.zoneId === zone.id).length;
                              return (
                                <tr key={zone.id} className="border-t border-border text-text-muted-hover">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
                                      <span className="text-text">{zone.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">{zone.reverbPreset}</td>
                                  <td className="px-3 py-2">{zone.occlusionMode}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{zone.attenuationRadius}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{zone.priority}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{emCount}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'codegen' && (
                <div className="overflow-y-auto p-5">
                  <AudioCodeGenPanel doc={activeDoc} accentColor={CONTENT_ACCENT} />
                </div>
              )}

              {activeTab === 'autogen' && (
                <div className="overflow-y-auto p-5">
                  <SpatialAudioGeneratorPanel
                    activeDoc={activeDoc}
                    accentColor={CONTENT_ACCENT}
                    onSceneCreated={refetch}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
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
                      backgroundColor: `${CONTENT_ACCENT}15`,
                      color: CONTENT_ACCENT,
                      border: `1px solid ${CONTENT_ACCENT}30`,
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Scene
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
  icon: typeof Music;
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
