'use client';

import { Send, BookOpen, Layers, SlidersHorizontal, CircleDot, ImagePlus } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';

import { ConfiguratorTab } from './tabs/ConfiguratorTab';
import { PatternsTab } from './tabs/PatternsTab';
import { PostProcessTab } from './tabs/PostProcessTab';
import { StyleTransferTab } from './tabs/StyleTransferTab';
import { HierarchyTab } from './tabs/HierarchyTab';
import { AskTab } from './tabs/AskTab';

/**
 * The Materials module shell.
 *
 * It holds NO CLI session and NO tab state of its own. Every tab body owns the
 * session it dispatches through (`tabs/*`), and `ReviewableModuleView` renders
 * exactly one body at a time, so a session's hook exists only while its tab is
 * open — where this view previously instantiated all six unconditionally at
 * mount, including on the default Overview tab, which uses none of them.
 *
 * `EXTRA_TABS` is module-level and therefore referentially stable: the render
 * functions are plain component references, so an unrelated parent re-render
 * reconciles each body instead of tearing it down.
 */
const EXTRA_TABS: ExtraTab[] = [
  { id: 'configurator', label: 'Configure', icon: CircleDot, render: () => <ConfiguratorTab /> },
  { id: 'catalog', label: 'Patterns', icon: BookOpen, render: () => <PatternsTab /> },
  { id: 'postprocess', label: 'Post-Process', icon: SlidersHorizontal, render: () => <PostProcessTab /> },
  { id: 'style-transfer', label: 'Style', icon: ImagePlus, render: () => <StyleTransferTab /> },
  { id: 'hierarchy', label: 'Hierarchy', icon: Layers, render: () => <HierarchyTab /> },
  { id: 'custom', label: 'Ask', icon: Send, render: () => <AskTab /> },
];

export function MaterialsView() {
  const mod = SUB_MODULE_MAP['materials'];
  const cat = getCategoryForSubModule('materials');
  if (!mod || !cat) return null;

  return (
    <ReviewableModuleView
      moduleId="materials"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('materials')}
      quickActions={mod.quickActions}
      extraTabs={EXTRA_TABS}
    />
  );
}
