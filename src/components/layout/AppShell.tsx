'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ModuleRenderer } from './ModuleRenderer';
import { CLIBottomPanel } from './CLIBottomPanel';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import type { GameGenre, ExperienceLevel } from '@/stores/projectStore';

export function AppShell() {
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from SQLite on mount — server is source of truth
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((settings: Record<string, string>) => {
        if (settings.isSetupComplete === 'true') {
          setProject({
            projectName: settings.projectName || '',
            projectPath: settings.projectPath || '',
            ueVersion: settings.ueVersion || '5.5.4',
            gameGenre: (settings.gameGenre as GameGenre) || null,
            experienceLevel: (settings.experienceLevel as ExperienceLevel) || 'intermediate',
            isNewProject: settings.isNewProject === 'true',
          });
          completeSetup();
        }
      })
      .catch(() => {
        // Fall back to localStorage (zustand persist)
      })
      .finally(() => setHydrated(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="w-6 h-6 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupWizard />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a1a]">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ModuleRenderer />
      </div>
      <CLIBottomPanel />
    </div>
  );
}
