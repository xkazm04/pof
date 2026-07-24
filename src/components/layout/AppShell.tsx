'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useProjectStore } from '@/stores/projectStore';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ModuleRenderer } from './ModuleRenderer';
import { CLIBottomPanel } from './CLIBottomPanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { ShellSkeleton } from './ShellSkeleton';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useActivityFeedBridge } from '@/hooks/useActivityFeedBridge';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useDynamicTitle } from '@/hooks/useDynamicTitle';
import { usePofBridge } from '@/hooks/usePofBridge';
import { GlobalSearchPanel } from './GlobalSearchPanel';
import { EventBusDevTools } from './EventBusDevTools';
import { PreflightGuardDialog } from '@/components/cli/PreflightGuardDialog';
import { DURATION, EASE_OUT } from '@/lib/motion';

/**
 * Below this width the L1/L2 navigation rails collapse from inline columns into
 * a hamburger-triggered overlay drawer, so narrow screens hand the full width to
 * the module workspace instead of being crushed by ~200px of fixed chrome.
 */
const SHELL_COLLAPSE_BREAKPOINT = 900;

export function AppShell() {
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const prefersReduced = useReducedMotion();

  // Wide → rails render inline; narrow → rails collapse into an overlay drawer.
  const wideShell = useViewportAtLeast(SHELL_COLLAPSE_BREAKPOINT);
  const [navOpen, setNavOpen] = useState(false);
  // The drawer only exists on narrow viewports; deriving its visibility (rather
  // than resetting navOpen in an effect) means a wide viewport always renders the
  // inline rails, and a resize back to wide dissolves the drawer with no stale
  // open state — no setState-in-effect needed.
  const drawerOpen = navOpen && !wideShell;
  // Bridge CLI/evaluator events into activity feed
  useActivityFeedBridge();

  // Global keyboard shortcuts (Ctrl+B sidebar, Ctrl+J terminal, Ctrl+1-5 categories)
  useKeyboardShortcuts();

  // Watch UE5 Source/ for file changes → auto-verify checklist items
  useFileWatcher();

  // Dynamic browser tab title + favicon based on CLI task status
  useDynamicTitle();

  // PoF Bridge plugin auto-connection (connects to UE5 plugin HTTP server)
  usePofBridge();

  // Warn before closing/refreshing when CLI tasks are actively running
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const sessions = useCLIPanelStore.getState().sessions;
      const hasRunning = Object.values(sessions).some((s) => s.isRunning);
      if (hasRunning) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Wait for Zustand persist to actually finish rehydrating from localStorage.
  // Subscribing to the persist middleware's onFinishHydration (and reading the
  // real hasHydrated() flag) means we don't reveal the shell — and decide
  // SetupWizard vs. main shell off isSetupComplete — until the persisted values
  // have genuinely loaded, avoiding a flash of default/pre-hydration state.
  const hydrated = useSyncExternalStore(
    (onStoreChange) => useProjectStore.persist.onFinishHydration(onStoreChange),
    () => useProjectStore.persist.hasHydrated(),
    () => false,
  );

  // One continuous reveal: the branded shell skeleton fades out while the real
  // shell fades in underneath. Because the skeleton's placeholders sit where the
  // top bar, rail, and content land, there is no spinner-to-app cut or layout
  // jump on first paint.
  const fadeDuration = prefersReduced ? 0 : DURATION.base;

  return (
    <>
      {hydrated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: fadeDuration, ease: EASE_OUT }}
          className="h-dvh"
        >
          {isSetupComplete ? (
            <div className="h-dvh flex flex-col overflow-hidden bg-background">
              <TopBar onMenuClick={wideShell ? undefined : () => setNavOpen(true)} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar overlay={!wideShell} open={drawerOpen} onClose={() => setNavOpen(false)} />
                <ModuleRenderer />
                <ActivityFeedPanel />
              </div>
              <CLIBottomPanel />
              <GlobalSearchPanel />
              <EventBusDevTools />
              <PreflightGuardDialog />
            </div>
          ) : (
            <SetupWizard />
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {!hydrated && (
          <motion.div
            key="shell-skeleton"
            className="fixed inset-0 z-50"
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeDuration, ease: EASE_OUT }}
          >
            <ShellSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
