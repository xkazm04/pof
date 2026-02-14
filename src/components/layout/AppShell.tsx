'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ModuleRenderer } from './ModuleRenderer';
import { CLIBottomPanel } from './CLIBottomPanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useActivityFeedBridge } from '@/hooks/useActivityFeedBridge';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useFileWatcher } from '@/hooks/useFileWatcher';

export function AppShell() {
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const [hydrated, setHydrated] = useState(false);

  // Bridge CLI/evaluator events into activity feed
  useActivityFeedBridge();

  // Global keyboard shortcuts (Ctrl+B sidebar, Ctrl+J terminal, Ctrl+1-5 categories)
  useKeyboardShortcuts();

  // Watch UE5 Source/ for file changes → auto-verify checklist items
  useFileWatcher();

  // Wait for Zustand persist to rehydrate from localStorage
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-3"
        >
          <Gamepad2 className="w-12 h-12 text-[#00ff88]" />
          <span className="text-lg font-semibold text-text tracking-wide">
            POF
          </span>
          <div className="w-5 h-5 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupWizard />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ModuleRenderer />
        <ActivityFeedPanel />
      </div>
      <CLIBottomPanel />
    </div>
  );
}
