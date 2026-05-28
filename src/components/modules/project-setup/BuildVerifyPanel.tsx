'use client';

import { useCallback } from 'react';
import { Hammer } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { DetectedEngine } from './useProjectScan';
import { buildBuildVerifyPrompt } from './prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';

interface BuildVerifyPanelProps {
  engines: DetectedEngine[];
  isRunning: boolean;
  onSendPrompt: (prompt: string) => void;
}

export function BuildVerifyPanel({ engines, isRunning, onSendPrompt }: BuildVerifyPanelProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const handleBuild = useCallback(() => {
    onSendPrompt(buildBuildVerifyPrompt({ projectName, projectPath, ueVersion, engines }));
  }, [projectName, projectPath, ueVersion, engines, onSendPrompt]);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Build & Verify
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          Health-check your SDK toolchain and compile the project with UnrealBuildTool to
          verify everything is wired correctly.
        </p>
        <Button
          data-testid="pof-setup-wizard-build-verify-btn"
          intent="warning"
          onClick={handleBuild}
          disabled={engines.length === 0}
          loading={isRunning}
          loadingLabel="Building & Verifying..."
          leftIcon={<Hammer className="w-4 h-4" />}
        >
          Build & Verify Project
        </Button>
      </SurfaceCard>
    </div>
  );
}
