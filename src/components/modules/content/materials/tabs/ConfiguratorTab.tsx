'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/constants';
import { MaterialParameterConfigurator } from '../MaterialParameterConfigurator';
import type { MaterialConfiguratorConfig } from '../MaterialParameterConfigurator';

/**
 * The Configure tab, owning its own CLI session.
 *
 * Each Materials tab body owns the session it dispatches through, instead of
 * MaterialsView instantiating all six at mount. `ReviewableModuleView` renders
 * exactly one tab body at a time, so the hook — and its store subscription —
 * exists only while its tab is open. Leaving the tab unmounts the HOOK, never
 * the CLI panel session it created (that lives in `cliPanelStore` and survives).
 */
export function ConfiguratorTab() {
  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-configurator',
    label: 'Material Config',
    accentColor: MODULE_COLORS.content,
  });

  // On the CLITask rail: the prompt is composed by `buildTaskPrompt` inside
  // `execute`, so prompt-evolution can resolve a variant for it, an A/B can test
  // it, and the inspector previews the exact string that dispatches. Never
  // `sendPrompt` with a hand-built prompt.
  const handleGenerate = useCallback((config: MaterialConfiguratorConfig) => {
    void cli.execute(TaskFactory.materialConfigurator('materials', config, 'Material Config'));
  }, [cli]);

  return <MaterialParameterConfigurator onGenerate={handleGenerate} isGenerating={cli.isRunning} />;
}
