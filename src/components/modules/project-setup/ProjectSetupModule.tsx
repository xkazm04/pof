'use client';

import { useState, useCallback, useRef } from 'react';
import { Rocket } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectScan } from './useProjectScan';
import { StatusChecklist } from './StatusChecklist';
import { CreateProjectPanel } from './CreateProjectPanel';
import { ProjectFilesPanel } from './ProjectFilesPanel';
import { BuildVerifyPanel } from './BuildVerifyPanel';
import { ToolingBootstrapPanel } from './ToolingBootstrapPanel';
import { ManifestPreview } from './ManifestPreview';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

export function ProjectSetupModule() {
  const projectPath = useProjectStore((s) => s.projectPath);

  // Ref for scan callback — allows hooks to call scan() without circular dependency
  const scanRef = useRef<() => void>(() => {});

  const setupCLI = useModuleCLI({
    moduleId: 'project-setup',
    sessionKey: 'project-setup',
    label: 'Project Setup',
    accentColor: '#00ff88',
    onComplete: () => scanRef.current(),
  });

  const buildCLI = useModuleCLI({
    moduleId: 'project-setup',
    sessionKey: 'project-build-verify',
    label: 'Build & Verify',
    accentColor: '#f59e0b',
    onComplete: () => scanRef.current(),
  });

  const bootstrapCLI = useModuleCLI({
    moduleId: 'project-setup',
    sessionKey: 'project-bootstrap',
    label: 'Install Tools',
    accentColor: '#3b82f6',
    onComplete: () => scanRef.current(),
  });

  const {
    engines,
    checklist,
    projectFiles,
    scanning,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  } = useProjectScan(projectPath);

  // Wire scanRef so the hooks' onComplete can call scan() without circular deps
  scanRef.current = scan;

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

  return (
    <div className="flex h-full">
      {/* Left rail — status checklist */}
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
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Rocket className="w-6 h-6 text-[#00ff88]" />
          <h1 className="text-xl font-semibold text-text">Project Setup</h1>
        </div>
        <p className="text-sm text-text-muted mb-6">
          Create and configure your Unreal Engine project
        </p>

        {/* Create Project */}
        {!hasProject && projectPath.trim() && (
          <CreateProjectPanel
            engines={engines}
            isRunning={setupCLI.isRunning}
            onSendPrompt={setupCLI.sendPrompt}
          />
        )}

        {/* Project Files */}
        {hasProject && projectFiles.length > 0 && (
          <ProjectFilesPanel
            projectPath={projectPath}
            projectFiles={projectFiles}
            onOpenInExplorer={openInExplorer}
          />
        )}

        {/* Build & Verify */}
        {hasProject && (
          <BuildVerifyPanel
            engines={engines}
            isRunning={buildCLI.isRunning}
            onSendPrompt={buildCLI.sendPrompt}
          />
        )}

        {/* Dev Environment */}
        {missingToolCount > 0 && (
          <ToolingBootstrapPanel
            missingToolCount={missingToolCount}
            isRunning={bootstrapCLI.isRunning}
            scanning={scanning}
            onFixAllMissing={handleFixAllMissing}
          />
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
