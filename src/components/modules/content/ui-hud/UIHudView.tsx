'use client';

import { useState, useCallback } from 'react';
import { Grid3x3, Workflow } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildInventoryPrompt } from '@/lib/prompts/inventory';
import { buildMenuFlowPrompt } from '@/lib/prompts/menu-flow';
import { InventoryGridDesigner } from './InventoryGridDesigner';
import { MenuFlowDiagram } from './MenuFlowDiagram';
import type { InventoryConfig } from '@/lib/prompts/inventory';
import type { MenuFlowConfig } from './MenuFlowDiagram';

const CONTENT_ACCENT = '#f59e0b';

export function UIHudView() {
  const mod = SUB_MODULE_MAP['ui-hud'];
  const cat = getCategoryForSubModule('ui-hud');

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // ── CLI sessions ──

  const inventoryCli = useModuleCLI({
    moduleId: 'ui-hud',
    sessionKey: 'ui-hud-inventory',
    label: 'Inventory Gen',
    accentColor: CONTENT_ACCENT,
  });

  const menuFlowCli = useModuleCLI({
    moduleId: 'ui-hud',
    sessionKey: 'ui-hud-menuflow',
    label: 'Menu Flow Gen',
    accentColor: CONTENT_ACCENT,
  });

  // ── Handlers ──

  const handleGenerateInventory = useCallback((config: InventoryConfig) => {
    const prompt = buildInventoryPrompt(config, { projectName, projectPath, ueVersion });
    inventoryCli.sendPrompt(prompt);
  }, [inventoryCli, projectName, projectPath, ueVersion]);

  const handleGenerateMenuFlow = useCallback((config: MenuFlowConfig) => {
    const prompt = buildMenuFlowPrompt(config, { projectName, projectPath, ueVersion });
    menuFlowCli.sendPrompt(prompt);
  }, [menuFlowCli, projectName, projectPath, ueVersion]);

  if (!mod || !cat) return null;

  // ── Extra tabs ──

  const extraTabs: ExtraTab[] = [
    {
      id: 'menu-flow',
      label: 'Menu Flow',
      icon: Workflow,
      render: () => (
        <MenuFlowDiagram
          onGenerate={handleGenerateMenuFlow}
          isGenerating={menuFlowCli.isRunning}
        />
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory Designer',
      icon: Grid3x3,
      render: () => (
        <InventoryGridDesigner
          onGenerate={handleGenerateInventory}
          isGenerating={inventoryCli.isRunning}
        />
      ),
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="ui-hud"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('ui-hud')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
