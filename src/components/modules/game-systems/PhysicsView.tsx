'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';


export function PhysicsView() {
  const mod = SUB_MODULE_MAP['physics'];
  const cat = getCategoryForSubModule('physics');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="physics"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('physics')}
      quickActions={mod.quickActions}
    />
  );
}
