'use client';

import type { RefObject } from 'react';
import type { RecentProject } from '@/stores/projectStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Check, X, FolderOpen, Plus } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { ProjectRow } from './ProjectRow';
import { dropdownMotion, reducedDropdownMotion } from './constants';

interface ProjectDropdownProps {
  dropdownOpen: boolean;
  prefersReduced: boolean | null;
  showSwitcher: boolean;
  setShowSwitcher: (v: boolean) => void;
  otherProjects: RecentProject[];
  switching: string | null;
  handleSwitchProject: (project: RecentProject) => void;
  removeRecentProject: (id: string) => void;
  handleNewProject: () => void;
  renaming: boolean;
  setRenaming: (v: boolean) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRenameConfirm: () => void;
  handleRenameStart: () => void;
  renameInputRef: RefObject<HTMLInputElement | null>;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  handleDelete: () => void;
  projectPath: string;
}

export function ProjectDropdown({
  dropdownOpen,
  prefersReduced,
  showSwitcher,
  setShowSwitcher,
  otherProjects,
  switching,
  handleSwitchProject,
  removeRecentProject,
  handleNewProject,
  renaming,
  setRenaming,
  renameValue,
  setRenameValue,
  handleRenameConfirm,
  handleRenameStart,
  renameInputRef,
  confirmDelete,
  setConfirmDelete,
  handleDelete,
  projectPath,
}: ProjectDropdownProps) {
  return (
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
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-accent-subtle transition-colors border-t border-border"
              style={{ color: MODULE_COLORS.setup }}
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
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-text hover:bg-surface-hover transition-colors focus-ring-inset"
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
                    className="flex-1 px-2 py-1 bg-background border border-border-bright rounded text-xs text-text outline-none focus:border-accent-strong"
                  />
                  <button
                    onClick={handleRenameConfirm}
                    disabled={!renameValue.trim()}
                    className="p-1 hover:bg-accent-medium rounded"
                    style={{ color: MODULE_COLORS.setup }}
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-text hover:bg-surface-hover transition-colors focus-ring-inset"
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-status-red-subtle transition-colors focus-ring-inset"
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
  );
}
