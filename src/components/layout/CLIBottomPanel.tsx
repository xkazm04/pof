'use client';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { CLITabBar } from './CLITabBar';

export function CLIBottomPanel() {
  const sessions = useCLIPanelStore((s) => s.sessions);
  const tabOrder = useCLIPanelStore((s) => s.tabOrder);
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const maximizeTab = useCLIPanelStore((s) => s.maximizeTab);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const activeModuleId = useActiveModuleId();

  if (tabOrder.length === 0) return null;

  const handleTabClick = (tabId: string) => {
    const session = sessions[tabId];
    if (!session) return;

    if (maximizedTabId === tabId && session.moduleId === activeModuleId) {
      // Already maximized and viewing its module → toggle minimize
      minimizeTab();
    } else {
      // Maximize this tab and navigate to its owning module
      maximizeTab(tabId);
      if (session.moduleId) {
        navigateToModule(session.moduleId);
      }
    }
  };

  const runningCount = tabOrder.filter((id) => sessions[id]?.isRunning).length;

  return (
    <div className="relative z-10 border-t border-border bg-surface-deep">
      <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto">
        {/* Running indicator */}
        {runningCount > 0 && (
          <span className="text-2xs text-[#00ff88] animate-pulse-glow px-1.5 py-0.5 mr-1 shrink-0">
            {runningCount} running
          </span>
        )}

        <CLITabBar className="contents" onTabSelect={handleTabClick} />
      </div>
    </div>
  );
}
