'use client';

import { X, Terminal, Loader2, Radar } from 'lucide-react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';

export function CLIBottomPanel() {
  const sessions = useCLIPanelStore((s) => s.sessions);
  const tabOrder = useCLIPanelStore((s) => s.tabOrder);
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const maximizeTab = useCLIPanelStore((s) => s.maximizeTab);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);
  const removeSession = useCLIPanelStore((s) => s.removeSession);
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
    <div className="relative z-10 border-t border-[#1e1e3a] bg-[#0d0d22]">
      <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto">
        {/* Running indicator */}
        {runningCount > 0 && (
          <span className="text-[9px] text-[#00ff88] animate-pulse-glow px-1.5 py-0.5 mr-1 shrink-0">
            {runningCount} running
          </span>
        )}

        {tabOrder.map((tabId) => {
          const session = sessions[tabId];
          if (!session) return null;
          const isMaximized = maximizedTabId === tabId;
          const isRunning = session.isRunning;
          const isEvaluator = session.label === 'Evaluator';
          const isVisibleInline = isMaximized && session.moduleId === activeModuleId;

          return (
            <button
              key={tabId}
              onClick={() => handleTabClick(tabId)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all duration-150 min-w-0 max-w-[180px] group border
                ${isVisibleInline
                  ? 'bg-[#1a1a3a] text-[#e0e4f0]'
                  : isMaximized
                    ? 'bg-[#111128] text-[#e0e4f0] border-transparent'
                    : 'text-[#6b7294] hover:text-[#e0e4f0] hover:bg-[#111128]/50 border-transparent'
                }
              `}
              style={isVisibleInline ? { borderColor: session.accentColor + '40' } : undefined}
              title={isVisibleInline ? `${session.label} (showing inline)` : `Open ${session.label}`}
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: session.accentColor }} />
              ) : isEvaluator ? (
                <Radar className="w-3 h-3 shrink-0" style={{ color: session.accentColor }} />
              ) : (
                <Terminal className="w-3 h-3 shrink-0" style={{ color: isMaximized ? session.accentColor : undefined }} />
              )}
              <span className="truncate">{session.label || tabId}</span>
              {isVisibleInline && (
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: session.accentColor }}
                />
              )}
              {!isEvaluator && (
                <X
                  className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSession(tabId);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
