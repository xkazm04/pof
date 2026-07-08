import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { ArcheologistAnalysis } from '@/types/codebase-archeologist';
import { scoreBandToken } from '@/lib/chart-colors';
import { SeverityBadge } from './SeverityBadge';

export function OverviewTab({ analysis }: { analysis: ArcheologistAnalysis }) {
  const healthScore = Math.max(0, 100 - analysis.bySeverity.critical * 15 - analysis.bySeverity.warning * 3 - analysis.bySeverity.info);
  const ringColor = scoreBandToken(healthScore).color;

  return (
    <div className="space-y-3">
      <SurfaceCard level={2} className="px-4 py-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={Math.round(healthScore)} size={56} color={ringColor} label="Code health score" />
          <div>
            <div className="text-sm font-semibold text-text">Code Health Score</div>
            <div className="text-xs text-text-muted mt-0.5">
              Based on {analysis.totalAntiPatterns} detected issues across {analysis.totalFiles} source files
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Top 5 refactoring items */}
      {analysis.refactoringBacklog.length > 0 && (
        <SurfaceCard level={2} className="px-3 py-2.5">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">Top Priority Files</div>
          <div className="space-y-1">
            {analysis.refactoringBacklog.slice(0, 5).map((item, i) => (
              <div key={item.file} className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-4 text-right font-mono">{i + 1}.</span>
                <span className="text-text font-mono truncate flex-1" title={item.file}>{item.file}</span>
                <SeverityBadge severity={item.severity} />
                <span className="text-text-muted font-mono text-2xs">score {item.score}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Shotgun surgeries preview */}
      {analysis.shotgunSurgeries.length > 0 && (
        <SurfaceCard level={2} className="px-3 py-2.5">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
            Shotgun Surgeries ({analysis.shotgunSurgeries.length} commits touching 10+ files)
          </div>
          <div className="space-y-1">
            {analysis.shotgunSurgeries.slice(0, 3).map((s) => (
              <div key={s.commit} className="flex items-center gap-2 text-xs">
                <span className="text-[#a78bfa] font-mono">{s.commit}</span>
                <span className="text-text-muted truncate flex-1">{s.message}</span>
                <span className="text-[#f97316] font-mono text-2xs">{s.filesChanged} files</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
