'use client';

import { Settings, Layers, Zap, FileOutput, Boxes } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { AssetBrowser } from '@/components/modules/visual-gen/blender-pipeline/AssetBrowser';
import { PipelineTab } from './PipelineTab';
import { LODGenerationTab } from './LODGenerationTab';
import { MeshOptimizationTab } from './MeshOptimizationTab';
import { FBXConversionTab } from './FBXConversionTab';

export { LODGenerationTab } from './LODGenerationTab';
export { MeshOptimizationTab } from './MeshOptimizationTab';
export { FBXConversionTab } from './FBXConversionTab';

/* ─── Main View ─────────────────────────────────────────────────────────── */

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
    {
      id: 'asset-browser',
      label: 'Asset Browser',
      icon: Boxes,
      render: () => <AssetBrowser />,
    },
    {
      id: 'lod-gen',
      label: 'LOD Generation',
      icon: Layers,
      render: () => <LODGenerationTab />,
    },
    {
      id: 'mesh-opt',
      label: 'Mesh Optimization',
      icon: Zap,
      render: () => <MeshOptimizationTab />,
    },
    {
      id: 'fbx-conv',
      label: 'FBX Conversion',
      icon: FileOutput,
      render: () => <FBXConversionTab />,
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
