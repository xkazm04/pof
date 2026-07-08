import type { RefactoringItem } from '@/types/codebase-archeologist';
import { CATEGORY_LABELS } from './constants';
import { SeverityBadge } from './SeverityBadge';

export function BacklogTab({ backlog }: { backlog: RefactoringItem[] }) {
  const maxScore = backlog.length > 0 ? backlog[0].score : 1;

  return (
    <div className="space-y-2">
      <div className="text-xs text-text-muted">
        Prioritized by <span className="text-text font-medium">anti-patterns × git churn</span> — higher score = more urgent
      </div>
      <div className="rounded border border-border bg-background/60 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_50px_50px_80px_60px] gap-2 px-2 py-1 bg-surface-deep border-b border-border text-2xs uppercase tracking-wider text-text-muted font-medium">
          <span>File</span>
          <span>Score</span>
          <span>Issues</span>
          <span>Churn</span>
          <span>Top Category</span>
          <span>Severity</span>
        </div>
        {backlog.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-6">
            No refactoring items — clean codebase!
          </div>
        ) : (
          backlog.map((item) => (
            <div
              key={item.file}
              className="grid grid-cols-[1fr_60px_50px_50px_80px_60px] gap-2 px-2 py-1.5 border-b border-border/40 last:border-b-0 text-xs hover:bg-surface-hover/30 transition-colors"
            >
              <span className="text-text font-mono truncate" title={item.file}>{item.file}</span>
              <div className="flex items-center gap-1">
                <div className="w-8 h-1 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f97316] transition-all"
                    style={{ width: `${(item.score / maxScore) * 100}%` }}
                  />
                </div>
                <span className="text-text font-mono">{item.score}</span>
              </div>
              <span className="text-text-muted font-mono">{item.antiPatterns}</span>
              <span className="text-text-muted font-mono">{item.churn}</span>
              <span className="text-2xs text-text-muted truncate">{CATEGORY_LABELS[item.topCategory]}</span>
              <SeverityBadge severity={item.severity} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
