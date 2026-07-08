'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { RecentProject } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useReducedMotion } from 'framer-motion';

export function useTopBar() {
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
    // Clear all CLI sessions (atomic reset of sessions/tabOrder/active/maximized)
    useCLIPanelStore.getState().clearAllSessions();

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
    useCLIPanelStore.getState().clearAllSessions();

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
    useCLIPanelStore.getState().clearAllSessions();

    resetProject();
    setDropdownOpen(false);
    setShowSwitcher(false);
  }, [projectPath, isSetupComplete, saveToRecent, resetProject]);

  // Filter recent projects to exclude current
  const otherProjects = recentProjects.filter((p) => p.projectPath !== projectPath);

  const prefersReduced = useReducedMotion();

  return {
    projectName,
    projectPath,
    isSetupComplete,
    dropdownOpen,
    setDropdownOpen,
    renaming,
    setRenaming,
    renameValue,
    setRenameValue,
    confirmDelete,
    setConfirmDelete,
    showSwitcher,
    setShowSwitcher,
    switching,
    dropdownRef,
    renameInputRef,
    removeRecentProject,
    handleRenameStart,
    handleRenameConfirm,
    handleDelete,
    handleSwitchProject,
    handleNewProject,
    otherProjects,
    prefersReduced,
  };
}
