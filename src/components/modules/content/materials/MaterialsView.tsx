'use client';

import { useState, useCallback } from 'react';
import { Send, BookOpen, Layers, SlidersHorizontal, CircleDot, ImagePlus } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule , getModuleChecklist } from '@/lib/module-registry';

import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useProjectStore } from '@/stores/projectStore';
import { TaskFactory } from '@/lib/cli-task';
import { buildMaterialPatternPrompt } from '@/lib/prompts/material-patterns';
import { buildPostProcessPrompt } from '@/lib/prompts/post-process';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import { buildStyleTransferPrompt } from '@/lib/prompts/style-transfer';
import { MaterialLayerGraph } from './MaterialLayerGraph';
import { MaterialPatternCatalog } from './MaterialPatternCatalog';
import { PostProcessStackBuilder } from './PostProcessStackBuilder';
import { MaterialParameterConfigurator } from './MaterialParameterConfigurator';
import { MaterialStyleTransfer } from './MaterialStyleTransfer';
import type { MaterialPattern } from './MaterialPatternCatalog';
import type { PostProcessStackConfig } from './PostProcessStackBuilder';
import type { MaterialConfiguratorConfig } from './MaterialParameterConfigurator';
import type { StyleTransferConfig } from './MaterialStyleTransfer';

const CONTENT_ACCENT = '#f59e0b';

export function MaterialsView() {
  const mod = SUB_MODULE_MAP['materials'];
  const cat = getCategoryForSubModule('materials');

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [customPrompt, setCustomPrompt] = useState('');

  // ── Graph CLI session ──

  const graphCli = useChecklistCLI({
    moduleId: 'materials',
    sessionKey: 'materials-graph',
    label: 'Material Graph',
    accentColor: CONTENT_ACCENT,
  });

  // ── Configurator CLI session ──

  const configuratorCli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-configurator',
    label: 'Material Config',
    accentColor: CONTENT_ACCENT,
  });

  const handleGenerateConfigured = useCallback((config: MaterialConfiguratorConfig) => {
    const prompt = buildMaterialConfiguratorPrompt(config, { projectName, projectPath, ueVersion });
    configuratorCli.sendPrompt(prompt);
  }, [configuratorCli, projectName, projectPath, ueVersion]);

  // ── Catalog CLI session ──

  const catalogCli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-catalog',
    label: 'Material Pattern',
    accentColor: CONTENT_ACCENT,
  });

  const handleGeneratePattern = useCallback((pattern: MaterialPattern) => {
    const prompt = buildMaterialPatternPrompt(pattern, { projectName, projectPath, ueVersion });
    catalogCli.sendPrompt(prompt);
  }, [catalogCli, projectName, projectPath, ueVersion]);

  // ── Post-Process CLI session ──

  const postProcessCli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-postprocess',
    label: 'Post-Process Stack',
    accentColor: CONTENT_ACCENT,
  });

  const handleGeneratePostProcess = useCallback((config: PostProcessStackConfig) => {
    const prompt = buildPostProcessPrompt(config, { projectName, projectPath, ueVersion });
    postProcessCli.sendPrompt(prompt);
  }, [postProcessCli, projectName, projectPath, ueVersion]);

  // ── Style Transfer CLI session ──

  const styleTransferCli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-style-transfer',
    label: 'Style Transfer',
    accentColor: CONTENT_ACCENT,
  });

  const handleGenerateStyleTransfer = useCallback((config: StyleTransferConfig) => {
    const prompt = buildStyleTransferPrompt(config, { projectName, projectPath, ueVersion });
    styleTransferCli.sendPrompt(prompt);
  }, [styleTransferCli, projectName, projectPath, ueVersion]);

  // ── Custom prompt ──

  const customCli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-custom',
    label: 'Materials',
    accentColor: CONTENT_ACCENT,
  });

  const handleCustomPrompt = useCallback(() => {
    if (!customPrompt.trim()) return;
    const task = TaskFactory.askClaude('materials', customPrompt.trim(), 'Materials');
    customCli.execute(task);
    setCustomPrompt('');
  }, [customPrompt, customCli]);

  if (!mod || !cat) return null;

  // ── Extra tabs ──

  const extraTabs: ExtraTab[] = [
    {
      id: 'configurator',
      label: 'Configure',
      icon: CircleDot,
      render: () => (
        <MaterialParameterConfigurator
          onGenerate={handleGenerateConfigured}
          isGenerating={configuratorCli.isRunning}
        />
      ),
    },
    {
      id: 'catalog',
      label: 'Patterns',
      icon: BookOpen,
      render: () => (
        <MaterialPatternCatalog
          onGenerate={handleGeneratePattern}
          isGenerating={catalogCli.isRunning}
        />
      ),
    },
    {
      id: 'postprocess',
      label: 'Post-Process',
      icon: SlidersHorizontal,
      render: () => (
        <PostProcessStackBuilder
          onGenerate={handleGeneratePostProcess}
          isGenerating={postProcessCli.isRunning}
        />
      ),
    },
    {
      id: 'style-transfer',
      label: 'Style',
      icon: ImagePlus,
      render: () => (
        <MaterialStyleTransfer
          onGenerate={handleGenerateStyleTransfer}
          isGenerating={styleTransferCli.isRunning}
        />
      ),
    },
    {
      id: 'hierarchy',
      label: 'Hierarchy',
      icon: Layers,
      render: () => (
        <MaterialLayerGraph
          onRunPrompt={graphCli.sendPrompt}
          isRunning={graphCli.isRunning}
          activeItemId={graphCli.activeItemId}
        />
      ),
    },
    {
      id: 'custom',
      label: 'Ask',
      icon: Send,
      render: () => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-text-muted" />
            <h3 className="text-xs font-medium text-text">Ask Claude</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
              placeholder="Ask about materials, shaders, post-process..."
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={!customPrompt.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: `${CONTENT_ACCENT}15`, color: CONTENT_ACCENT, border: `1px solid ${CONTENT_ACCENT}30` }}
            >
              Send
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="materials"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('materials')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
