import { Gavel } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MeterBar } from '@/components/ui/MeterBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { Badge } from '@/components/ui/Badge';
import { successRateColor } from '@/lib/chart-colors';
import type { PromptVersionFitness } from '@/types/prompt-evolution';
import { ACCENT } from './constants';
import type { ViewMode } from './constants';

/**
 * Per-prompt-version judge quality — the read-back side of the `PROMPT_VERSION` stamp.
 *
 * Each row is one quality-pack version with the mean judge score of the artifacts it
 * produced. A version nobody has judged yet renders an explicit **unjudged** state with no
 * bar at all — never a 0% bar, which would read as "the judges hated it" when the truth is
 * "no judge has looked". Adoption stays manual: this informs, it never picks.
 */
export function JudgeFitnessStrip({
  fitness,
  mode,
}: {
  fitness: PromptVersionFitness[];
  mode: ViewMode;
}) {
  if (fitness.length === 0) return null;

  return (
    <SurfaceCard level={2} className="p-4">
      <h3 className="text-xs font-medium text-text mb-1 flex items-center gap-1.5">
        <Gavel className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        {mode === 'simple' ? 'Prompt quality (reviewed work)' : 'Judge quality by prompt version'}
      </h3>
      <MicroLabel as="p" className="mb-3">
        {mode === 'simple'
          ? 'How the work each prompt version produced scored when it was reviewed.'
          : 'Mean judge score of the artifacts each quality-pack version produced (judge_verdicts ⋈ pipeline_artifacts).'}
      </MicroLabel>

      <div className="space-y-2">
        {fitness.map((f, i) => (
          <div
            key={f.promptVersion}
            data-testid={`judge-fitness-${f.promptVersion}`}
            className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0"
          >
            <span className="text-xs text-text w-16 truncate font-medium">{f.promptVersion}</span>
            {f.isCurrent && <Badge variant="default">current</Badge>}

            {f.avgScore === null ? (
              // Honest unknown — no meter, because there is no measurement to draw.
              <MicroLabel tone="muted" className="flex-1">
                unjudged — {f.producedArtifacts} artifact{f.producedArtifacts === 1 ? '' : 's'} produced,
                none reviewed yet
              </MicroLabel>
            ) : (
              <>
                <MeterBar
                  value={f.avgScore}
                  color={successRateColor}
                  delayMs={i * 50}
                  className="flex-1"
                  ariaLabel={`${f.promptVersion} mean judge score`}
                  valueText={`${Math.round(f.avgScore)} out of 100 across ${f.verdicts} verdicts`}
                />
                <span className="text-xs text-text w-10 text-right tabular-nums">
                  {Math.round(f.avgScore)}
                </span>
                <MicroLabel mono className="w-24 text-right">
                  {f.judgedArtifacts}/{f.producedArtifacts} judged
                </MicroLabel>
                {mode === 'advanced' && f.passRate !== null && (
                  <MicroLabel mono className="w-16 text-right">
                    {Math.round(f.passRate * 100)}% pass
                  </MicroLabel>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
