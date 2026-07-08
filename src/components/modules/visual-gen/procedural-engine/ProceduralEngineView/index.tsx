'use client';

import { Cpu } from 'lucide-react';
import { ReviewableModuleView } from '../../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { GeneratorTab } from './GeneratorTab';

export function ProceduralEngineView() {
  const mod = SUB_MODULE_MAP['procedural-engine'];
  const cat = getCategoryForSubModule('procedural-engine');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'generator',
      label: 'Generator',
      icon: Cpu,
      render: () => <GeneratorTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="procedural-engine"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('procedural-engine')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
