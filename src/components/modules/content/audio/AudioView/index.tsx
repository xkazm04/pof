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
import { TabButton } from './TabButton';
import { SceneSidebar } from './SceneSidebar';
import { PainterTab } from './PainterTab';
import { SoundscapesTab } from './SoundscapesTab';
import { SettingsTab } from './SettingsTab';
import { EmptyState } from './EmptyState';

export function AudioView() {
  const {
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
    handleUpdateZones,
    handleUpdateEmitters,
    handleZoneUpdate,
    handleEmitterUpdate,
    handleGenerateAll,
    handleGenerateZoneCode,
    handleGenerateSoundscape,
    handleDescriptionChange,
    handleSettingsChange,
    selectedZone,
    selectedEmitter,
  } = useAudioView();

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
            <div className="flex items-center gap-1 px-5 border-b border-border">
              <TabButton label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accent={MODULE_COLORS.content} />
              <TabButton label="Roadmap" icon={ListChecks} active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accent={MODULE_COLORS.content} />
              <TabButton label="Scene Painter" icon={Volume2} active={activeTab === 'painter'} onClick={() => setActiveTab('painter')} accent={MODULE_COLORS.content} />
              <TabButton label="Event Catalog" icon={List} active={activeTab === 'events'} onClick={() => setActiveTab('events')} accent={MODULE_COLORS.content} />
              <TabButton label="Soundscapes" icon={Radio} active={activeTab === 'soundscapes'} onClick={() => setActiveTab('soundscapes')} accent={MODULE_COLORS.content} />
              <TabButton label="Settings" icon={Settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} accent={MODULE_COLORS.content} />
              <TabButton label="Code Gen" icon={Code2} active={activeTab === 'codegen'} onClick={() => setActiveTab('codegen')} accent={MODULE_COLORS.content} />
              <TabButton label="Auto Gen" icon={Wand2} active={activeTab === 'autogen'} onClick={() => setActiveTab('autogen')} accent={MODULE_COLORS.content} />
              <TabButton label="Sound Forge" icon={Sparkles} active={activeTab === 'forge'} onClick={() => setActiveTab('forge')} accent={MODULE_COLORS.content} />
              <TabButton label="Library" icon={Library} active={activeTab === 'library'} onClick={() => setActiveTab('library')} accent={MODULE_COLORS.content} />
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
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
                  handleUpdateZones={handleUpdateZones}
                  handleUpdateEmitters={handleUpdateEmitters}
                  setSelectedZoneId={setSelectedZoneId}
                  setSelectedEmitterId={setSelectedEmitterId}
                  selectedZoneId={selectedZoneId}
                  selectedEmitterId={selectedEmitterId}
                  selectedZone={selectedZone}
                  selectedEmitter={selectedEmitter}
                  handleZoneUpdate={handleZoneUpdate}
                  handleGenerateZoneCode={handleGenerateZoneCode}
                  handleGenerateSoundscape={handleGenerateSoundscape}
                  handleEmitterUpdate={handleEmitterUpdate}
                  audioCli={audioCli}
                />
              )}

              {activeTab === 'events' && (
                <AudioEventCatalog
                  onGenerate={handleGenerateEvents}
                  isGenerating={eventCli.isRunning}
                />
              )}

              {activeTab === 'soundscapes' && (
                <SoundscapesTab
                  activeDoc={activeDoc}
                  handleDescriptionChange={handleDescriptionChange}
                  updateDoc={updateDoc}
                  handleGenerateSoundscape={handleGenerateSoundscape}
                  audioCli={audioCli}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  activeDoc={activeDoc}
                  handleSettingsChange={handleSettingsChange}
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
