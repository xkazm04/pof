'use client';

import {
  FolderOpen,
  ChevronUp,
  Home,
  HardDrive,
  Search,
  Folder,
  FileCode,
  Loader2,
  ChevronRight,
  Cpu,
  MapPin,
} from 'lucide-react';
import { ErrorBanner } from '../ErrorBanner';
import { StatusDot } from '@/components/ui/StatusDot';
import { usePathBrowser } from './usePathBrowser';
import type { PathBrowserProps } from './types';

export type {
  DirectoryEntry,
  DetectedProject,
  DetectedEngine,
  ListResponse,
  PathBrowserProps,
} from './types';

export function PathBrowser(props: PathBrowserProps) {
  const { startFresh } = props;
  const {
    currentPath,
    pathInput,
    setPathInput,
    directories,
    uprojectFiles,
    isUEProject,
    parentPath,
    detectedProjects,
    detectedEngines,
    suggestedDirs,
    loading,
    detectLoading,
    error,
    handlePathSubmit,
    navigateUp,
    navigateHome,
    navigateDrives,
    selectProject,
    selectSuggestion,
    handleEngineClick,
    selectDirectory,
    clickDirectory,
  } = usePathBrowser(props);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-[#0d0d24]">
      {/* Path bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
        <FolderOpen className="w-4 h-4 text-accent-setup shrink-0" />
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={handlePathSubmit}
          placeholder="Type a path and press Enter..."
          className="flex-1 bg-transparent text-xs text-text placeholder-text-muted outline-none font-mono"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin shrink-0" />}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
        <button
          onClick={navigateUp}
          disabled={!parentPath}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-surface-hover rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go up"
        >
          <ChevronUp className="w-3 h-3" />
          Up
        </button>
        <button
          onClick={navigateHome}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
          title="Home directory"
        >
          <Home className="w-3 h-3" />
          Home
        </button>
        <button
          onClick={navigateDrives}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
          title="Show drives"
        >
          <HardDrive className="w-3 h-3" />
          Drives
        </button>
      </div>

      {/* Fresh mode: Detected engines + suggested directories */}
      {startFresh && detectedEngines.length > 0 && (
        <div className="border-b border-border">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted">
            <Cpu className="w-3 h-3" />
            Installed Engines (click to set version)
          </div>
          <div className="max-h-[80px] overflow-y-auto">
            {detectedEngines.map((engine) => (
              <button
                key={engine.path}
                onClick={() => handleEngineClick(engine)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#3b82f6]/5 transition-colors"
              >
                <ChevronRight className="w-3 h-3 text-[#3b82f6] shrink-0" />
                <span className="text-sm text-[#3b82f6] font-medium">UE {engine.version}</span>
                <span className="text-xs text-text-muted truncate ml-auto">{engine.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {startFresh && suggestedDirs.length > 0 && (
        <div className="border-b border-border">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted">
            <MapPin className="w-3 h-3" />
            Suggested Locations (click to select)
          </div>
          <div className="max-h-[100px] overflow-y-auto">
            {suggestedDirs.map((dir) => (
              <button
                key={dir.path}
                onClick={() => selectSuggestion(dir)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent-subtle transition-colors"
              >
                <ChevronRight className="w-3 h-3 text-accent-setup shrink-0" />
                <span className="text-sm text-accent-setup font-medium">{dir.label}</span>
                <span className="text-xs text-text-muted truncate ml-auto">{dir.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing project mode: Detected projects */}
      {!startFresh && detectedProjects.length > 0 && (
        <div className="border-b border-border">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted">
            <Search className="w-3 h-3" />
            Detected UE Projects (click to select)
          </div>
          <div className="max-h-[120px] overflow-y-auto">
            {detectedProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => selectProject(project)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent-subtle transition-colors group"
              >
                <ChevronRight className="w-3 h-3 text-accent-setup shrink-0" />
                <span className="text-sm text-accent-setup font-medium">{project.name}</span>
                {project.engineVersion && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent-medium text-accent-setup/80 shrink-0">
                    {project.engineVersion}
                  </span>
                )}
                {!project.validated && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400/70 shrink-0"
                    title="Missing Config/DefaultEngine.ini â€” may be incomplete"
                  >
                    <StatusDot state="warn" size="md" label="Unverified project" />
                    unverified
                  </span>
                )}
                <span className="text-xs text-text-muted truncate ml-auto">{project.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {detectLoading && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs text-text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          {startFresh ? 'Scanning for UE engines...' : 'Scanning for existing UE projects...'}
        </div>
      )}

      {/* Error state */}
      {error && <ErrorBanner message={error} className="mx-3 my-2" />}

      {/* Directory listing */}
      <div className="max-h-[200px] overflow-y-auto">
        {directories.length === 0 && !loading && currentPath && (
          <div className="px-3 py-6 text-center">
            <Folder className="w-6 h-6 text-text-muted/20 mx-auto mb-2" />
            <p className="text-xs text-text-muted mb-2">This directory is empty</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={navigateHome}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-accent-setup/80 hover:text-accent-setup border border-accent-setup/20 hover:border-accent-setup/40 rounded transition-colors"
              >
                <Home className="w-3 h-3" />
                Go Home
              </button>
              {parentPath && (
                <button
                  onClick={navigateUp}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text border border-border hover:border-border-bright rounded transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                  Navigate Up
                </button>
              )}
            </div>
          </div>
        )}
        {directories.map((dir) => (
          <button
            key={dir.path}
            onClick={() => clickDirectory(dir)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              dir.hasUProject
                ? 'hover:bg-accent-subtle bg-accent-subtle'
                : 'hover:bg-surface-hover'
            }`}
          >
            <Folder
              className={`w-3.5 h-3.5 shrink-0 ${dir.hasUProject ? 'text-accent-setup' : 'text-text-muted'}`}
            />
            <span
              className={`text-xs truncate ${dir.hasUProject ? 'text-accent-setup' : 'text-text'}`}
            >
              {dir.name}
            </span>
            {dir.hasUProject && (
              <span className="text-2xs text-accent-setup/70 ml-auto shrink-0">UE Project</span>
            )}
          </button>
        ))}
      </div>

      {/* .uproject indicator */}
      {isUEProject && uprojectFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-accent-subtle">
          {uprojectFiles.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-accent-setup" />
              <span className="text-xs text-accent-setup">{f}</span>
              <span className="text-2xs text-accent-setup/60 ml-1">UE project found!</span>
            </div>
          ))}
        </div>
      )}

      {/* Select button */}
      <div className="px-3 py-2 border-t border-border">
        <button
          onClick={selectDirectory}
          disabled={!currentPath}
          className="w-full py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-accent-medium text-accent-setup border border-accent-strong hover:bg-accent-strong"
        >
          {isUEProject
            ? 'Select This Project'
            : startFresh
              ? 'Use This Directory'
              : 'Select This Directory'}
        </button>
      </div>
    </div>
  );
}
