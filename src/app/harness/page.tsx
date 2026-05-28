'use client';

import { useState } from 'react';
import { HarnessVisualGallery } from '@/components/harness/HarnessVisualGallery';
import { HarnessGuideViewer } from '@/components/harness/HarnessGuideViewer';
import { HarnessRunHistory } from '@/components/harness/HarnessRunHistory';

type Tab = 'gallery' | 'guide' | 'history';

const TAB_LABEL: Record<Tab, string> = {
  gallery: 'Visual gallery',
  guide: 'Build guide',
  history: 'Run history',
};

/**
 * Operator-facing surface for the autonomous builder: the visual-gate gallery
 * (per-iteration screenshots, before/after diffs), the rendered build guide,
 * and the persistent run history with run-to-run comparison.
 */
export default function HarnessPage() {
  const [tab, setTab] = useState<Tab>('gallery');
  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-text">Harness</h1>
        <div className="ml-4 flex gap-1.5">
          {(['gallery', 'guide', 'history'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`px-3 py-1 text-xs rounded border focus-ring ${
                tab === id ? 'border-border text-text bg-surface-deep/60' : 'border-border/40 text-text-muted hover:text-text'
              }`}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
      </header>
      <div>
        {tab === 'gallery' && <HarnessVisualGallery />}
        {tab === 'guide' && <HarnessGuideViewer />}
        {tab === 'history' && <HarnessRunHistory />}
      </div>
    </main>
  );
}
