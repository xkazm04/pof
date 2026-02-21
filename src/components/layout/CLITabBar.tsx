'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Terminal, Loader2, Radar } from 'lucide-react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

interface CLITabBarProps {
  /** CSS class for the container — use "contents" to dissolve wrapper into parent flex */
  className?: string;
  /** If provided, only show these tabs (filtered by parent) */
  filteredTabOrder?: string[];
  /** Override which tab appears active */
  activeTabId?: string | null;
  /** Override tab selection handler */
  onTabSelect?: (tabId: string) => void;
}

export function CLITabBar({ className, filteredTabOrder, activeTabId: activeTabIdProp, onTabSelect }: CLITabBarProps) {
  const sessions = useCLIPanelStore((s) => s.sessions);
  const storeTabOrder = useCLIPanelStore((s) => s.tabOrder);
  const storeActiveTabId = useCLIPanelStore((s) => s.activeTabId);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);
  const removeSession = useCLIPanelStore((s) => s.removeSession);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const renameSession = useCLIPanelStore((s) => s.renameSession);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  const tabOrder = filteredTabOrder ?? storeTabOrder;
  const activeTabId = activeTabIdProp !== undefined ? activeTabIdProp : storeActiveTabId;
  const handleTabSelect = onTabSelect ?? setActiveTab;

  const handleRenameCommit = useCallback((tabId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (trimmed) {
      renameSession(tabId, trimmed);
    }
    setEditingTabId(null);
  }, [renameSession]);

  const handleRenameCancel = useCallback(() => {
    setEditingTabId(null);
  }, []);

  return (
    <div role="tablist" aria-label="CLI sessions" className={className ?? "flex items-center gap-0.5 px-2 py-1 bg-surface-deep border-b border-border overflow-x-auto"}>
      {tabOrder.map((tabId) => {
        const session = sessions[tabId];
        if (!session) return null;
        const isActive = activeTabId === tabId;
        const isRunning = session.isRunning;
        const isEvaluator = session.label === 'Evaluator';
        const isEditing = editingTabId === tabId;

        return (
          <button
            key={tabId}
            role="tab"
            aria-selected={isActive}
            aria-label={`${session.label || tabId}${isRunning ? ' (running)' : ''}`}
            onClick={() => handleTabSelect(tabId)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs transition-all duration-fast min-w-0 max-w-[160px] group
              ${isActive
                ? 'bg-surface text-text border-t-2'
                : 'text-text-muted hover:text-text hover:bg-surface/50'
              }
            `}
            style={isActive ? { borderTopColor: session.accentColor || MODULE_COLORS.core } : undefined}
          >
            {isRunning ? (
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: session.accentColor }} />
            ) : isEvaluator ? (
              <Radar className="w-3 h-3 flex-shrink-0" style={{ color: session.accentColor }} />
            ) : (
              <Terminal className="w-3 h-3 flex-shrink-0" style={{ color: isActive ? session.accentColor : undefined }} />
            )}
            {isEditing ? (
              <TabRenameInput
                currentLabel={session.label || tabId}
                onCommit={(newLabel) => handleRenameCommit(tabId, newLabel)}
                onCancel={handleRenameCancel}
              />
            ) : (
              <span
                className="truncate"
                onDoubleClick={(e) => {
                  if (!isEvaluator) {
                    e.stopPropagation();
                    setEditingTabId(tabId);
                  }
                }}
                title={isEvaluator ? undefined : 'Double-click to rename'}
              >
                {session.label || tabId}
              </span>
            )}
            {!isEvaluator && !isEditing && (
              <X
                role="button"
                aria-label={`Close ${session.label || tabId}`}
                className="w-3 h-3 flex-shrink-0 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 hover:text-red-400 transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(tabId);
                }}
              />
            )}
          </button>
        );
      })}

      {storeTabOrder.length < 8 && (
        <button
          onClick={() => createSession({ label: `Terminal ${storeTabOrder.length + 1}` })}
          aria-label="New terminal tab"
          className="flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text hover:bg-surface transition-all"
          title="New tab"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TabRenameInput({
  currentLabel,
  onCommit,
  onCancel,
}: {
  currentLabel: string;
  onCommit: (label: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(currentLabel);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          onCommit(value);
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => onCommit(value)}
      onClick={(e) => e.stopPropagation()}
      className="bg-transparent border-b border-text-muted outline-none text-xs text-text w-full min-w-[40px] max-w-[120px]"
      maxLength={30}
    />
  );
}
