'use client';

import { useMemo } from 'react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import type { ExtraTab } from '../shared/ReviewableModuleView';
import type { SubModuleId } from '@/types/modules';
import { Dna, ScanSearch } from 'lucide-react';
import { TelemetryEvolution } from './TelemetryEvolution';
import { ScanTab } from './ScanTab';
import { getUniqueTab } from './unique-tabs';

const CORE_ENGINE_ACCENT = MODULE_COLORS.core;

function buildExtraTabs(moduleId: SubModuleId): ExtraTab[] {
  const tabs: ExtraTab[] = [
    {
      id: 'scan',
      label: 'Scan',
      icon: ScanSearch,
      render: (mid) => <ScanTab moduleId={mid} />,
    },
  ];

  // Insert the unique domain-specific tab (between Scan and Evolution)
  const uniqueTab = getUniqueTab(moduleId);
  if (uniqueTab) {
    tabs.push(uniqueTab);
  }

  tabs.push({
    id: 'evolution',
    label: 'Evolution',
    icon: Dna,
    render: () => <TelemetryEvolution />,
  });

  return tabs;
}

interface GenreModuleViewProps {
  moduleId: SubModuleId;
}

export function GenreModuleView({ moduleId }: GenreModuleViewProps) {
  const genreModule = SUB_MODULE_MAP[moduleId];
  const extraTabs = useMemo(() => buildExtraTabs(moduleId), [moduleId]);

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
