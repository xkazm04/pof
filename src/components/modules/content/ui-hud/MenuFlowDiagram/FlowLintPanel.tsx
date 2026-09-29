'use client';

import { AlertOctagon, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS, OPACITY_10, OPACITY_40 } from '@/lib/chart-colors';
import type { MenuFlowIssue, MenuFlowSeverity } from './menuFlowLint';

interface FlowLintPanelProps {
  issues: MenuFlowIssue[];
  onFix: (issue: MenuFlowIssue) => void;
  onSelectScreen: (screenId: string) => void;
}

const SEVERITY: Record<MenuFlowSeverity, { color: string; label: string; Icon: typeof AlertOctagon }> = {
  error: { color: STATUS_ERROR, label: 'Blocks export', Icon: AlertOctagon },
  warning: { color: STATUS_WARNING, label: 'Warnings', Icon: AlertTriangle },
};

/** Live topology lint above Export: grouped issues, each with a one-click fix. */
export function FlowLintPanel({ issues, onFix, onSelectScreen }: FlowLintPanelProps) {
  if (issues.length === 0) {
    return (
      <div
        className="relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase"
        style={{ color: STATUS_SUCCESS, borderColor: `${STATUS_SUCCESS}${OPACITY_40}`, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}
        data-testid="menu-flow-lint-clean"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Topology clean - ready to export
      </div>
    );
  }

  return (
    <div className="relative z-10 p-4 bg-black/40 border border-violet-900/40 rounded-2xl space-y-3" data-testid="menu-flow-lint">
      {(['error', 'warning'] as const).map((severity) => {
        const group = issues.filter((i) => i.severity === severity);
        if (group.length === 0) return null;
        const { color, label, Icon } = SEVERITY[severity];
        return (
          <div key={severity} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase font-bold" style={{ color }}>
              <Icon className="w-3.5 h-3.5" />
              {label} ({group.length})
            </div>
            {group.map((issue) => (
              <div
                key={`${issue.kind}:${issue.transitionId ?? issue.screenIds.join(',')}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/60 border"
                style={{ borderColor: `${color}${OPACITY_40}` }}
              >
                <button
                  type="button"
                  onClick={() => issue.screenIds[0] && onSelectScreen(issue.screenIds[0])}
                  className="flex-1 text-left text-xs text-violet-100/90 hover:text-white"
                  title="Select the screen"
                >
                  {issue.message}
                </button>
                <button
                  type="button"
                  onClick={() => onFix(issue)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase border hover:bg-white/5 active:scale-95 transition-all"
                  style={{ color, borderColor: `${color}${OPACITY_40}` }}
                >
                  <Wrench className="w-3 h-3" />
                  {issue.fix}
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
