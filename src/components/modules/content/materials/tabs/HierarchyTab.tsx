'use client';

import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { MODULE_COLORS } from '@/lib/constants';
import { ChecklistUnconfirmedBanner } from '@/components/modules/shared/ChecklistUnconfirmedBanner';
import { MaterialLayerGraph } from '../MaterialLayerGraph';

/** The Hierarchy tab, owning its own checklist CLI session (see ConfiguratorTab). */
export function HierarchyTab() {
  const cli = useChecklistCLI({
    moduleId: 'materials',
    sessionKey: 'materials-graph',
    label: 'Material Graph',
    accentColor: MODULE_COLORS.content,
  });

  return (
    <div>
      <ChecklistUnconfirmedBanner cli={cli} />
      <MaterialLayerGraph
        onRunPrompt={cli.sendPrompt}
        isRunning={cli.isRunning}
        activeItemId={cli.activeItemId}
      />
    </div>
  );
}
