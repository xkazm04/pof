'use client';

import { Code2, Download } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { EDITOR_ACCENT } from './constants';

export type CodeTabId = 'full' | 'enum' | 'compute' | 'setup';

// Each tab downloads/copies under the name it would carry in the UE project,
// so a copied snippet is identifiable once it leaves the editor.
const TABS: { id: CodeTabId; label: string; fileName: string; languageLabel?: string }[] = [
  { id: 'full', label: 'Full Output', fileName: 'ARPGAnimInstance_StateMachine.cpp' },
  { id: 'enum', label: 'Enum', fileName: 'EARPGAnimState.h' },
  { id: 'compute', label: 'ComputeAnimState()', fileName: 'ARPGAnimInstance_ComputeAnimState.cpp' },
  // Comment-only build instructions rather than compilable source — named and
  // labelled as notes so the download isn't mistaken for a translation unit.
  { id: 'setup', label: 'AnimBP Setup', fileName: 'AnimBP_Setup.txt', languageLabel: 'Setup Notes' },
];

export function CodeOutputPanel({
  code,
  codeTab,
  onTabChange,
  onExport,
}: {
  code: string;
  codeTab: CodeTabId;
  onTabChange: (tab: CodeTabId) => void;
  onExport: () => void;
}) {
  const activeTab = TABS.find((t) => t.id === codeTab) ?? TABS[0];

  return (
    <div className="rounded-xl border border-border bg-surface-deep overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5 mr-2" style={{ color: EDITOR_ACCENT }} />
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: codeTab === t.id ? `${EDITOR_ACCENT}20` : 'transparent',
                color: codeTab === t.id ? EDITOR_ACCENT : 'var(--text-muted)',
                border: codeTab === t.id ? `1px solid ${EDITOR_ACCENT}40` : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Whole-machine export — distinct from CodeViewer's download of the
            section currently on screen. */}
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{ backgroundColor: `${STATUS_SUCCESS}10`, color: STATUS_SUCCESS }}
          title="Export the full generated C++ output as a dated .cpp file"
        >
          <Download className="w-3 h-3" />
          Export .cpp
        </button>
      </div>

      {/* Code content — shared Shiki viewer (highlighting, copy, download) */}
      <CodeViewer
        code={code}
        fileName={activeTab.fileName}
        lang="cpp"
        languageLabel={activeTab.languageLabel}
        maxHeightClass="max-h-[500px]"
      />
    </div>
  );
}
