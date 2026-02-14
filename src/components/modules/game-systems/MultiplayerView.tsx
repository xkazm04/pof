'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';


export function MultiplayerView() {
  const mod = SUB_MODULE_MAP['multiplayer'];
  const cat = getCategoryForSubModule('multiplayer');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="multiplayer"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('multiplayer')}
      quickActions={mod.quickActions}
    />
  );
}
