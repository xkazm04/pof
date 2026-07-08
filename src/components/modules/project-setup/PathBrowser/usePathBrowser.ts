import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { getHomeDir } from './helpers';
import type {
  DirectoryEntry,
  DetectedProject,
  DetectedEngine,
  ListResponse,
  PathBrowserProps,
} from './types';

export function usePathBrowser({
  value,
  startFresh,
  onSelect,
  onProjectDetected,
  onEngineDetected,
}: PathBrowserProps) {
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

  return {
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
  };
}
