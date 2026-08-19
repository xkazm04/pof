'use client';

import { useCallback } from 'react';
import { Compass, Play } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { AccentButton } from '@/components/ui/AccentButton';
import { NBAScoreBar } from '@/components/modules/shared/NBAScoreBar';
import { MatrixScopeBanner } from '@/components/modules/shared/FeatureMatrix/MatrixScopeBanner';
import { SUB_MODULE_MAP, getCategoryForSubModule } from '@/lib/module-registry';
import { nbaSuccessOdds } from '@/lib/nba-breakdown';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useNavigationStore } from '@/stores/navigationStore';
import type { NBARecommendation } from '@/lib/nba-engine';
import { useProjectNBA } from './useProjectNBA';

/**
 * "What should I do next *in this project*" — a ranking across every sub-module.
 *
 * The engine behind it ({@link computeProjectNBA}) has existed and been
 * unit-tested for a long time with no caller at all; this card is its first real
 * host. Every row NAMES its owning module, because a project-wide ranking whose
 * rows do not say where they live is unactionable.
 *
 * Reuses the per-module card's parts wholesale — `NBAScoreBar` /
 * `nbaFactorSegments` for the why, `MatrixScopeBanner` for the scope
 * disclosure, `useModuleCLI` + `TaskFactory.checklist` for the Run. There is no
 * second dispatch mechanism here.
 */
export function ProjectNBACard({ limit = 4 }: { limit?: number }) {
  const { recommendations, isLoading, scope, visibleRows } = useProjectNBA(limit);

  if (isLoading) {
    return (
      <SurfaceCard className="p-4 mb-6" data-testid="pof-project-nba">
        <Heading />
        <p className="mt-2 text-xs text-text-muted" role="status" aria-live="polite">
          Ranking work across every module…
        </p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="p-4 mb-6" data-testid="pof-project-nba">
      <Heading />

      {/* A project-wide ranking computed from a foreign-scoped status read must
          say so — same classifier, same words, as every other matrix consumer. */}
      <div className="mt-2">
        <MatrixScopeBanner scope={scope} visibleRows={visibleRows} testId="pof-project-nba-scope" />
      </div>

      {recommendations.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted" data-testid="pof-project-nba-empty">
          Nothing to rank yet — no module has an uncompleted checklist item in view.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recommendations.map((rec) => (
            <ProjectNBARow key={`${rec.moduleId}::${rec.item.id}`} rec={rec} />
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}

function Heading() {
  return (
    <div className="flex items-center gap-2">
      <Compass className="w-4 h-4 text-accent-setup" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-text">Next best action — whole project</h2>
      <MicroLabel>ranked across every module</MicroLabel>
    </div>
  );
}

/**
 * One ranked row.
 *
 * Owns its OWN `useModuleCLI` bound to the recommendation's module: the hook
 * pins moduleId/sessionKey at call time, so a single shared instance could not
 * dispatch into whichever module the user clicked. One component per row keeps
 * the hook count stable and needs no effect to fire the dispatch.
 */
function ProjectNBARow({ rec }: { rec: NBARecommendation }) {
  const mod = SUB_MODULE_MAP[rec.moduleId as keyof typeof SUB_MODULE_MAP];
  const moduleLabel = mod?.label ?? rec.moduleId;
  const accentColor = getCategoryForSubModule(rec.moduleId)?.accentColor ?? MODULE_COLORS.setup;
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const odds = nbaSuccessOdds(rec);

  const cli = useModuleCLI({
    moduleId: rec.moduleId,
    sessionKey: `project-nba-${rec.moduleId}`,
    label: moduleLabel,
    accentColor,
  });

  const handleRun = useCallback(() => {
    // Take the user to the module that owns the work, then dispatch the very
    // same checklist task its own Roadmap tab would have dispatched.
    navigateToModule(rec.moduleId);
    const task = TaskFactory.checklist(
      rec.moduleId, rec.item.id, rec.item.prompt, moduleLabel, getAppOrigin(),
    );
    void cli.execute(task);
  }, [navigateToModule, rec.moduleId, rec.item.id, rec.item.prompt, moduleLabel, cli]);

  return (
    <li
      data-testid="pof-project-nba-row"
      data-module={rec.moduleId}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-border bg-surface"
    >
      <span
        className="flex-shrink-0 mt-0.5 text-2xs font-mono font-medium w-7 text-center rounded py-0.5"
        style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
      >
        {rec.score}
      </span>
      <div className="flex-1 min-w-0">
        {/* The owning module, named on every row. */}
        <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
          {moduleLabel}
        </span>
        <p className="text-xs font-medium text-text mt-0.5">{rec.item.label}</p>
        <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">{rec.reason}</p>
        <NBAScoreBar rec={rec} />
        <p className="mt-1 text-2xs text-text-muted" data-odds-source={rec.successEvidence.source}>
          {odds.pct === null ? odds.note : `${odds.pct}% — ${odds.note}`}
        </p>
      </div>
      <AccentButton
        onClick={handleRun}
        disabled={cli.isRunning}
        accentColor={accentColor}
        size="sm"
        className="flex-shrink-0"
        leftIcon={<Play className="w-3.5 h-3.5" />}
      >
        Run
      </AccentButton>
    </li>
  );
}
