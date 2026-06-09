'use client';

import { FolderOpen, Library } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { TabHeader } from '@/components/modules/shared/TabHeader';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { BrowsePanel } from '@/components/modules/visual-gen/asset-browser/BrowsePanel';
import { LibraryPanel } from '@/components/modules/visual-gen/asset-browser/LibraryPanel';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';

function BrowseTab() {
  return (
    <div className="space-y-4">
      <BlenderConnectionBar />
      <TabHeader
        title="Free Asset Browser"
        description="Browse and download CC0-licensed 3D models, textures, HDRIs, and PBR materials"
      />
      <BrowsePanel />
    </div>
  );
}

function LibraryTab() {
  return (
    <div className="space-y-4">
      <TabHeader
        title="Asset Library"
        description="Everything you've downloaded — searchable, favoritable, and grouped into collections"
      />
      <LibraryPanel />
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
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      render: () => <LibraryTab />,
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
