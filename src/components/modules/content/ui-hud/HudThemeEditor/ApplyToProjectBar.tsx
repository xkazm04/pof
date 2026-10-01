'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';
import { MODULE_COLORS } from '@/lib/constants';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { buildHudThemeApplyPrompt } from '@/lib/prompts/hud-theme';
import { HUD_THEME_PARAMS } from './themeSchema';
import { diffThemeExport, applyStatus } from './themeDiff';
import type { HudTheme } from './types';

export const THEME_APPLY_SESSION_KEY = 'ui-hud-theme';

const NO_OUTCOME = 'The apply run ended without a reported outcome. Nothing was marked applied.';

const findApplySession = (sessions: ReturnType<typeof useCLIPanelStore.getState>['sessions']) =>
  Object.values(sessions).find((s) => s.sessionKey === THEME_APPLY_SESSION_KEY);

/**
 * Settles a pending apply from the apply session's run state, not from a callback
 * held by this component: ReviewableModuleView unmounts the tab, so a run that ends
 * while the designer looks elsewhere is settled when the bar mounts again. The run
 * is the first one with a runSeq above the one recorded at dispatch.
 */
function useSettleApply(projectPath: string) {
  const pending = useHudDesignStore((s) => s.byProject[projectPath]?.pendingApply);
  const session = useCLIPanelStore((s) => findApplySession(s.sessions));
  const commitApply = useHudDesignStore((s) => s.commitApply);
  useEffect(() => {
    if (!pending || !session || session.isRunning) return;
    if ((session.runSeq ?? 0) <= pending.runSeqBefore) return;
    const success = session.lastTaskSuccess;
    commitApply(projectPath, success === true, success === null ? NO_OUTCOME : undefined);
  }, [pending, session, projectPath, commitApply]);
  return pending;
}

/** "Apply to project": sends only the rows changed since the last successful apply. */
export function ApplyToProjectBar({ projectPath, theme }: { projectPath: string; theme: HudTheme }) {
  const design = useHudDesignStore((s) => s.byProject[projectPath]);
  const beginApply = useHudDesignStore((s) => s.beginApply);
  const pending = useSettleApply(projectPath);
  const cli = useModuleCLI({
    moduleId: 'ui-hud',
    sessionKey: THEME_APPLY_SESSION_KEY,
    label: 'HUD Theme Apply',
    accentColor: MODULE_COLORS.content,
  });

  const applied = design?.themeApplied ?? null;
  const changes = useMemo(() => diffThemeExport(applied, theme), [applied, theme]);
  const status = applyStatus({ pending: changes.length, running: cli.isRunning || !!pending });
  const noProject = !projectPath;

  const handleApply = useCallback(() => {
    if (noProject || changes.length === 0) return;
    const { projectName, ueVersion } = useProjectStore.getState();
    const prompt = buildHudThemeApplyPrompt(changes, { projectName, projectPath, ueVersion });
    const before = findApplySession(useCLIPanelStore.getState().sessions)?.runSeq ?? 0;
    beginApply(projectPath, theme, before);
    cli.sendPrompt(prompt);
  }, [noProject, changes, projectPath, theme, beginApply, cli]);

  const color = changes.length === 0 ? STATUS_SUCCESS : MODULE_COLORS.content;
  const Icon = pending || cli.isRunning ? Loader2 : changes.length === 0 ? CheckCircle2 : Upload;

  return (
    <SurfaceCard level={2} className="p-3 space-y-2" data-testid="hud-theme-apply">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-text-muted uppercase">Apply to project</div>
          <p className="text-2xs text-text-muted">
            {noProject
              ? 'Open a project to apply the theme to its widget classes.'
              : applied
                ? 'Sends only the UPROPERTYs changed since the last successful apply.'
                : `Not applied from PoF yet: the first apply sends all ${HUD_THEME_PARAMS.length} UPROPERTYs.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={status.disabled || noProject}
          className="focus-ring shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold rounded-md border transition-colors disabled:opacity-60"
          style={{ borderColor: color, color, backgroundColor: `${color}${OPACITY_10}` }}
        >
          <Icon className={`w-3.5 h-3.5${pending || cli.isRunning ? ' animate-spin' : ''}`} aria-hidden="true" />
          {status.label}
        </button>
      </div>
      {changes.length > 0 && applied && (
        <ul className="flex flex-wrap gap-1" aria-label="Changed since last apply">
          {changes.map((c) => (
            <li key={c.name} title={`${c.from ?? ''} -> ${c.to}`}
              className="px-1.5 py-0.5 text-2xs font-mono rounded border border-border/60 text-text">
              {c.name}
            </li>
          ))}
        </ul>
      )}
      {design?.lastApplyError && !pending && (
        <div role="alert" className="text-2xs" style={{ color: STATUS_ERROR }}>{design.lastApplyError}</div>
      )}
      {pending && (
        <div role="status" className="text-2xs" style={{ color: STATUS_WARNING }}>
          Applying {pending.snapshot === theme ? 'the current theme' : 'the theme as it was when you clicked'}. The baseline moves only when the run succeeds.
        </div>
      )}
    </SurfaceCard>
  );
}
