'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';

export interface DetectedEngine {
  version: string;
  path: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  hasUProject: boolean;
}

interface ListResponse {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
  uprojectFiles: string[];
  isUEProject: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  subDetail?: string;
}

/** Lifecycle of the project scan, for deterministic test waits. */
export type ScanState = 'idle' | 'scanning' | 'settled';

/**
 * Encapsulates the environment scanning state machine:
 * engine detection, tooling detection, project path validation, and directory scanning.
 */
export function useProjectScan(projectPath: string) {
  const [engines, setEngines] = useState<DetectedEngine[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  // The path the auto-scan last ran for. Comparing by VALUE (not a boolean)
  // keeps the StrictMode double-mount protection while still rescanning when
  // the user switches projects — a stale checklist here drives the
  // NextStepBanner's "Create project" CTA, which would scaffold over an
  // existing project (SP-A Finding A + scan finding project-setup #1).
  const scannedPath = useRef<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setScanState('scanning');
    const items: ChecklistItem[] = [];
    let detectedEngines: DetectedEngine[] = [];
    let dirData: ListResponse | null = null;

    // 1. Detect engines
    try {
      const data = await apiFetch<{ engines: DetectedEngine[] }>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect-engines' }),
      });
      detectedEngines = data.engines ?? [];
    } catch {
      // Non-critical
    }
    setEngines(detectedEngines);

    if (detectedEngines.length > 0) {
      const eng = detectedEngines[0];
      items.push({
        id: 'engine',
        label: 'Unreal Engine',
        ok: true,
        detail: `UE ${eng.version} detected`,
        subDetail: eng.path,
      });
    } else {
      items.push({
        id: 'engine',
        label: 'Unreal Engine',
        ok: false,
        detail: 'Not found',
      });
    }

    // 2. Detect developer tooling
    let detectedTools: { id: string; name: string; ok: boolean; detail: string; path?: string }[] = [];
    try {
      const data = await apiFetch<{ tools: typeof detectedTools }>('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect-tooling' }),
      });
      detectedTools = data.tools ?? [];
    } catch {
      // Non-critical
    }

    for (const tool of detectedTools) {
      items.push({
        id: `tool-${tool.id}`,
        label: tool.name,
        ok: tool.ok,
        detail: tool.detail,
        subDetail: tool.path,
      });
    }

    // Project path
    if (projectPath.trim()) {
      items.push({ id: 'path', label: 'Project Path', ok: true, detail: projectPath });
    } else {
      items.push({ id: 'path', label: 'Project Path', ok: false, detail: 'No path configured' });
    }

    // Scan project directory
    if (projectPath.trim()) {
      try {
        dirData = await apiFetch<ListResponse>('/api/filesystem/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', path: projectPath }),
        });
      } catch {
        // Non-critical
      }
    }

    // UE Project check
    if (dirData?.isUEProject) {
      items.push({ id: 'uproject', label: 'UE Project', ok: true, detail: dirData.uprojectFiles[0] });
    } else {
      items.push({ id: 'uproject', label: 'UE Project', ok: false, detail: 'No .uproject found' });
    }

    // Source directory check
    const hasSource = dirData?.directories.some((d) => d.name === 'Source') ?? false;
    items.push({
      id: 'source',
      label: 'Source Directory',
      ok: hasSource,
      detail: hasSource ? 'Source/ found' : 'No Source/ folder',
    });

    // Build files check — list Source ONCE here and reuse below for the
    // projectFiles enumeration (collapses two identical `list` round-trips
    // for `<project>\Source` into one).
    let sourceData: ListResponse | null = null;
    let hasBuildFiles = false;
    if (hasSource) {
      try {
        sourceData = await apiFetch<ListResponse>('/api/filesystem/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', path: `${projectPath}\\Source` }),
        });
        hasBuildFiles = sourceData.directories.length > 0;
      } catch {
        // Non-critical
      }
    }
    items.push({
      id: 'build',
      label: 'Build Files',
      ok: hasBuildFiles,
      detail: hasBuildFiles ? 'Build files found' : 'No build files',
    });

    setChecklist(items);

    // Build project files list if project exists
    const files: string[] = [];
    if (dirData?.isUEProject && projectPath.trim()) {
      for (const uf of dirData.uprojectFiles) {
        files.push(`${projectPath}\\${uf}`);
      }
      // Reuse the `sourceData` already fetched for the Build Files check above
      // instead of re-listing `<project>\Source`. When hasSource is true and the
      // earlier list succeeded, sourceData holds the identical response.
      if (hasSource && sourceData) {
        for (const d of sourceData.directories) {
          files.push(`Source\\${d.name}\\`);
        }
        for (const uf of sourceData.uprojectFiles) {
          files.push(`Source\\${uf}`);
        }
      }
    }
    setProjectFiles(files);
    setScanning(false);
    setScanState('settled');
  }, [projectPath]);

  useEffect(() => {
    if (scannedPath.current === projectPath) return;
    scannedPath.current = projectPath;
    // Defer scan() off the effect body (avoids a synchronous setState cascade)
    // but DO NOT clear the timer on cleanup: under React 19 dev StrictMode the
    // mount→cleanup→mount cycle would clearTimeout the only scheduled scan,
    // while the scannedPath ref persists across cleanup and blocks the
    // remount from rescheduling — leaving scanState stuck at 'idle' and
    // BuildVerifyPanel never rendering (SP-A Finding A). The ref guard
    // ensures exactly one scheduled scan per project path.
    setTimeout(() => scan(), 0);
  }, [projectPath, scan]);

  const hasProject = checklist.find((c) => c.id === 'uproject')?.ok ?? false;
  const okCount = checklist.filter((c) => c.ok).length;
  const missingToolCount = checklist.filter(
    (c) => !c.ok && (c.id === 'tool-vs' || c.id === 'tool-msvc' || c.id === 'tool-wsdk' || c.id === 'tool-dotnet' || c.id === 'engine'),
  ).length;

  return {
    engines,
    checklist,
    projectFiles,
    scanning,
    scanState,
    scan,
    hasProject,
    okCount,
    missingToolCount,
  };
}
