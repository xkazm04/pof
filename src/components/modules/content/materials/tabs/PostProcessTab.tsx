'use client';

import { useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/constants';
import type { PostProcessStackSpec } from '@/lib/post-process-studio/stack-spec';
import { PostProcessStackBuilder } from '../PostProcessStackBuilder';

/** The Post-Process tab, owning its own CLI session (see ConfiguratorTab). */
export function PostProcessTab() {
  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-postprocess',
    label: 'Post-Process Stack',
    accentColor: MODULE_COLORS.content,
  });

  // On the CLITask rail (same as ConfiguratorTab): prompt evolution can adopt a
  // variant for it and the inspector previews the exact string that dispatches.
  const handleGenerate = useCallback((spec: PostProcessStackSpec) => {
    void cli.execute(TaskFactory.postProcess('materials', spec, 'Post-Process Stack'));
  }, [cli]);

  return <PostProcessStackBuilder onGenerate={handleGenerate} isGenerating={cli.isRunning} />;
}
