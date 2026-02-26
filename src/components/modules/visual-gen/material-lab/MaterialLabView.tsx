'use client';

import dynamic from 'next/dynamic';
import { Paintbrush } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { PBREditor } from './PBREditor';
import { useMaterialStore } from './useMaterialStore';

const MaterialPreview = dynamic(
  () => import('./MaterialPreview').then((mod) => ({ default: mod.MaterialPreview })),
  { ssr: false },
);

function EditorTab() {
  const params = useMaterialStore((s) => s.params);
  const previewMesh = useMaterialStore((s) => s.previewMesh);
  const albedoTexture = useMaterialStore((s) => s.albedoTexture);

  return (
    <div className="flex gap-4 h-full">
      {/* Left: PBR Editor controls */}
      <div className="w-72 shrink-0 overflow-y-auto pr-2">
        <PBREditor />
      </div>

      {/* Right: Live 3D preview */}
      <div className="flex-1 min-w-0 min-h-[400px]">
        <MaterialPreview
          params={params}
          previewMesh={previewMesh}
          albedoTexture={albedoTexture}
        />
      </div>
    </div>
  );
}

export function MaterialLabView() {
  const mod = SUB_MODULE_MAP['material-lab'];
  const cat = getCategoryForSubModule('material-lab');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'editor',
      label: 'Editor',
      icon: Paintbrush,
      render: () => <EditorTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="material-lab"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('material-lab')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
