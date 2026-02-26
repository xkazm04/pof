'use client';

import { Sparkle } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { GenerationPanel } from './GenerationPanel';
import { GenerationQueue } from './GenerationQueue';

function ForgeTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">AI 3D Generation</h2>
        <p className="text-xs text-text-muted mt-1">
          Generate 3D models from text prompts or reference images using AI
        </p>
      </div>
      <GenerationPanel />
      <GenerationQueue />
    </div>
  );
}

export function AssetForgeView() {
  const mod = SUB_MODULE_MAP['asset-forge'];
  const cat = getCategoryForSubModule('asset-forge');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Sparkle,
      render: () => <ForgeTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="asset-forge"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('asset-forge')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
