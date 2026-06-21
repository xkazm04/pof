'use client';

import { useSyncExternalStore } from 'react';
import { usePofBridge } from '@/hooks/usePofBridge';
import { useProjectStore } from '@/stores/projectStore';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { LayoutLab } from './LayoutLab';

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

  // Wait for Zustand persist to rehydrate from localStorage before gating — the
  // SSR snapshot sees the default (false); the client may rehydrate to true. The
  // guard avoids flashing the wizard over a loaded project on first paint.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <div data-theme="blueprint" style={{ height: '100vh', background: 'var(--lab-bg)' }} />;
  }

  return isSetupComplete ? <LayoutLab /> : <SetupWizard />;
}
