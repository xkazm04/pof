'use client';

import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'framer-motion';
import { usePofBridge } from '@/hooks/usePofBridge';
import { useProjectStore } from '@/stores/projectStore';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { LayoutLab } from './LayoutLab';
import { Skeleton } from './ui/Skeleton';

/**
 * Root "New" variant wrapper. Calls usePofBridge() so the bridge-status strip in
 * LayoutLab connects when running inside the real app, and gates on project setup
 * the same way the legacy AppShell does: with no project loaded it shows the (now
 * Blueprint) SetupWizard; once setup completes it shows the catalog lab. The
 * `/layout` route renders <LayoutLab /> directly and stays project-agnostic.
 */
export function NewHome() {
  usePofBridge();
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);

  // Wait for Zustand persist to ACTUALLY finish rehydrating before gating on
  // isSetupComplete — subscribe to the persist middleware's onFinishHydration and
  // read the real hasHydrated() flag, exactly as the legacy AppShell does, so the
  // two shells guard the same store the same way.
  //
  // This previously used the repo's SSR/client-split idiom (no-op subscribe,
  // client snapshot hard-coded to `true`), whose comment claimed a persist wait it
  // never performed. No behaviour changes here: projectStore persists through
  // createJSONStorage(() => localStorage), which is SYNCHRONOUS, so hasHydrated()
  // is already true on the first client render and no skeleton flash is added.
  // That synchronicity is load-bearing for the OLD code, not this one — if
  // persistence ever moves to an async backend (IndexedDB, a server store), this
  // guard keeps working while the hard-coded `true` would have flashed the
  // SetupWizard over a loaded project.
  const hydrated = useSyncExternalStore(
    (onStoreChange) => useProjectStore.persist.onFinishHydration(onStoreChange),
    () => useProjectStore.persist.hasHydrated(),
    () => false,
  );

  if (!hydrated) return <NewHomeSkeleton />;

  return isSetupComplete ? <LayoutLab /> : <SetupWizard />;
}

/**
 * Lightweight first-paint skeleton shown while Zustand persist rehydrates — a hint of
 * the lab shell (header bar + catalog rail + work canvas) instead of a bare blank div,
 * so the app reads as "loading" rather than broken. Blueprint-themed (prefs haven't
 * rehydrated yet). Shimmer freezes under reduced motion.
 */
function NewHomeSkeleton() {
  const reduce = useReducedMotion();
  return (
    <div
      data-theme="blueprint"
      data-lab-root=""
      data-testid="new-home-skeleton"
      aria-busy="true"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--lab-bg)' }}
    >
      {/* header bar */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--lab-line)', background: 'var(--lab-panel)' }}>
        <Skeleton reduce={!!reduce} width={120} height={16} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} reduce={!!reduce} width={72} height={28} radius={6} />)}
        </div>
      </div>
      {/* body: rail + canvas */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '260px 1fr' }}>
        <div style={{ borderRight: '1px solid var(--lab-line)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} reduce={!!reduce} width="100%" height={18} />)}
        </div>
        <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton reduce={!!reduce} width={280} height={30} />
          <Skeleton reduce={!!reduce} width="60%" height={16} />
          <Skeleton reduce={!!reduce} width="100%" height={220} radius={12} style={{ marginTop: 12 }} />
        </div>
      </div>
    </div>
  );
}
