'use client';

import { FolderOpen } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { BrowsePanel } from '@/components/modules/visual-gen/asset-browser/BrowsePanel';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';

function BrowseTab() {
  return (
    <div className="space-y-4">
      <BlenderConnectionBar />
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Free Asset Browser</h2>
        <p className="text-xs text-text-muted mt-1">
          Browse and download CC0-licensed 3D models, textures, HDRIs, and PBR materials
        </p>
      </div>
      <BrowsePanel />
    </div>
  );
}

export function AssetBrowserView() {
  const mod = SUB_MODULE_MAP['asset-browser'];
  const cat = getCategoryForSubModule('asset-browser');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'browse',
      label: 'Browse',
      icon: FolderOpen,
      render: () => <BrowseTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="asset-browser"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('asset-browser')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
