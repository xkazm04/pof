'use client';

import { useCallback } from 'react';
import { Rocket } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { DetectedEngine } from './useProjectScan';
import { buildCreateProjectPrompt } from './prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';

interface CreateProjectPanelProps {
  engines: DetectedEngine[];
  isRunning: boolean;
  onSendPrompt: (prompt: string) => void;
}

export function CreateProjectPanel({ engines, isRunning, onSendPrompt }: CreateProjectPanelProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const handleCreate = useCallback(() => {
    onSendPrompt(buildCreateProjectPrompt({ projectName, projectPath, ueVersion }));
  }, [projectName, projectPath, ueVersion, onSendPrompt]);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Create Project
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          Let Claude scaffold a new UE C++ project. This will create the folder structure,
          .uproject, Source/, Build.cs, and basic GameMode class.
        </p>
        <Button
          data-testid="pof-setup-wizard-create-project-btn"
          intent="primary"
          onClick={handleCreate}
          disabled={!projectName.trim() || engines.length === 0}
          loading={isRunning}
          loadingLabel="Creating Project..."
          leftIcon={<Rocket className="w-4 h-4" />}
        >
          Create Project with Claude
        </Button>
        {engines.length === 0 && (
          <p className="text-xs text-red-400/80 mt-2">
            Install Unreal Engine first to enable project creation.
          </p>
        )}
      </SurfaceCard>
    </div>
  );
}
