'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildMaterialPatternPrompt } from '@/lib/prompts/material-patterns';
import { MODULE_COLORS } from '@/lib/constants';
import { MaterialPatternCatalog } from '../MaterialPatternCatalog';
import type { MaterialPattern } from '../MaterialPatternCatalog';

/** The Patterns tab, owning its own CLI session (see ConfiguratorTab). */
export function PatternsTab() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-catalog',
    label: 'Material Pattern',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerate = useCallback((pattern: MaterialPattern) => {
    cli.sendPrompt(buildMaterialPatternPrompt(pattern, { projectName, projectPath, ueVersion }));
  }, [cli, projectName, projectPath, ueVersion]);

  return <MaterialPatternCatalog onGenerate={handleGenerate} isGenerating={cli.isRunning} />;
}
