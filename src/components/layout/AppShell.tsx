'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useProjectStore } from '@/stores/projectStore';
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

export function AppShell() {
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const prefersReduced = useReducedMotion();
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

  // Wait for Zustand persist to rehydrate from localStorage
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
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
          className="h-screen"
        >
          {isSetupComplete ? (
            <div className="h-screen flex flex-col overflow-hidden bg-background">
              <TopBar />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar />
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
