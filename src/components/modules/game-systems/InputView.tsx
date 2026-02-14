'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';


export function InputView() {
  const mod = SUB_MODULE_MAP['input-handling'];
  const cat = getCategoryForSubModule('input-handling');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="input-handling"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('input-handling')}
      quickActions={mod.quickActions}
    />
  );
}
