'use client';
import {
  Map, Trash2, Loader2, Zap, BookOpen, GitCompare, BarChart3, Layers,
  Grid3X3, Eye, ListChecks, Boxes, Trees, ShieldAlert,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';
import { ScrollableTabBar, TabButton } from './TabBar';
import { LevelTabContent } from './LevelTabContent';
import type { LevelDesignVM } from './useLevelDesignView';

export function ActiveDocView({ vm }: { vm: LevelDesignVM }) {
  const {
    activeDoc,
    activeTab,
    setActiveTab,
    isAnyRunning,
    codegenCli,
    deleteDoc,
    pacingLint,
    handleGenerateAllCode,
  } = vm;

  if (!activeDoc) return null;

  return (
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
      <ScrollableTabBar>
        <TabButton label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} accent={MODULE_COLORS.content} />
        <TabButton label="Roadmap" icon={ListChecks} active={activeTab === 'roadmap'} onClick={() => setActiveTab('roadmap')} accent={MODULE_COLORS.content} />
        <TabButton label="Flow Editor" icon={Map} active={activeTab === 'flow'} onClick={() => setActiveTab('flow')} accent={MODULE_COLORS.content} />
        <TabButton label="Procgen" icon={Grid3X3} active={activeTab === 'procgen'} onClick={() => setActiveTab('procgen')} accent={MODULE_COLORS.content} />
        <TabButton label="Dungeon (UE)" icon={Boxes} active={activeTab === 'dungeon-ue'} onClick={() => setActiveTab('dungeon-ue')} accent={MODULE_COLORS.content} />
        <TabButton label="Scatter (UE)" icon={Trees} active={activeTab === 'scatter-ue'} onClick={() => setActiveTab('scatter-ue')} accent={MODULE_COLORS.content} />
        <TabButton label="Streaming" icon={Layers} active={activeTab === 'streaming'} onClick={() => setActiveTab('streaming')} accent={MODULE_COLORS.content} />
        <TabButton label="Narrative" icon={BookOpen} active={activeTab === 'narrative'} onClick={() => setActiveTab('narrative')} accent={MODULE_COLORS.content} />
        <TabButton label="Sync" icon={GitCompare} active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} accent={MODULE_COLORS.content} />
        <TabButton label="Difficulty" icon={BarChart3} active={activeTab === 'arc'} onClick={() => setActiveTab('arc')} accent={MODULE_COLORS.content} />
        <TabButton
          label="Pacing"
          icon={ShieldAlert}
          active={activeTab === 'pacing'}
          onClick={() => setActiveTab('pacing')}
          accent={MODULE_COLORS.content}
          badgeCount={pacingLint?.findings.length ?? 0}
          badgeColor={
            (pacingLint?.counts.critical ?? 0) > 0 ? STATUS_ERROR
            : (pacingLint?.counts.warning ?? 0) > 0 ? STATUS_WARNING
            : (pacingLint?.findings.length ?? 0) > 0 ? STATUS_INFO
            : undefined
          }
        />
      </ScrollableTabBar>

      {/* Tab content */}
      <LevelTabContent vm={vm} />
    </>
  );
}
