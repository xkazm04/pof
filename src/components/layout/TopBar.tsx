'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { Gamepad2, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react';

export function TopBar() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const setProject = useProjectStore((s) => s.setProject);
  const resetProject = useProjectStore((s) => s.resetProject);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setRenaming(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
  };

  const handleRenameConfirm = useCallback(async () => {
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

    // Persist to SQLite
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: trimmed, projectPath: newPath }),
      });
    } catch {
      // Non-critical
    }

    setRenaming(false);
    setDropdownOpen(false);
  }, [renameValue, projectName, projectPath, setProject]);

  const handleDelete = useCallback(async () => {
    // Clear SQLite
    try {
      await fetch('/api/settings', { method: 'DELETE' });
    } catch {
      // Non-critical
    }

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

  return (
    <div className="h-11 flex items-center justify-between px-4 border-b border-[#1e1e3a] bg-[#0d0d22]">
      <div className="flex items-center gap-3">
        <Gamepad2 className="w-5 h-5 text-[#00ff88]" />
        <span className="text-sm font-semibold tracking-wide text-[#e0e4f0]">POF</span>
        {isSetupComplete && projectName && (
          <>
            <span className="text-[#2e2e5a]">/</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setDropdownOpen(!dropdownOpen);
                  setRenaming(false);
                  setConfirmDelete(false);
                }}
                className="flex items-center gap-1 text-sm text-[#6b7294] hover:text-[#e0e4f0] transition-colors rounded px-1.5 py-0.5 hover:bg-[#111128]"
              >
                {projectName}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#111128] border border-[#1e1e3a] rounded-lg shadow-xl z-50 overflow-hidden">
                  {/* Rename */}
                  {renaming ? (
                    <div className="p-2 border-b border-[#1e1e3a]">
                      <label className="text-[10px] text-[#6b7294] mb-1 block">Project Name</label>
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
                          className="flex-1 px-2 py-1 bg-[#0a0a1a] border border-[#2e2e5a] rounded text-xs text-[#e0e4f0] outline-none focus:border-[#00ff88]/50"
                        />
                        <button
                          onClick={handleRenameConfirm}
                          disabled={!renameValue.trim()}
                          className="p-1 text-[#00ff88] hover:bg-[#00ff88]/10 rounded disabled:opacity-40"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRenaming(false)}
                          className="p-1 text-[#6b7294] hover:bg-[#1e1e3a] rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleRenameStart}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#e0e4f0] hover:bg-[#1a1a3a] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#6b7294]" />
                      Rename Project
                    </button>
                  )}

                  {/* Delete */}
                  {confirmDelete ? (
                    <div className="p-2 bg-red-500/5">
                      <p className="text-[10px] text-red-400 mb-2">
                        This will reset all settings and return to the setup wizard. Project files on disk are not deleted.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDelete}
                          className="flex-1 px-2 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs hover:bg-red-500/20 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-2 py-1.5 text-[#6b7294] border border-[#1e1e3a] rounded text-xs hover:bg-[#1e1e3a] transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Project
                    </button>
                  )}

                  {/* Path info */}
                  {projectPath && (
                    <div className="px-3 py-2 border-t border-[#1e1e3a]">
                      <span className="text-[10px] text-[#6b7294] block truncate" title={projectPath}>
                        {projectPath}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-[#6b7294]">
        <span>UE5 + C++ + Claude</span>
      </div>
    </div>
  );
}
