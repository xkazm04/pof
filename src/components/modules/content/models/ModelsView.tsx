'use client';

import { Boxes, FolderSearch } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';

import { AssetInventory } from './AssetInventory';
import { PipelineTab } from './tabs/PipelineTab';

/**
 * The Models module shell. It holds NO CLI session: the Asset Pipeline tab body
 * owns the checklist session it dispatches through (`tabs/PipelineTab`), so the
 * hook exists only while that tab is open. `EXTRA_TABS` is module-level and
 * therefore referentially stable.
 */
const EXTRA_TABS: ExtraTab[] = [
  { id: 'inventory', label: 'Asset Inventory', icon: FolderSearch, render: () => <AssetInventory /> },
  { id: 'pipeline', label: 'Asset Pipeline', icon: Boxes, render: () => <PipelineTab /> },
];

export function ModelsView() {
  const mod = SUB_MODULE_MAP['models'];
  const cat = getCategoryForSubModule('models');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="models"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('models')}
      quickActions={mod.quickActions}
      extraTabs={EXTRA_TABS}
    />
  );
}
