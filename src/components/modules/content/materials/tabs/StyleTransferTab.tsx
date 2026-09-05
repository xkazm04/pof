'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildStyleTransferPrompt } from '@/lib/prompts/style-transfer';
import { MODULE_COLORS } from '@/lib/constants';
import { MaterialStyleTransfer } from '../MaterialStyleTransfer';
import type { StyleTransferConfig } from '../MaterialStyleTransfer';

/** The Style tab, owning its own CLI session (see ConfiguratorTab). */
export function StyleTransferTab() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-style-transfer',
    label: 'Style Transfer',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerate = useCallback((config: StyleTransferConfig) => {
    cli.sendPrompt(buildStyleTransferPrompt(config, { projectName, projectPath, ueVersion }));
  }, [cli, projectName, projectPath, ueVersion]);

  return <MaterialStyleTransfer onGenerate={handleGenerate} isGenerating={cli.isRunning} />;
}
