'use client';

import { Layers } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import {
  SUB_MODULE_MAP,
  getCategoryForSubModule,
  getModuleChecklist,
} from '@/lib/module-registry';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { SceneTree } from './SceneTree';
import { SceneExporter } from './SceneExporter';
import { useSceneComposerStore } from './useSceneComposerStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useSuspendableEffect } from '@/hooks/useSuspend';

function ComposerTab() {
  const { connection } = useBlenderMCPStore();
  const { refreshScene } = useSceneComposerStore();

  useSuspendableEffect(() => {
    if (connection.connected) refreshScene();
  }, [connection.connected, refreshScene]);

  return (
    <div className="space-y-4">
      <BlenderConnectionBar />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <h3 className="text-xs font-medium text-text mb-2">
              Scene Tree
            </h3>
            <SceneTree />
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <h3 className="text-xs font-medium text-text mb-2">Export</h3>
            <SceneExporter />
          </div>
        </div>
        <ViewportPreview />
      </div>
    </div>
  );
}

export function SceneComposerView() {
  const mod = SUB_MODULE_MAP['scene-composer'];
  const cat = getCategoryForSubModule('scene-composer');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'composer',
      label: 'Composer',
      icon: Layers,
      render: () => <ComposerTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="scene-composer"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('scene-composer')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
