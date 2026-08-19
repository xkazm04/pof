'use client';

import { Image as ImageIcon, Sparkle } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { TabHeader } from '../../shared/TabHeader';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { GenerationPanel } from './GenerationPanel';
import { GenerationQueue } from './GenerationQueue';
import { StyleDnaPanel } from './StyleDnaPanel';
import { Image2DPanel } from './Image2DPanel';

/**
 * The 2D face of the forge. Separate tab, not a mode of the 3D one: the two share
 * nothing but the word "generate" — different providers, different capability rules
 * (a 2D provider can be wired and still keyless), different output (an image file vs
 * a polled mesh job).
 */
function Image2DTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="AI 2D Image Generation"
        description="Turn a prompt into an image. Providers that this server holds no key for say so before you submit."
      />
      <Image2DPanel />
    </div>
  );
}

function ForgeTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="AI 3D Generation"
        description="Generate 3D models from text prompts or reference images using AI"
      />
      <StyleDnaPanel />
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
    {
      id: 'image-2d',
      label: '2D Image',
      icon: ImageIcon,
      render: () => <Image2DTab />,
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
