'use client';

import { useMemo, useCallback } from 'react';
import { Boxes, FolderSearch } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { AssetPipelineDiagram } from './AssetPipelineDiagram';
import { AssetInventory } from './AssetInventory';

const STAGE_PREFIX = 'pipeline-';

export function ModelsView() {
  const mod = SUB_MODULE_MAP['models'];
  const cat = getCategoryForSubModule('models');

  const checklistProgress = useModuleStore((s) => s.checklistProgress['models']);
  const projectPath = useProjectStore((s) => s.projectPath);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const findSessionByModule = useCLIPanelStore((s) => s.findSessionByModule);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);

  const completedStages = useMemo(() => {
    const set = new Set<string>();
    if (checklistProgress) {
      for (const [key, done] of Object.entries(checklistProgress)) {
        if (done && key.startsWith(STAGE_PREFIX)) {
          set.add(key.slice(STAGE_PREFIX.length));
        }
      }
    }
    return set;
  }, [checklistProgress]);

  const sendPrompt = useCallback((prompt: string) => {
    let tabId = findSessionByModule('models');
    const isNew = !tabId;
    if (!tabId) {
      tabId = createSession({
        label: '3D Models & Characters',
        accentColor: ACCENT_VIOLET,
        moduleId: 'models',
        projectPath,
      });
    }
    setActiveTab(tabId);

    const dispatch = () => {
      window.dispatchEvent(
        new CustomEvent('pof-cli-prompt', {
          detail: { tabId, prompt },
        })
      );
    };
    if (isNew) setTimeout(dispatch, 150);
    else dispatch();
  }, [findSessionByModule, createSession, setActiveTab, projectPath]);

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'inventory',
      label: 'Asset Inventory',
      icon: FolderSearch,
      render: () => <AssetInventory />,
    },
    {
      id: 'pipeline',
      label: 'Asset Pipeline',
      icon: Boxes,
      render: () => (
        <div className="flex flex-col items-center pt-4">
          <h2 className="text-base font-semibold text-text mb-1">
            3D Asset Import Pipeline
          </h2>
          <p className="text-xs text-text-muted text-center max-w-sm mb-6">
            Work through each stage to set up your FBX/glTF import workflow.
          </p>
          <AssetPipelineDiagram
            completedStages={completedStages}
            onRunPrompt={sendPrompt}
            isRunning={false}
          />
        </div>
      ),
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="models"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('models')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
