'use client';

import { Code2, Copy, Check, Download } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { EDITOR_ACCENT } from './constants';

export function CodeOutputPanel({
  code,
  codeTab,
  onTabChange,
  onCopy,
  copiedSection,
  onExport,
}: {
  code: string;
  codeTab: 'full' | 'enum' | 'compute' | 'setup';
  onTabChange: (tab: 'full' | 'enum' | 'compute' | 'setup') => void;
  onCopy: (section: string, text: string) => void;
  copiedSection: string | null;
  onExport: () => void;
}) {
  const tabs = [
    { id: 'full' as const, label: 'Full Output' },
    { id: 'enum' as const, label: 'Enum' },
    { id: 'compute' as const, label: 'ComputeAnimState()' },
    { id: 'setup' as const, label: 'AnimBP Setup' },
  ];

  return (
    <div className="rounded-xl border border-border bg-[#0a0a1a] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5 mr-2" style={{ color: EDITOR_ACCENT }} />
          {tabs.map((t) => (
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopy(codeTab, code)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: copiedSection === codeTab ? `${STATUS_SUCCESS}20` : `${EDITOR_ACCENT}10`,
              color: copiedSection === codeTab ? STATUS_SUCCESS : EDITOR_ACCENT,
            }}
          >
            {copiedSection === codeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedSection === codeTab ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: `${STATUS_SUCCESS}10`, color: STATUS_SUCCESS }}
          >
            <Download className="w-3 h-3" />
            Export .cpp
          </button>
        </div>
      </div>

      {/* Code content */}
      <pre className="p-4 text-[11px] font-mono text-text-muted leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
