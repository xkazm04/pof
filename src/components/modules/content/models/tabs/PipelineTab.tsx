'use client';

import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { ChecklistUnconfirmedBanner } from '@/components/modules/shared/ChecklistUnconfirmedBanner';
import { AssetPipelineDiagram } from '../AssetPipelineDiagram';

/**
 * The Asset Pipeline tab, owning its own checklist CLI session (the session hook
 * exists only while this tab is open). A stage run is `TaskFactory.checklist` on a
 * real `mod-*` id, so a confirmed callback ticks the same item the Roadmap shows.
 */
export function PipelineTab() {
  const cli = useChecklistCLI({
    moduleId: 'models',
    sessionKey: 'models-pipeline',
    label: 'Asset Pipeline',
    accentColor: ACCENT_VIOLET,
  });

  return (
    <div className="flex flex-col items-center pt-4">
      <h2 className="text-base font-semibold text-text mb-1">3D Asset Import Pipeline</h2>
      <p className="text-xs text-text-muted text-center max-w-sm mb-6">
        Work through each stage to set up your FBX/glTF import workflow.
      </p>
      <ChecklistUnconfirmedBanner cli={cli} />
      <AssetPipelineDiagram
        onRunPrompt={cli.sendPrompt}
        isRunning={cli.isRunning}
        activeItemId={cli.activeItemId}
      />
    </div>
  );
}
