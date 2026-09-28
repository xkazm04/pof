import { ScanSearch } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { UnreviewedModule } from '@/types/marketplace';

// ── Unreviewed modules ──────────────────────────────────────────────────────
//
// Features with no review verdict are UNMEASURED, not missing: they are listed
// here apart from the gap recommendations, each module with a one-click review.
// The review is a CLI run, so it starts only from the button — never on render.

export function UnreviewedList({ unreviewed, totalUnreviewed, onReview, isReviewing, reviewingModuleId }: {
  unreviewed: UnreviewedModule[];
  totalUnreviewed: number;
  onReview: (module: UnreviewedModule) => void;
  isReviewing: boolean;
  reviewingModuleId: string | null;
}) {
  if (unreviewed.length === 0) return null;

  return (
    <SurfaceCard className="mb-4 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ScanSearch className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-sm font-medium text-text">Not yet reviewed</span>
        <Badge variant="default">{totalUnreviewed} features</Badge>
        <span className="text-2xs text-text-muted ml-auto">
          Unreviewed features are not counted as gaps. Review a module to find its real gaps.
        </span>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border">
        {unreviewed.map((m) => {
          const running = isReviewing && reviewingModuleId === m.moduleId;
          return (
            <li key={m.moduleId} data-testid={`scout-unreviewed-${m.moduleId}`} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-text truncate">{m.moduleLabel}</div>
                <div className="text-2xs text-text-muted truncate">
                  {m.featureNames.length} unreviewed · {m.featureNames.slice(0, 3).join(' · ')}
                  {m.featureNames.length > 3 && ` +${m.featureNames.length - 3} more`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onReview(m)}
                disabled={isReviewing}
                aria-label={`Review ${m.moduleLabel}`}
                className="px-2.5 py-1 rounded-md text-2xs font-medium border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {running ? 'Reviewing…' : 'Review module'}
              </button>
            </li>
          );
        })}
      </ul>
    </SurfaceCard>
  );
}
