'use client';
import {
  Trash2, Loader2,
  Zap, Volume2, Radio, Settings, List, Eye, ListChecks, Code2, Wand2,
  Library, Sparkles,
} from 'lucide-react';
import { FetchError } from '@/components/modules/shared/FetchError';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import { AudioCodeGenPanel } from '@/components/modules/content/audio/AudioCodeGenPanel';
import { SpatialAudioGeneratorPanel } from '@/components/modules/content/audio/SpatialAudioGeneratorPanel';
import { SoundForgePanel } from '@/components/modules/content/audio/SoundForgePanel';
import { AudioLibraryPanel } from '@/components/modules/content/audio/AudioLibraryPanel';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { useAudioView } from './useAudioView';
import { TabButton, tabDomId, AUDIO_TABPANEL_ID } from './TabButton';
import { SceneSidebar } from './SceneSidebar';
import { PainterTab } from './PainterTab';
import { SoundscapesTab } from './SoundscapesTab';
import { SettingsTab } from './SettingsTab';
import { EmptyState } from './EmptyState';

/**
 * Roving-tabindex keyboard navigation for the tab strip (WAI-ARIA tabs pattern):
 * Left/Right wrap around the strip, Home/End jump to the ends. Focusing a tab
 * also activates it (automatic activation) by clicking it, which reuses each
 * TabButton's own onClick — no duplicate tab-id list to keep in sync.
 */
function handleTabListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (current === -1 || tabs.length === 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
        : e.key === 'ArrowLeft' ? (current - 1 + tabs.length) % tabs.length
          : (current + 1) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}

export function AudioView() {
  const {
    docs,
    summary,
    activeDoc,
    isLoading,
    error,
    retry,
    setActiveDocId,
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
    commitZonePatch,
    commitEmitterPatch,
    handleGenerateAll,
    handleGenerateZoneCode,
    handleGenerateSoundscape,
    commitDescription,
    commitSetting,
    selectedZone,
    selectedEmitter,
  } = useAudioView();

  // The full-screen spinner is for the FIRST load only. `useCRUD.refetch` raises
  // `isLoading` on every background refetch (each save triggers one), and blanking
  // the view for those unmounted the scene painter mid-gesture — destroying the
  // drag/resize/zoom state the user was holding. Once a scene is on screen the view
  // stays mounted and refreshes in place.
  if (isLoading && docs.length === 0) {
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

      {/* Left sidebar — Scene list */}
      <SceneSidebar
        summary={summary}
        docs={docs}
        activeDoc={activeDoc}
        setActiveDocId={setActiveDocId}
        setSelectedZoneId={setSelectedZoneId}
        setSelectedEmitterId={setSelectedEmitterId}
        newDocName={newDocName}
        setNewDocName={setNewDocName}
        handleCreateDoc={handleCreateDoc}
        isCreating={isCreating}
      />

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
                  backgroundColor: `${MODULE_COLORS.content}15`,
                  color: MODULE_COLORS.content,
                  border: `1px solid ${MODULE_COLORS.content}30`,
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
                className="px-2 py-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete scene"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tab bar */}
            <div
              role="tablist"
              aria-label="Audio scene views"
              onKeyDown={handleTabListKeyDown}
              className="flex items-center gap-1 px-5 border-b border-border"
            >
              <TabButton id="overview" label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accent={MODULE_COLORS.content} />
              <TabButton id="roadmap" label="Roadmap" icon={ListChecks} active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accent={MODULE_COLORS.content} />
              <TabButton id="painter" label="Scene Painter" icon={Volume2} active={activeTab === 'painter'} onClick={() => setActiveTab('painter')} accent={MODULE_COLORS.content} />
              <TabButton id="events" label="Event Catalog" icon={List} active={activeTab === 'events'} onClick={() => setActiveTab('events')} accent={MODULE_COLORS.content} />
              <TabButton id="soundscapes" label="Soundscapes" icon={Radio} active={activeTab === 'soundscapes'} onClick={() => setActiveTab('soundscapes')} accent={MODULE_COLORS.content} />
              <TabButton id="settings" label="Settings" icon={Settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} accent={MODULE_COLORS.content} />
              <TabButton id="codegen" label="Code Gen" icon={Code2} active={activeTab === 'codegen'} onClick={() => setActiveTab('codegen')} accent={MODULE_COLORS.content} />
              <TabButton id="autogen" label="Auto Gen" icon={Wand2} active={activeTab === 'autogen'} onClick={() => setActiveTab('autogen')} accent={MODULE_COLORS.content} />
              <TabButton id="forge" label="Sound Forge" icon={Sparkles} active={activeTab === 'forge'} onClick={() => setActiveTab('forge')} accent={MODULE_COLORS.content} />
              <TabButton id="library" label="Library" icon={Library} active={activeTab === 'library'} onClick={() => setActiveTab('library')} accent={MODULE_COLORS.content} />
            </div>

            {/* Tab content */}
            <div
              id={AUDIO_TABPANEL_ID}
              role="tabpanel"
              aria-labelledby={tabDomId(activeTab)}
              className="flex-1 overflow-hidden"
            >
              {activeTab === 'overview' && (
                <div className="overflow-y-auto p-5">
                  <FeatureMatrix
                    key={rvRefetch}
                    moduleId={AUD_MODULE_ID}
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
                      subModuleId={AUD_MODULE_ID}
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

              {activeTab === 'painter' && (
                <PainterTab
                  activeDoc={activeDoc}
                  commitScene={commitScene}
                  commitZones={commitZones}
                  commitEmitters={commitEmitters}
                  setSelectedZoneId={setSelectedZoneId}
                  setSelectedEmitterId={setSelectedEmitterId}
                  selectedZoneId={selectedZoneId}
                  selectedEmitterId={selectedEmitterId}
                  selectedZone={selectedZone}
                  selectedEmitter={selectedEmitter}
                  commitZonePatch={commitZonePatch}
                  commitEmitterPatch={commitEmitterPatch}
                  handleGenerateZoneCode={handleGenerateZoneCode}
                  handleGenerateSoundscape={handleGenerateSoundscape}
                  audioCli={audioCli}
                />
              )}

              {activeTab === 'events' && (
                <AudioEventCatalog
                  key={activeDoc.id}
                  sceneId={String(activeDoc.id)}
                  onGenerate={handleGenerateEvents}
                  isGenerating={eventCli.isRunning}
                />
              )}

              {activeTab === 'soundscapes' && (
                <SoundscapesTab
                  key={activeDoc.id}
                  activeDoc={activeDoc}
                  commitDescription={commitDescription}
                  commitZones={commitZones}
                  handleGenerateSoundscape={handleGenerateSoundscape}
                  audioCli={audioCli}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  key={activeDoc.id}
                  activeDoc={activeDoc}
                  commitSetting={commitSetting}
                />
              )}

              {activeTab === 'codegen' && (
                <div className="overflow-y-auto p-5">
                  <AudioCodeGenPanel doc={activeDoc} accentColor={MODULE_COLORS.content} />
                </div>
              )}

              {activeTab === 'autogen' && (
                <div className="overflow-y-auto p-5">
                  <SpatialAudioGeneratorPanel
                    activeDoc={activeDoc}
                    accentColor={MODULE_COLORS.content}
                    onSceneCreated={refetch}
                  />
                </div>
              )}

              {activeTab === 'forge' && (
                <SoundForgePanel />
              )}

              {activeTab === 'library' && (
                <AudioLibraryPanel />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            pipelineCli={pipelineCli}
            newDocName={newDocName}
            setNewDocName={setNewDocName}
            handleCreateDoc={handleCreateDoc}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
