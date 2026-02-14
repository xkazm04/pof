'use client';

import { ReviewableModuleView } from '../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';


export function DialogueView() {
  const mod = SUB_MODULE_MAP['dialogue-quests'];
  const cat = getCategoryForSubModule('dialogue-quests');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="dialogue-quests"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('dialogue-quests')}
      quickActions={mod.quickActions}
    />
  );
}
