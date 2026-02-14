'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import type { ExtraTab } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { History, Rocket } from 'lucide-react';
import { BuildHistoryDashboard } from './BuildHistoryDashboard';
import { BuildConfigSelector } from './BuildConfigSelector';

const extraTabs: ExtraTab[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: Rocket,
    render: () => <BuildConfigSelector />,
  },
  {
    id: 'builds',
    label: 'Builds',
    icon: History,
    render: () => <BuildHistoryDashboard />,
  },
];

export function PackagingView() {
  const mod = SUB_MODULE_MAP['packaging'];
  const cat = getCategoryForSubModule('packaging');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="packaging"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('packaging')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
