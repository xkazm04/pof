'use client';

import { useState } from 'react';
import {
  Clapperboard, FileSearch, Activity, LayoutDashboard, GitCompareArrows,
} from 'lucide-react';
import { useGameDirector } from '@/hooks/useGameDirector';
import { DirectorOverview } from './DirectorOverview';
import { NewSessionPanel } from './NewSessionPanel';
import { SessionDetail } from './SessionDetail';
import { FindingsExplorer } from './FindingsExplorer';
import { RegressionTrackerView } from './RegressionTrackerView';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { ACCENT_ORANGE, STATUS_ERROR, STATUS_BLOCKER } from '@/lib/chart-colors';

type TabId = 'overview' | 'new-session' | 'findings' | 'regressions';

const ACCENT = ACCENT_ORANGE; // warm orange for the director

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

  // Nav urgency pills: open critical+high findings, and undismissed regression alerts.
  const openCriticalHigh = director.stats?.openCriticalHigh ?? 0;
  const hasCriticals = (director.stats?.criticalFindings ?? 0) > 0;
  const activeAlerts = director.stats?.activeAlerts ?? 0;

  const tabs: TabItem<TabId>[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'new-session', label: 'New Session', icon: Activity },
    {
      id: 'findings',
      label: 'All Findings',
      icon: FileSearch,
      badge: openCriticalHigh > 0 ? {
        count: openCriticalHigh,
        color: hasCriticals ? STATUS_ERROR : STATUS_BLOCKER,
        label: `${openCriticalHigh} open critical or high finding${openCriticalHigh !== 1 ? 's' : ''}`,
      } : undefined,
    },
    {
      id: 'regressions',
      label: 'Regressions',
      icon: GitCompareArrows,
      badge: activeAlerts > 0 ? {
        count: activeAlerts,
        color: STATUS_ERROR,
        label: `${activeAlerts} active regression alert${activeAlerts !== 1 ? 's' : ''}`,
      } : undefined,
    },
  ];

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
          markFixDispatched={director.markFixDispatched}
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
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          layoutId="director-tab-indicator"
          accent={ACCENT}
          ariaLabel="Game Director sections"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'overview' && (
          <DirectorOverview
            sessions={director.sessions}
            stats={director.stats}
            trend={director.trend}
            loading={director.loading}
            onViewSession={handleViewSession}
            onNewSession={() => setActiveTab('new-session')}
          />
        )}

        {activeTab === 'new-session' && (
          <NewSessionPanel onCreated={handleSessionCreated} createSession={director.createSession} />
        )}

        {activeTab === 'findings' && (
          <FindingsExplorer
            sessions={director.sessions}
            getFindings={director.getFindings}
            updateTriage={director.updateTriage}
            markFixDispatched={director.markFixDispatched}
            onNewSession={() => setActiveTab('new-session')}
          />
        )}

        {activeTab === 'regressions' && (
          <RegressionTrackerView />
        )}
      </div>
    </div>
  );
}
