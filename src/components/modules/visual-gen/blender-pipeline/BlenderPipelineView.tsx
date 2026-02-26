'use client';

import { Settings } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { BlenderSetup } from './BlenderSetup';
import { ScriptRunner } from './ScriptRunner';

function PipelineTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Blender Automation Pipeline</h2>
        <p className="text-xs text-text-muted mt-1">
          Headless Blender scripts for batch conversion, LOD generation, and mesh optimization
        </p>
      </div>
      <BlenderSetup />
      <ScriptRunner />
    </div>
  );
}

export function BlenderPipelineView() {
  const mod = SUB_MODULE_MAP['blender-pipeline'];
  const cat = getCategoryForSubModule('blender-pipeline');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: Settings,
      render: () => <PipelineTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="blender-pipeline"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('blender-pipeline')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
