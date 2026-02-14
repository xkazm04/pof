'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';


export function SaveLoadView() {
  const mod = SUB_MODULE_MAP['save-load'];
  const cat = getCategoryForSubModule('save-load');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="save-load"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('save-load')}
      quickActions={mod.quickActions}
    />
  );
}
