'use client';

import { Wrench } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { WizardButton } from './WizardButton';

interface ToolingBootstrapPanelProps {
  missingToolCount: number;
  isRunning: boolean;
  scanning: boolean;
  onFixAllMissing: () => void;
}

export function ToolingBootstrapPanel({
  missingToolCount,
  isRunning,
  scanning,
  onFixAllMissing,
}: ToolingBootstrapPanelProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Dev Environment
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          {missingToolCount} required tool{missingToolCount > 1 ? 's are' : ' is'} missing.
          Let Claude install everything automatically using winget (Windows Package Manager),
          or manually install from the links in the sidebar.
        </p>
        <WizardButton
          variant="info"
          onClick={onFixAllMissing}
          disabled={scanning}
          loading={isRunning}
          loadingLabel="Installing Tools..."
          icon={<Wrench className="w-4 h-4" />}
        >
          Fix All Missing Tools
        </WizardButton>
      </SurfaceCard>
    </div>
  );
}
