'use client';

import { Network } from 'lucide-react';
import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import type { ExtraTab } from '../shared/ReviewableModuleView';
import {
  SUB_MODULE_MAP,
  getCategoryForSubModule,
  getModuleChecklist,
} from '@/lib/module-registry';
import { ReplicationScaffoldPanel } from './multiplayer/ReplicationScaffoldPanel';

export function MultiplayerView() {
  const mod = SUB_MODULE_MAP['multiplayer'];
  const cat = getCategoryForSubModule('multiplayer');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'replication',
      label: 'Replication',
      icon: Network,
      render: () => <ReplicationScaffoldPanel />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="multiplayer"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('multiplayer')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
