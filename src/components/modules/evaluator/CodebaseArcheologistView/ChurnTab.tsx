import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FileChurn, ShotgunSurgery } from '@/types/codebase-archeologist';
import { STATUS_STALE } from '@/lib/chart-colors';

export function ChurnTab({ churn, surgeries }: { churn: FileChurn[]; surgeries: ShotgunSurgery[] }) {
  const maxCommits = churn.length > 0 ? churn[0].commits : 1;

  return (
    <div className="space-y-3">
      {/* File churn table */}
      <SurfaceCard level={2} className="px-3 py-2.5">
        <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
          Most Changed Files (by commit count)
        </div>
        {churn.length === 0 ? (
          <div className="text-xs text-text-muted py-4 text-center">No git history found</div>
        ) : (
          <div className="space-y-1">
            {churn.slice(0, 20).map((c) => (
              <div key={c.file} className="flex items-center gap-2 text-xs">
                <span className="text-text font-mono truncate flex-1" title={c.file}>{c.file}</span>
                <div className="w-24 h-1.5 rounded-full bg-surface-hover overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(c.commits / maxCommits) * 100}%`, backgroundColor: STATUS_STALE }}
                  />
                </div>
                <span className="text-text-muted font-mono w-8 text-right flex-shrink-0">{c.commits}</span>
                <span className="text-2xs text-text-muted flex-shrink-0">{c.authors} author{c.authors !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Shotgun surgeries */}
      <SurfaceCard level={2} className="px-3 py-2.5">
        <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
          Shotgun Surgeries (commits touching 10+ files)
        </div>
        {surgeries.length === 0 ? (
          <div className="text-xs text-text-muted py-4 text-center">No shotgun surgery patterns detected</div>
        ) : (
          <div className="space-y-1">
            {surgeries.map((s) => (
              <div key={s.commit} className="flex items-center gap-2 text-xs">
                <span className="text-[#a78bfa] font-mono flex-shrink-0">{s.commit}</span>
                <span className="text-text truncate flex-1">{s.message}</span>
                <span className="text-[#f97316] font-mono text-2xs flex-shrink-0">{s.filesChanged} files</span>
                <span className="text-2xs text-text-muted flex-shrink-0">
                  {s.date ? new Date(s.date).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
