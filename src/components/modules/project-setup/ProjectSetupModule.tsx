'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Rocket } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectScan } from './useProjectScan';
import { StatusChecklist } from './StatusChecklist';
import { NextStepBanner } from './NextStepBanner';
import { CreateProjectPanel } from './CreateProjectPanel';
import { ProjectFilesPanel } from './ProjectFilesPanel';
import { BuildVerifyPanel } from './BuildVerifyPanel';
import { ToolingBootstrapPanel } from './ToolingBootstrapPanel';
import { ManifestPreview } from './ManifestPreview';
import { deriveNextStep, type NextStepId } from './nextStep';
import { buildCreateProjectPrompt, buildBuildVerifyPrompt } from './prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';

export function ProjectSetupModule() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // Ref for scan callback â€” allows hooks to call scan() without circular dependency
  const scanRef = useRef<() => void>(() => {});

  const setupCLI = useModuleCLI({
    moduleId: 'project-setup' as unknown as SubModuleId,
    sessionKey: 'project-setup',
    label: 'Project Setup',
    accentColor: MODULE_COLORS.setup,
    onComplete: () => scanRef.current(),
  });

  const buildCLI = useModuleCLI({
    moduleId: 'project-setup' as unknown as SubModuleId,
    sessionKey: 'project-build-verify',
    label: 'Build & Verify',
    accentColor: MODULE_COLORS.content,
    onComplete: () => scanRef.current(),
  });

  const bootstrapCLI = useModuleCLI({
    moduleId: 'project-setup' as unknown as SubModuleId,
    sessionKey: 'project-bootstrap',
    label: 'Install Tools',
    accentColor: MODULE_COLORS.core,
    onComplete: () => scanRef.current(),
  });

  const {
    engines,
    checklist,
    projectFiles,
    scanning,
    scanState,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  } = useProjectScan(projectPath);

  // Wire scanRef so the hooks' onComplete can call scan() without circular deps
  useEffect(() => { scanRef.current = scan; }, [scan]);

  const [manifestJson, setManifestJson] = useState<string | null>(null);

  const handleFixAllMissing = useCallback(async () => {
    try {
      const data = await apiFetch<{ allInstalled: boolean; prompt: string }>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-bootstrap' }),
      });
      if (data.allInstalled) return;
      bootstrapCLI.sendPrompt(data.prompt);
    } catch {
      // Non-critical
    }
  }, [bootstrapCLI]);

  const openInExplorer = useCallback(() => {
    setupCLI.sendPrompt(`Open the folder "${projectPath}" in Windows Explorer.`);
  }, [setupCLI, projectPath]);

  // The single "do this next" action, derived from scan truth. Only shown once
  // a project path is configured (i.e. after the setup wizard).
  const nextStep = useMemo(
    () => (projectPath.trim() ? deriveNextStep({ missingToolCount, hasProject }) : null),
    [projectPath, missingToolCount, hasProject],
  );

  const handleNextStepAction = useCallback(() => {
    if (!nextStep) return;
    if (nextStep.id === 'install-tools') {
      handleFixAllMissing();
    } else if (nextStep.id === 'create-project') {
      setupCLI.sendPrompt(buildCreateProjectPrompt({ projectName, projectPath, ueVersion }));
    } else {
      buildCLI.sendPrompt(buildBuildVerifyPrompt({ projectName, projectPath, ueVersion, engines }));
    }
  }, [nextStep, handleFixAllMissing, setupCLI, buildCLI, projectName, projectPath, ueVersion, engines]);

  const nextStepLoading =
    nextStep?.id === 'install-tools' ? bootstrapCLI.isRunning :
    nextStep?.id === 'create-project' ? setupCLI.isRunning :
    nextStep?.id === 'build-verify' ? buildCLI.isRunning : false;

  const nextStepDisabled =
    nextStep?.id === 'install-tools' ? scanning :
    nextStep?.id === 'create-project' ? (!projectName.trim() || engines.length === 0) :
    nextStep?.id === 'build-verify' ? engines.length === 0 : false;

  // De-emphasize every panel except the one matching the suggested next step.
  const dimUnless = (stepId: NextStepId) =>
    nextStep && nextStep.id !== stepId ? 'opacity-50 transition-opacity duration-base' : '';

  return (
    <div className="flex h-full">
      {/* Left rail â€” status checklist */}
      <StatusChecklist
        checklist={checklist}
        scanning={scanning}
        okCount={okCount}
        missingToolCount={missingToolCount}
        isBootstrapping={bootstrapCLI.isRunning}
        onScan={scan}
        onFixAllMissing={handleFixAllMissing}
        onBootstrapFromManifest={bootstrapCLI.sendPrompt}
        onManifestExported={setManifestJson}
      />

      {/* Main content */}
      <div
        className="flex-1 overflow-y-auto p-6"
        data-testid="pof-project-setup-content"
        data-scan-state={scanState}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Rocket className="w-6 h-6 text-accent-setup" />
          <h1 className="text-xl font-semibold text-text">Project Setup</h1>
        </div>
        <p className="text-sm text-text-muted mb-6">
          Create and configure your Unreal Engine project
        </p>

        {/* Guided next step — the one calm "do this next" for the whole module */}
        {nextStep && (
          <NextStepBanner
            step={nextStep}
            onAction={handleNextStepAction}
            loading={nextStepLoading}
            disabled={nextStepDisabled}
          />
        )}

        {/* Create Project */}
        {!hasProject && projectPath.trim() && (
          <div className={dimUnless('create-project')}>
            <CreateProjectPanel
              engines={engines}
              isRunning={setupCLI.isRunning}
              onSendPrompt={setupCLI.sendPrompt}
            />
          </div>
        )}

        {/* Project Files — reference info, de-emphasized while a step is pending */}
        {hasProject && projectFiles.length > 0 && (
          <div className={nextStep ? 'opacity-50 transition-opacity duration-base' : ''}>
            <ProjectFilesPanel
              projectPath={projectPath}
              projectFiles={projectFiles}
              onOpenInExplorer={openInExplorer}
            />
          </div>
        )}

        {/* Build & Verify */}
        {hasProject && (
          <div className={dimUnless('build-verify')}>
            <BuildVerifyPanel
              engines={engines}
              isRunning={buildCLI.isRunning}
              onSendPrompt={buildCLI.sendPrompt}
            />
          </div>
        )}

        {/* Dev Environment */}
        {missingToolCount > 0 && (
          <div className={dimUnless('install-tools')}>
            <ToolingBootstrapPanel
              missingToolCount={missingToolCount}
              isRunning={bootstrapCLI.isRunning}
              scanning={scanning}
              onFixAllMissing={handleFixAllMissing}
            />
          </div>
        )}

        {/* Exported manifest preview */}
        {manifestJson && (
          <ManifestPreview
            json={manifestJson}
            onDismiss={() => setManifestJson(null)}
          />
        )}

        {/* Empty state when no project path */}
        {!projectPath.trim() && (
          <SurfaceCard className="p-6 text-center">
            <p className="text-sm text-text-muted">
              Complete the setup wizard to configure your project path.
            </p>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
