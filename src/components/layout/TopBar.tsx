'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { RecentProject } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useModuleStore } from '@/stores/moduleStore';
import { SUB_MODULES } from '@/lib/module-registry';
import {
  Gamepad2, ChevronDown, Pencil, Trash2, Check, X,
  Bell, FolderOpen, Plus, Clock, Loader2, CheckCircle2, Search,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useActivityFeedStore } from '@/stores/activityFeedStore';

const dropdownMotion = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] as const },
};

const reducedDropdownMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0 },
};

export function TopBar() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const setProject = useProjectStore((s) => s.setProject);
  const resetProject = useProjectStore((s) => s.resetProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const loadRecentProjects = useProjectStore((s) => s.loadRecentProjects);
  const switchProject = useProjectStore((s) => s.switchProject);
  const removeRecentProject = useProjectStore((s) => s.removeRecentProject);
  const saveToRecent = useProjectStore((s) => s.saveToRecent);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load recent projects when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      loadRecentProjects();
    }
  }, [dropdownOpen, loadRecentProjects]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setRenaming(false);
        setConfirmDelete(false);
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Focus-trap + Escape to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const container = dropdownRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDropdownOpen(false);
        setRenaming(false);
        setConfirmDelete(false);
        setShowSwitcher(false);
        // Return focus to the trigger button
        container.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dropdownOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleRenameStart = () => {
    setRenameValue(projectName);
    setRenaming(true);
    setConfirmDelete(false);
    setShowSwitcher(false);
  };

  const handleRenameConfirm = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === projectName) {
      setRenaming(false);
      return;
    }

    // Update the path if it ends with the old project name
    let newPath = projectPath;
    const pathSep = projectPath.includes('/') ? '/' : '\\';
    const pathParts = projectPath.split(/[/\\]/);
    if (pathParts[pathParts.length - 1] === projectName) {
      pathParts[pathParts.length - 1] = trimmed;
      newPath = pathParts.join(pathSep);
    }

    setProject({ projectName: trimmed, projectPath: newPath });

    setRenaming(false);
    setDropdownOpen(false);
  }, [renameValue, projectName, projectPath, setProject]);

  const handleDelete = useCallback(() => {
    // Clear all CLI sessions
    const { tabOrder, removeSession } = useCLIPanelStore.getState();
    for (const tabId of [...tabOrder]) {
      removeSession(tabId);
    }

    // Reset project store (clears localStorage too)
    resetProject();

    setDropdownOpen(false);
    setConfirmDelete(false);
  }, [resetProject]);

  const handleSwitchProject = useCallback(async (project: RecentProject) => {
    if (project.projectPath === projectPath) {
      setDropdownOpen(false);
      setShowSwitcher(false);
      return;
    }

    setSwitching(project.id);
    // Clear CLI sessions before switching
    const { tabOrder, removeSession } = useCLIPanelStore.getState();
    for (const tabId of [...tabOrder]) {
      removeSession(tabId);
    }

    await switchProject(project.id);
    setSwitching(null);
    setDropdownOpen(false);
    setShowSwitcher(false);
  }, [projectPath, switchProject]);

  const handleNewProject = useCallback(() => {
    // Save current before starting fresh
    if (projectPath && isSetupComplete) {
      saveToRecent();
    }

    // Clear CLI sessions
    const { tabOrder, removeSession } = useCLIPanelStore.getState();
    for (const tabId of [...tabOrder]) {
      removeSession(tabId);
    }

    resetProject();
    setDropdownOpen(false);
    setShowSwitcher(false);
  }, [projectPath, isSetupComplete, saveToRecent, resetProject]);

  // Filter recent projects to exclude current
  const otherProjects = recentProjects.filter((p) => p.projectPath !== projectPath);

  const prefersReduced = useReducedMotion();

  return (
    <header role="banner" className="h-11 flex items-center justify-between px-4 border-b border-border bg-surface-deep">
      <div className="flex items-center gap-3">
        <Gamepad2 className="w-5 h-5 text-[#00ff88]" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-wide text-text">POF</span>
        {isSetupComplete && projectName && (
          <>
            <span className="text-border-bright" aria-hidden="true">/</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setDropdownOpen(!dropdownOpen);
                  setRenaming(false);
                  setConfirmDelete(false);
                  setShowSwitcher(false);
                }}
                aria-label={`Project: ${projectName}`}
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors rounded px-1.5 py-0.5 hover:bg-surface"
              >
                {projectName}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  key="project-dropdown"
                  {...(prefersReduced ? reducedDropdownMotion : dropdownMotion)}
                  role="menu"
                  aria-label="Project actions"
                  className="absolute top-full left-0 mt-1 w-72 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden origin-top-left">
                  {/* Switch Project */}
                  {showSwitcher ? (
                    <div className="border-b border-border">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-medium text-text-muted">Switch Project</span>
                        <button
                          onClick={() => setShowSwitcher(false)}
                          className="p-0.5 text-text-muted hover:text-text hover:bg-surface-hover rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {otherProjects.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-text-muted">
                          No other projects yet
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {otherProjects.map((project) => (
                            <ProjectRow
                              key={project.id}
                              project={project}
                              isSwitching={switching === project.id}
                              onSwitch={() => handleSwitchProject(project)}
                              onRemove={() => removeRecentProject(project.id)}
                            />
                          ))}
                        </div>
                      )}
                      <button
                        onClick={handleNewProject}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#00ff88] hover:bg-accent-subtle transition-colors border-t border-border"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Project
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSwitcher(true);
                        setRenaming(false);
                        setConfirmDelete(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-text hover:bg-surface-hover transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-text-muted" />
                      Switch Project
                      {otherProjects.length > 0 && (
                        <span className="ml-auto text-2xs text-text-muted bg-surface-hover px-1.5 py-px rounded-full">
                          {otherProjects.length}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Rename */}
                  {!showSwitcher && (
                    <>
                      {renaming ? (
                        <div className="p-2 border-b border-border">
                          <label className="text-xs text-text-muted mb-1 block">Project Name</label>
                          <div className="flex items-center gap-1">
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameConfirm();
                                if (e.key === 'Escape') setRenaming(false);
                              }}
                              className="flex-1 px-2 py-1 bg-background border border-border-bright rounded text-xs text-text outline-none focus:border-[#00ff88]/50"
                            />
                            <button
                              onClick={handleRenameConfirm}
                              disabled={!renameValue.trim()}
                              className="p-1 text-[#00ff88] hover:bg-accent-medium rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRenaming(false)}
                              className="p-1 text-text-muted hover:bg-border rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleRenameStart}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-text hover:bg-surface-hover transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-text-muted" />
                          Rename Project
                        </button>
                      )}

                      {/* Delete */}
                      {confirmDelete ? (
                        <div className="p-2 bg-status-red-subtle">
                          <p className="text-xs text-red-400 mb-2">
                            This will reset all settings and return to the setup wizard. Project files on disk are not deleted.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleDelete}
                              className="flex-1 px-2 py-1.5 bg-status-red-subtle text-red-400 border border-status-red-medium rounded text-xs hover:bg-status-red-medium transition-colors"
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="px-2 py-1.5 text-text-muted border border-border rounded text-xs hover:bg-border transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmDelete(true);
                            setRenaming(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-status-red-subtle transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Project
                        </button>
                      )}

                      {/* Path info */}
                      {projectPath && (
                        <div className="px-3 py-2 border-t border-border">
                          <span className="text-xs text-text-muted block truncate" title={projectPath}>
                            {projectPath}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isSetupComplete && <SearchTrigger />}
        {isSetupComplete && <ProjectStats />}
        <span className="text-xs text-text-muted">UE5 + C++</span>
        <NotificationBadge />
      </div>
    </header>
  );
}

// --- Project row in the switcher list ---

function ProjectRow({ project, isSwitching, onSwitch, onRemove }: {
  project: RecentProject;
  isSwitching: boolean;
  onSwitch: () => void;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pct = project.checklistTotal > 0
    ? Math.round((project.checklistDone / project.checklistTotal) * 100)
    : 0;

  const timeAgo = formatTimeAgo(project.lastOpenedAt);

  return (
    <div className="group relative">
      <button
        onClick={onSwitch}
        disabled={isSwitching}
        className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded bg-surface-hover flex items-center justify-center">
          {isSwitching ? (
            <Loader2 className="w-3.5 h-3.5 text-[#00ff88] animate-spin" />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text truncate">{project.projectName}</span>
            <span className="text-2xs text-text-muted flex-shrink-0">UE{project.ueVersion}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Mini progress bar */}
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 75 ? '#00ff88' : pct >= 40 ? '#f59e0b' : 'var(--text-muted)',
                  }}
                />
              </div>
              <span className="text-2xs text-text-muted">{pct}%</span>
            </div>
            <span className="text-2xs text-text-muted flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo}
            </span>
          </div>
        </div>
      </button>
      {/* Remove button on hover */}
      {confirmRemove ? (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 bg-surface border border-border rounded px-1 py-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-2xs text-red-400 hover:text-red-300 px-1"
          >
            Remove
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}
            className="text-2xs text-text-muted hover:text-text px-1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
          className="absolute right-2 top-2 p-0.5 text-text-muted hover:text-red-400 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all rounded hover:bg-status-red-subtle"
          title="Remove from recent"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// --- Helper ---

function formatTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return 'Unknown';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// --- Project stats summary ---

// Precompute total checklist items per module (static — never changes at runtime)
const MODULE_CHECKLIST_COUNTS: { moduleId: string; total: number }[] = SUB_MODULES
  .filter((m) => m.checklist && m.checklist.length > 0)
  .map((m) => ({ moduleId: m.id, total: m.checklist!.length }));

const TOTAL_CHECKLIST_ITEMS = MODULE_CHECKLIST_COUNTS.reduce((sum, m) => sum + m.total, 0);
const MODULE_ITEM_IDS: Record<string, string[]> = Object.fromEntries(
  SUB_MODULES
    .filter((m) => m.checklist && m.checklist.length > 0)
    .map((m) => [m.id, m.checklist!.map((c) => c.id)]),
);

const EMPTY_PROGRESS: Record<string, Record<string, boolean>> = {};

function ProjectStats() {
  const checklistProgress = useModuleStore((s) => s.checklistProgress) || EMPTY_PROGRESS;

  const stats = useMemo(() => {
    let completed = 0;
    let modulesComplete = 0;

    for (const { moduleId, total } of MODULE_CHECKLIST_COUNTS) {
      const progress = checklistProgress[moduleId];
      if (!progress) continue;

      const itemIds = MODULE_ITEM_IDS[moduleId];
      let moduleCompleted = 0;
      for (const id of itemIds) {
        if (progress[id]) {
          completed++;
          moduleCompleted++;
        }
      }
      if (moduleCompleted === total) modulesComplete++;
    }

    const pct = TOTAL_CHECKLIST_ITEMS > 0
      ? Math.round((completed / TOTAL_CHECKLIST_ITEMS) * 100)
      : 0;

    return { completed, total: TOTAL_CHECKLIST_ITEMS, pct, modulesComplete };
  }, [checklistProgress]);

  if (TOTAL_CHECKLIST_ITEMS === 0) return null;

  const barColor = stats.pct >= 75 ? '#00ff88' : stats.pct >= 40 ? '#f59e0b' : 'var(--text-muted)';

  return (
    <div className="flex items-center gap-2.5" title={`${stats.completed}/${stats.total} checklist items · ${stats.modulesComplete} modules complete`}>
      {/* Mini progress bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-slow"
            style={{ width: `${stats.pct}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="text-2xs font-medium tabular-nums" style={{ color: barColor }}>
          {stats.pct}%
        </span>
      </div>
      {/* Fraction */}
      <span className="text-2xs text-text-muted tabular-nums">
        {stats.completed}/{stats.total}
      </span>
      {/* Modules at 100% */}
      {stats.modulesComplete > 0 && (
        <span className="flex items-center gap-0.5 text-2xs text-[#00ff88]">
          <CheckCircle2 className="w-3 h-3" />
          {stats.modulesComplete}
        </span>
      )}
    </div>
  );
}

// --- Notification badge (unchanged) ---

function NotificationBadge() {
  const unreadCount = useActivityFeedStore((s) => s.events.filter((e) => !e.dismissed).length);
  const toggleOpen = useActivityFeedStore((s) => s.toggleOpen);
  const isOpen = useActivityFeedStore((s) => s.isOpen);

  return (
    <button
      onClick={toggleOpen}
      aria-label={`Activity feed${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      aria-expanded={isOpen}
      className={`relative p-1.5 rounded-md transition-colors ${
        isOpen
          ? 'bg-status-red-subtle text-[#ef4444]'
          : 'text-text-muted hover:text-text hover:bg-surface'
      }`}
      title="Activity feed"
    >
      <Bell className="w-4 h-4" aria-hidden="true" />
      {unreadCount > 0 && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 text-2xs font-bold text-white bg-[#ef4444] rounded-full leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// --- Search trigger ---

function SearchTrigger() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors"
      title="Search (Ctrl+K)"
    >
      <Search className="w-3 h-3" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-flex items-center px-1 py-px text-2xs bg-surface border border-border rounded font-mono">
        ⌘K
      </kbd>
    </button>
  );
}
