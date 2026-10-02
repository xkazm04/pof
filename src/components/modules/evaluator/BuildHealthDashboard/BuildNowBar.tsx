import { Hammer, Square } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL, withOpacity, OPACITY_15,
} from '@/lib/chart-colors';
import {
  defaultBuildRequest, editorTargetLabel, isRunActive,
  type BuildProject, type BuildRunState,
} from '@/lib/ue5-bridge/build-run';
import { ACCENT } from './constants';

/** One line saying where the current run is — never a bare spinner. */
function runLine(s: BuildRunState): { text: string; color: string } | null {
  switch (s.phase) {
    case 'idle':
      return null;
    case 'dispatching':
      return { text: 'Dispatching…', color: STATUS_NEUTRAL };
    case 'queued':
      return { text: 'Queued — waiting for the running build', color: STATUS_NEUTRAL };
    case 'running':
      return {
        text: `Running${s.percent != null ? ` ${s.percent}%` : ''}${s.message ? ` · ${s.message}` : ''}`,
        color: ACCENT,
      };
    case 'settled':
      return s.status === 'success'
        ? { text: 'Build succeeded', color: STATUS_SUCCESS }
        : {
            text: s.status === 'aborted'
              ? 'Build aborted'
              : `Build failed — ${s.errorCount} error${s.errorCount !== 1 ? 's' : ''} (see Recurring Build Errors)`,
            color: STATUS_ERROR,
          };
    case 'lost':
      return { text: s.reason, color: STATUS_WARNING };
    case 'rejected':
      return { text: `Not started: ${s.reason}`, color: STATUS_ERROR };
  }
}

export function BuildNowBar({ project, state, onBuild, onAbort }: {
  project: BuildProject;
  state: BuildRunState;
  onBuild: () => void;
  onAbort: () => void;
}) {
  const request = defaultBuildRequest(project);
  const active = isRunActive(state);
  const line = runLine(state);
  const label = project.projectName ? `Build ${editorTargetLabel(project.projectName)}` : 'Build';

  return (
    <div className="flex items-center gap-2 min-w-0">
      {line && (
        <div data-testid="build-run-status" role="status" className="flex items-center gap-2 min-w-0 text-2xs">
          {state.phase === 'running' && state.percent != null && (
            <span className="w-16 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_15) }}>
              <span className="block h-full" style={{ width: `${state.percent}%`, backgroundColor: ACCENT }} />
            </span>
          )}
          <span className="truncate font-mono" style={{ color: line.color }} title={line.text}>{line.text}</span>
        </div>
      )}
      {(state.phase === 'queued' || state.phase === 'running') && (
        <button
          onClick={onAbort}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover"
        >
          <Square className="w-3 h-3" /> Abort
        </button>
      )}
      <button
        onClick={onBuild}
        disabled={active || !request.ok}
        title={request.ok ? 'Headless UBT build: Editor target, Development, Win64' : request.error}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0"
        style={{ color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_15)}` }}
      >
        <Hammer className="w-3.5 h-3.5" />
        {label}
      </button>
    </div>
  );
}
