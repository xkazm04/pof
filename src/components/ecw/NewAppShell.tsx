'use client';

import { useProjectStore } from '@/stores/projectStore';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useEcwStore } from '@/stores/ecwStore';
import { EcwTopBar } from './EcwTopBar';
import { CliRail } from './CliRail';
import { EcwCommandPalette } from './EcwCommandPalette';
import { CatalogsTabPlaceholder } from './tabs/CatalogsTabPlaceholder';
import { MissionControlTabPlaceholder } from './tabs/MissionControlTabPlaceholder';
import { LiveStateTabPlaceholder } from './tabs/LiveStateTabPlaceholder';

/**
 * Entity-Centric Workspace top-level shell. Gated behind `?ecw=1` URL param
 * during Phases 1–11 so the legacy AppShell remains the default and operators
 * can A/B at any time.
 *
 * Composition: EcwTopBar (brand + 3 L1 tabs + ⌘K + bridge dot) · main body
 * (tab-keyed) · CliRail (collapsible right) · EcwCommandPalette (⌘K overlay).
 *
 * Honors the same `isSetupComplete` gate as the legacy AppShell — first-run
 * goes through the SetupWizard regardless of which shell the URL requests.
 */
export function NewAppShell() {
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const tab = useEcwStore((s) => s.activeL1Tab);

  if (!isSetupComplete) return <SetupWizard />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <EcwTopBar />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex overflow-hidden">
          {tab === 'catalogs' && <CatalogsTabPlaceholder />}
          {tab === 'mission-control' && <MissionControlTabPlaceholder />}
          {tab === 'live-state' && <LiveStateTabPlaceholder />}
        </main>
        <CliRail />
      </div>
      <EcwCommandPalette />
    </div>
  );
}
