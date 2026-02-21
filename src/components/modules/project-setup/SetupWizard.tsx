'use client';

import { useState, useEffect } from 'react';
import { Rocket, Plus, FolderOpen, Loader2, Info, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';

const UE_VERSIONS = [
  { value: '5.5.4', label: '5.5', note: 'best AI coverage' },
  { value: '5.6.1', label: '5.6', note: 'web search for newer APIs' },
  { value: '5.7.3', label: '5.7', note: 'latest' },
] as const;

const DEFAULT_PROJECTS_DIR = 'C:\\Users\\kazda\\Documents\\Unreal Projects';

interface DetectedProject {
  name: string;
  path: string;
  uprojectFile: string;
  engineVersion: string | null;
  validated: boolean;
}

export function SetupWizard() {
  const [mode, setMode] = useState<'existing' | 'fresh'>('existing');
  const [newName, setNewName] = useState('');
  const [projects, setProjects] = useState<DetectedProject[]>([]);
  const [loading, setLoading] = useState(true);

  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // Scan for existing projects on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<{ projects: DetectedProject[] }>(
          '/api/filesystem/browse',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'detect-projects' }),
          },
        );
        if (!cancelled) setProjects(data.projects ?? []);
      } catch {
        // non-critical
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Derived: filter projects by selected UE major.minor
  const selectedMajorMinor = ueVersion.split('.').slice(0, 2).join('.');
  const filteredProjects = projects.filter((p) => {
    if (!p.engineVersion) return false;
    return p.engineVersion.startsWith(selectedMajorMinor);
  });

  // Open an existing project — one click
  const handleOpenExisting = (project: DetectedProject) => {
    // Match detected version to closest option
    const matchedVersion = project.engineVersion
      ? UE_VERSIONS.find((v) =>
          project.engineVersion!.startsWith(v.value.split('.').slice(0, 2).join('.')),
        )?.value ?? ueVersion
      : ueVersion;

    setProject({
      projectName: project.name,
      projectPath: project.path,
      ueVersion: matchedVersion,
      isNewProject: false,
    });
    completeSetup();
  };

  // Start a fresh project with defaults
  const handleStartFresh = () => {
    const name = newName.trim();
    if (!name) return;
    setProject({
      projectName: name,
      projectPath: `${DEFAULT_PROJECTS_DIR}\\${name}`,
      isNewProject: true,
    });
    completeSetup();
  };

  const nameValid = newName.trim().length > 0 && !/[<>:"|?*\\\/]/.test(newName);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Rocket className="w-7 h-7 text-[#00ff88]" />
          <div>
            <h1 className="text-xl font-bold text-text">POF</h1>
            <p className="text-xs text-text-muted">Power of Fun</p>
          </div>
        </div>

        {/* UE Version pills */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {UE_VERSIONS.map((v) => (
            <button
              key={v.value}
              onClick={() => setProject({ ueVersion: v.value })}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                ueVersion === v.value
                  ? 'bg-[#00ff88] text-background'
                  : 'bg-surface border border-border text-text-muted hover:border-border-bright hover:text-text'
              }`}
            >
              UE {v.label}
            </button>
          ))}
        </div>

        {/* Version hint */}
        <p className="text-center text-xs text-text-muted/60 mb-5">
          {ueVersion.startsWith('5.5')
            ? 'Full AI training data'
            : `Web search for UE ${selectedMajorMinor} API changes`}
        </p>

        {/* Mode tabs */}
        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => setMode('existing')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'existing'
                ? 'text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open Existing
          </button>
          <button
            onClick={() => setMode('fresh')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'fresh'
                ? 'text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Start Fresh
          </button>
        </div>

        {/* === Open Existing === */}
        {mode === 'existing' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning for UE projects...</span>
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredProjects.map((project) => (
                  <button
                    key={project.path}
                    onClick={() => handleOpenExisting(project)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border hover:border-[#00ff88]/40 hover:bg-accent-subtle transition-all text-left group"
                  >
                    <FolderOpen className="w-4 h-4 text-text-muted group-hover:text-[#00ff88] transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text group-hover:text-[#00ff88] transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted truncate">{project.path}</p>
                    </div>
                    {project.engineVersion && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent-medium text-[#00ff88]/80 shrink-0">
                        {project.engineVersion}
                      </span>
                    )}
                    {!project.validated && (
                      <span title="Missing Config — may be incomplete">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                      </span>
                    )}
                    <Rocket className="w-3.5 h-3.5 text-text-muted group-hover:text-[#00ff88] opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FolderOpen className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-text-muted">
                  No UE {selectedMajorMinor} projects found
                </p>
                <p className="text-xs text-text-muted/60 mt-1">
                  Try switching version or start a fresh project
                </p>
              </div>
            )}

            {/* Total project count across all versions */}
            {!loading && projects.length > 0 && (
              <p className="text-xs text-text-muted/50 text-center mt-3">
                {filteredProjects.length} of {projects.length} projects match UE {selectedMajorMinor}
              </p>
            )}
          </div>
        )}

        {/* === Start Fresh === */}
        {mode === 'fresh' && (
          <div className="py-4">
            <div className="mb-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nameValid && handleStartFresh()}
                placeholder="Project name"
                autoFocus
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-[#00ff88]/40 transition-colors"
              />
              <p className="text-xs text-text-muted/60 mt-1.5">
                {newName.trim()
                  ? `${DEFAULT_PROJECTS_DIR}\\${newName.trim()}`
                  : DEFAULT_PROJECTS_DIR}
              </p>
            </div>
            <button
              onClick={handleStartFresh}
              disabled={!nameValid}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00ff88] text-background rounded-lg text-sm font-semibold hover:bg-[#00ff88]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Rocket className="w-4 h-4" />
              Create & Launch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
