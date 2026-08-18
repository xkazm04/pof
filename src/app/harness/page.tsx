'use client';

import { useState } from 'react';
import { Play, Image as ImageIcon, BookOpen, History, Droplets } from 'lucide-react';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { HarnessRunControls } from '@/components/harness/HarnessRunControls';
import { DrainWorkerControls } from '@/components/harness/DrainWorkerControls';
import { HarnessVisualGallery } from '@/components/harness/HarnessVisualGallery';
import { HarnessGuideViewer } from '@/components/harness/HarnessGuideViewer';
import { HarnessRunHistory } from '@/components/harness/HarnessRunHistory';
import { STATUS_INFO } from '@/lib/chart-colors';

type Tab = 'control' | 'drain' | 'gallery' | 'guide' | 'history';

const TABS: ReadonlyArray<TabItem<Tab>> = [
  { id: 'control', label: 'Run controls', icon: Play },
  { id: 'drain', label: 'Gate drain', icon: Droplets },
  { id: 'gallery', label: 'Visual gallery', icon: ImageIcon },
  { id: 'guide', label: 'Build guide', icon: BookOpen },
  { id: 'history', label: 'Run history', icon: History },
];

/**
 * Operator-facing surface for the project's autonomous runners: the harness run
 * controls (start / pause / resume over `/api/harness`, with live run state), the
 * always-on gate-drain worker (start / stop, with its tick + lease state), the
 * visual-gate gallery (per-iteration screenshots, before/after diffs), the
 * rendered build guide, and the persistent run history with run-to-run
 * comparison.
 */
export default function HarnessPage() {
  const [tab, setTab] = useState<Tab>('control');
  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text">Harness</h1>
        <TabBar
          tabs={TABS}
          activeId={tab}
          onChange={setTab}
          layoutId="harness-page-tabs"
          accent={STATUS_INFO}
          density="compact"
          ariaLabel="Harness sections"
        />
      </header>
      <div>
        {tab === 'control' && <HarnessRunControls />}
        {tab === 'drain' && <DrainWorkerControls />}
        {tab === 'gallery' && <HarnessVisualGallery />}
        {tab === 'guide' && <HarnessGuideViewer />}
        {tab === 'history' && <HarnessRunHistory />}
      </div>
    </main>
  );
}
