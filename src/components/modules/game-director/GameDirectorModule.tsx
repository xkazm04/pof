'use client';

import { useState } from 'react';
import {
  Clapperboard, BarChart3, FileSearch, Activity, LayoutDashboard,
} from 'lucide-react';
import { useGameDirector } from '@/hooks/useGameDirector';
import { DirectorOverview } from './DirectorOverview';
import { NewSessionPanel } from './NewSessionPanel';
import { SessionDetail } from './SessionDetail';
import { FindingsExplorer } from './FindingsExplorer';

type TabId = 'overview' | 'new-session' | 'findings';

const ACCENT = '#f97316'; // warm orange for the director

export function GameDirectorModule() {
  const director = useGameDirector();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleViewSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleBackToOverview = () => {
    setSelectedSessionId(null);
  };

  const handleSessionCreated = () => {
    setActiveTab('overview');
    director.refresh();
  };

  // If a session is selected, show the session detail view
  if (selectedSessionId) {
    const session = director.sessions.find(s => s.id === selectedSessionId);
    if (session) {
      return (
        <SessionDetail
          session={session}
          onBack={handleBackToOverview}
          onSimulate={() => director.simulatePlaytest(session.id)}
          onDelete={async () => {
            await director.deleteSession(session.id);
            handleBackToOverview();
          }}
          simulating={director.simulating}
          getFindings={director.getFindings}
          getEvents={director.getEvents}
        />
      );
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
          >
            <Clapperboard className="w-4.5 h-4.5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">AI Game Director</h1>
            <p className="text-xs text-text-muted">
              Autonomous playtesting agent that plays and critiques your game
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border">
          <TabButton
            label="Overview"
            icon={LayoutDashboard}
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            accent={ACCENT}
          />
          <TabButton
            label="New Session"
            icon={Activity}
            active={activeTab === 'new-session'}
            onClick={() => setActiveTab('new-session')}
            accent={ACCENT}
          />
          <TabButton
            label="All Findings"
            icon={FileSearch}
            active={activeTab === 'findings'}
            onClick={() => setActiveTab('findings')}
            accent={ACCENT}
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'overview' && (
          <DirectorOverview
            sessions={director.sessions}
            stats={director.stats}
            loading={director.loading}
            onViewSession={handleViewSession}
            onNewSession={() => setActiveTab('new-session')}
          />
        )}

        {activeTab === 'new-session' && (
          <NewSessionPanel onCreated={handleSessionCreated} createSession={director.createSession} />
        )}

        {activeTab === 'findings' && (
          <FindingsExplorer sessions={director.sessions} getFindings={director.getFindings} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  accent,
}: {
  label: string;
  icon: typeof BarChart3;
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
