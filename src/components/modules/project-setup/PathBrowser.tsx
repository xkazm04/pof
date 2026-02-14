'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
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

interface DirectoryEntry {
  name: string;
  path: string;
  hasUProject: boolean;
}

interface DetectedProject {
  name: string;
  path: string;
  uprojectFile: string;
  engineVersion: string | null;
  validated: boolean;
}

interface DetectedEngine {
  version: string;
  path: string;
}

interface ListResponse {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
  uprojectFiles: string[];
  isUEProject: boolean;
}

interface PathBrowserProps {
  value: string;
  startFresh: boolean;
  onSelect: (path: string) => void;
  onProjectDetected?: (name: string, path: string) => void;
  onEngineDetected?: (version: string) => void;
}

export function PathBrowser({ value, startFresh, onSelect, onProjectDetected, onEngineDetected }: PathBrowserProps) {
  const [currentPath, setCurrentPath] = useState(value || '');
  const [pathInput, setPathInput] = useState(value || '');
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [uprojectFiles, setUprojectFiles] = useState<string[]>([]);
  const [isUEProject, setIsUEProject] = useState(false);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [detectedProjects, setDetectedProjects] = useState<DetectedProject[]>([]);
  const [detectedEngines, setDetectedEngines] = useState<DetectedEngine[]>([]);
  const [suggestedDirs, setSuggestedDirs] = useState<{ label: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectLoading, setDetectLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const browse = useCallback(async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ListResponse>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', path: targetPath }),
      });
      setCurrentPath(data.path);
      setPathInput(data.path);
      setDirectories(data.directories);
      setUprojectFiles(data.uprojectFiles);
      setIsUEProject(data.isUEProject);
      setParentPath(data.parent);
    } catch {
      setError('Failed to browse directory');
    }
    setLoading(false);
  }, []);

  // Detect engines or projects depending on mode
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    async function init() {
      setDetectLoading(true);

      if (startFresh) {
        // Detect installed UE engines
        try {
          const data = await apiFetch<{ engines: DetectedEngine[] }>('/api/filesystem/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'detect-engines' }),
          });
          const engines: DetectedEngine[] = data.engines ?? [];
          setDetectedEngines(engines);

          // Build suggested project directories
          const suggestions: { label: string; path: string }[] = [];
          const seen = new Set<string>();

          // Suggest Documents/Unreal Projects
          const homeDir = await getHomeDir();
          if (homeDir) {
            const docsUE = `${homeDir}\\Documents\\Unreal Projects`;
            suggestions.push({ label: 'Documents / Unreal Projects', path: docsUE });
            seen.add(docsUE.toLowerCase());
          }

          // Suggest engine parent directories (e.g., C:\Program Files\Epic Games)
          for (const engine of engines) {
            const engineParent = engine.path.replace(/\\[^\\]+$/, '');
            const key = engineParent.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              suggestions.push({ label: `Epic Games (${engineParent})`, path: engineParent });
            }
          }

          // Suggest home directory
          if (homeDir) {
            const key = homeDir.toLowerCase();
            if (!seen.has(key)) {
              suggestions.push({ label: 'Home Directory', path: homeDir });
            }
          }

          setSuggestedDirs(suggestions);

          // Auto-fire engine version for the latest detected engine
          if (engines.length > 0 && onEngineDetected) {
            const majorMinor = engines[0].version;
            onEngineDetected(majorMinor);
          }

          // Auto-navigate to first suggestion
          if (suggestions.length > 0) {
            browse(suggestions[0].path);
          } else if (homeDir) {
            browse(homeDir);
          } else {
            browse(value || '~');
          }
        } catch {
          browse(value || '~');
        }
      } else {
        // Detect existing UE projects
        try {
          const data = await apiFetch<{ projects: DetectedProject[] }>('/api/filesystem/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'detect-projects' }),
          });
          setDetectedProjects(data.projects ?? []);
        } catch {
          // Non-critical
        }
        browse(value || '~');
      }

      setDetectLoading(false);
    }

    init();
  }, [value, browse, startFresh, onEngineDetected]);

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pathInput.trim()) {
      browse(pathInput.trim());
    }
  };

  const navigateUp = () => {
    if (parentPath) browse(parentPath);
  };

  const navigateHome = () => {
    browse('~');
  };

  const navigateDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ drives: { letter: string; path: string }[] }>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drives' }),
      });
      const drives = data.drives ?? [];
      setDirectories(
        drives.map((d) => ({
          name: `${d.letter}:\\`,
          path: d.path,
          hasUProject: false,
        }))
      );
      setCurrentPath('');
      setPathInput('');
      setParentPath(null);
      setUprojectFiles([]);
      setIsUEProject(false);
    } catch {
      setError('Failed to list drives');
    }
    setLoading(false);
  };

  const selectProject = (project: DetectedProject) => {
    onSelect(project.path);
    onProjectDetected?.(project.name, project.path);
    browse(project.path);
  };

  const selectSuggestion = (dir: { label: string; path: string }) => {
    onSelect(dir.path);
    browse(dir.path);
  };

  const handleEngineClick = (engine: DetectedEngine) => {
    onEngineDetected?.(engine.version);
    // Navigate to the engine's parent directory (e.g., C:\Program Files\Epic Games)
    const engineParent = engine.path.replace(/\\[^\\]+$/, '');
    onSelect(engineParent);
    browse(engineParent);
  };

  const selectDirectory = () => {
    if (currentPath) {
      onSelect(currentPath);
      if (isUEProject && uprojectFiles.length > 0) {
        const name = uprojectFiles[0].replace('.uproject', '');
        onProjectDetected?.(name, currentPath);
      }
    }
  };

  const clickDirectory = (dir: DirectoryEntry) => {
    browse(dir.path);
    // If clicking a directory that has a .uproject, auto-select in "existing project" mode
    if (dir.hasUProject && !startFresh) {
      onSelect(dir.path);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-[#0d0d24]">
      {/* Path bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
        <FolderOpen className="w-4 h-4 text-[#00ff88] shrink-0" />
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
                <span className="text-xs text-[#3b82f6] font-medium">UE {engine.version}</span>
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
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#00ff88]/5 transition-colors"
              >
                <ChevronRight className="w-3 h-3 text-[#00ff88] shrink-0" />
                <span className="text-xs text-[#00ff88] font-medium">{dir.label}</span>
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
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#00ff88]/5 transition-colors group"
              >
                <ChevronRight className="w-3 h-3 text-[#00ff88] shrink-0" />
                <span className="text-xs text-[#00ff88] font-medium">{project.name}</span>
                {project.engineVersion && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]/80 shrink-0">
                    {project.engineVersion}
                  </span>
                )}
                {!project.validated && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400/70 shrink-0" title="Missing Config/DefaultEngine.ini — may be incomplete">
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
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 border-b border-border">{error}</div>
      )}

      {/* Directory listing */}
      <div className="max-h-[200px] overflow-y-auto">
        {directories.length === 0 && !loading && currentPath && (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            Empty directory
          </div>
        )}
        {directories.map((dir) => (
          <button
            key={dir.path}
            onClick={() => clickDirectory(dir)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              dir.hasUProject
                ? 'hover:bg-[#00ff88]/5 bg-[#00ff88]/[0.02]'
                : 'hover:bg-surface-hover'
            }`}
          >
            <Folder
              className={`w-3.5 h-3.5 shrink-0 ${dir.hasUProject ? 'text-[#00ff88]' : 'text-text-muted'}`}
            />
            <span
              className={`text-xs truncate ${dir.hasUProject ? 'text-[#00ff88]' : 'text-text'}`}
            >
              {dir.name}
            </span>
            {dir.hasUProject && (
              <span className="text-2xs text-[#00ff88]/70 ml-auto shrink-0">UE Project</span>
            )}
          </button>
        ))}
      </div>

      {/* .uproject indicator */}
      {isUEProject && uprojectFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-[#00ff88]/[0.03]">
          {uprojectFiles.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-[#00ff88]" />
              <span className="text-xs text-[#00ff88]">{f}</span>
              <span className="text-2xs text-[#00ff88]/60 ml-1">UE project found!</span>
            </div>
          ))}
        </div>
      )}

      {/* Select button */}
      <div className="px-3 py-2 border-t border-border">
        <button
          onClick={selectDirectory}
          disabled={!currentPath}
          className="w-full py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 hover:bg-[#00ff88]/20"
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

async function getHomeDir(): Promise<string | null> {
  try {
    const data = await apiFetch<{ path: string }>('/api/filesystem/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', path: '~' }),
    });
    return data.path ?? null;
  } catch {
    return null;
  }
}
