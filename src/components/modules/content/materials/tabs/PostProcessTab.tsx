'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildPostProcessPrompt } from '@/lib/prompts/post-process';
import { MODULE_COLORS } from '@/lib/constants';
import { PostProcessStackBuilder } from '../PostProcessStackBuilder';
import type { PostProcessStackConfig } from '../PostProcessStackBuilder';

/** The Post-Process tab, owning its own CLI session (see ConfiguratorTab). */
export function PostProcessTab() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-postprocess',
    label: 'Post-Process Stack',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerate = useCallback((config: PostProcessStackConfig) => {
    cli.sendPrompt(buildPostProcessPrompt(config, { projectName, projectPath, ueVersion }));
  }, [cli, projectName, projectPath, ueVersion]);

  return <PostProcessStackBuilder onGenerate={handleGenerate} isGenerating={cli.isRunning} />;
}
