'use client';

import { useCallback } from 'react';
import { Hammer, Loader2, Check } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { getAppOrigin } from '@/lib/constants';
import { ACCENT_ORANGE, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { PlaytestFinding } from '@/types/game-director';
import { buildFindingFixFeature, findingFixModuleId, findingFixSessionKey } from './findingFix';

const ACCENT = ACCENT_ORANGE;

interface FindingFixButtonProps {
  finding: PlaytestFinding;
  /**
   * Called immediately after the repair task is dispatched so the owner can
   * stamp the finding's `fixDispatchedAt` (tracking the detect→fix link).
   */
  onDispatched: (finding: PlaytestFinding) => void;
}

/**
 * "Fix this" CTA for a single playtest finding. One click assembles a
 * `TaskFactory.featureFix` task — pre-populated with the finding's title,
 * description, suggestedFix, relatedModule and gameTimestamp — and dispatches it
 * through {@link useModuleCLI}, attributed to the finding's most relevant
 * sub-module. Each finding gets its own CLI session so several repairs can run
 * in parallel. Turns the Game Director from a read-only critic into an
 * actionable detect → fix → verify loop.
 */
export function FindingFixButton({ finding, onDispatched }: FindingFixButtonProps) {
  const moduleId = findingFixModuleId(finding);

  const fixCli = useModuleCLI({
    moduleId,
    sessionKey: findingFixSessionKey(finding.id),
    label: `Fix: ${finding.title}`,
    accentColor: ACCENT,
  });

  const dispatched = finding.fixDispatchedAt != null;

  const handleFix = useCallback(() => {
    const task = TaskFactory.featureFix(
      moduleId,
      buildFindingFixFeature(finding),
      `Fix: ${finding.title}`,
      getAppOrigin(),
    );
    fixCli.execute(task);
    onDispatched(finding);
  }, [fixCli, moduleId, finding, onDispatched]);

  return (
    <div className="flex items-center gap-2">
      {dispatched && (
        <span
          className="inline-flex items-center gap-1 text-2xs text-text-muted"
          title={`Fix dispatched ${new Date(finding.fixDispatchedAt as string).toLocaleString()}`}
        >
          <Check className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
          Fix dispatched
        </span>
      )}
      <button
        onClick={handleFix}
        disabled={fixCli.isRunning}
        aria-label={`Fix this finding: ${finding.title}`}
        className="focus-ring inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-50"
        style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
      >
        {fixCli.isRunning ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        ) : (
          <Hammer className="w-3 h-3" aria-hidden="true" />
        )}
        {fixCli.isRunning ? 'Fixing…' : dispatched ? 'Fix again' : 'Fix this'}
      </button>
    </div>
  );
}
