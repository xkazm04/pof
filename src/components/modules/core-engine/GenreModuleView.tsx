'use client';

import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import type { ExtraTab } from '../shared/ReviewableModuleView';
import type { SubModuleId } from '@/types/modules';
import { ListOrdered, Dna } from 'lucide-react';
import { ImplementationPlan } from './ImplementationPlan';
import { TelemetryEvolution } from './TelemetryEvolution';

const CORE_ENGINE_ACCENT = '#3b82f6';

const extraTabs: ExtraTab[] = [
  {
    id: 'plan',
    label: 'Plan',
    icon: ListOrdered,
    render: () => <ImplementationPlan />,
  },
  {
    id: 'evolution',
    label: 'Evolution',
    icon: Dna,
    render: () => <TelemetryEvolution />,
  },
];

interface GenreModuleViewProps {
  moduleId: SubModuleId;
}

export function GenreModuleView({ moduleId }: GenreModuleViewProps) {
  const genreModule = SUB_MODULE_MAP[moduleId];

  if (!genreModule) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted">Module data not found.</p>
      </div>
    );
  }

  return (
    <ReviewableModuleView
      moduleId={moduleId}
      moduleLabel={genreModule.label}
      moduleDescription={genreModule.description}
      moduleIcon={genreModule.icon}
      accentColor={CORE_ENGINE_ACCENT}
      checklist={genreModule.checklist ?? []}
      quickActions={genreModule.quickActions}
      extraTabs={extraTabs}
    />
  );
}
