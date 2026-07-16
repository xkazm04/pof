'use client';

import { Gamepad2, ChevronDown } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useTopBar } from './useTopBar';
import { ProjectDropdown } from './ProjectDropdown';
import { ProjectStats } from './ProjectStats';
import { NotificationBadge } from './NotificationBadge';
import { PofBridgeIndicator } from './PofBridgeIndicator';
import {
  Studio3DLink,
  ExperimentLabLink,
  NewShellButton,
  SearchTrigger,
} from './HeaderButtons';

export function TopBar() {
  const {
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
  } = useTopBar();

  return (
    <header role="banner" className="h-11 flex items-center justify-between px-4 border-b border-border bg-surface-deep" style={{ ['--focus-accent' as string]: 'var(--setup)' }}>
      <div className="flex items-center gap-3">
        <Gamepad2 className="w-5 h-5" style={{ color: MODULE_COLORS.setup }} aria-hidden="true" />
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
                className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors rounded px-1.5 py-0.5 hover:bg-surface focus-ring"
              >
                {projectName}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <ProjectDropdown
                dropdownOpen={dropdownOpen}
                prefersReduced={prefersReduced}
                showSwitcher={showSwitcher}
                setShowSwitcher={setShowSwitcher}
                otherProjects={otherProjects}
                switching={switching}
                handleSwitchProject={handleSwitchProject}
                removeRecentProject={removeRecentProject}
                handleNewProject={handleNewProject}
                renaming={renaming}
                setRenaming={setRenaming}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                handleRenameConfirm={handleRenameConfirm}
                handleRenameStart={handleRenameStart}
                renameInputRef={renameInputRef}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                handleDelete={handleDelete}
                projectPath={projectPath}
              />
            </div>
          </>
        )}
      </div>
      {/* Right cluster grows to up to 7+ controls; overflow-x-auto lets it scroll
          rather than crowd/clip on laptop/tablet widths (same pattern as
          CLIBottomPanel / GlobalSearchPanel chip rows). min-w-0 lets the flex
          child actually shrink; shrink-0 keeps each control at its natural size. */}
      <div className="flex items-center gap-3 min-w-0 overflow-x-auto [&>*]:flex-shrink-0">
        <Studio3DLink />
        <ExperimentLabLink />
        <NewShellButton />
        {isSetupComplete && <SearchTrigger />}
        {isSetupComplete && <ProjectStats />}
        {isSetupComplete && <PofBridgeIndicator />}
        <span className="text-xs text-text-muted whitespace-nowrap">UE5 + C++</span>
        <NotificationBadge />
      </div>
    </header>
  );
}
