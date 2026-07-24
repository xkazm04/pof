'use client';

import { useState, useEffect, useMemo } from 'react';
import { Rocket, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { slugifyForTestId } from '@/lib/test-ids';
import { StatusDot } from '@/components/ui/StatusDot';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';

const UE_VERSIONS = [
  { value: '5.5.4', label: '5.5', note: 'best AI coverage' },
  { value: '5.6.1', label: '5.6', note: 'web search for newer APIs' },
  { value: '5.7.3', label: '5.7', note: 'stable' },
  { value: '5.8.0', label: '5.8', note: 'latest' },
] as const;

const DEFAULT_PROJECTS_DIR = 'C:\\Users\\kazda\\Documents\\Unreal Projects';

/** Characters Windows forbids in a path segment. */
const INVALID_CHARS_RE = /[<>:"|?*\\/]/;

interface DetectedProject {
  name: string;
  path: string;
  uprojectFile: string;
  engineVersion: string | null;
  validated: boolean;
}

/** Accent text-link used in the empty-state row (matches the checklist's install links). */
const LINK_CLASSES =
  'focus-ring text-xs font-medium text-accent-core hover:text-accent-core/80 underline underline-offset-2 transition-colors';

/** First-run landing in the app's design system (surface cards, accent-setup,
 *  underline tabs). Pick a UE version, then open a detected project or start fresh. */
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

  const nameValid = newName.trim().length > 0 && !INVALID_CHARS_RE.test(newName);
  const nameError = useMemo(() => {
    if (newName.length === 0) return null;
    if (newName.trim().length === 0) return 'Name cannot be only whitespace';
    if (INVALID_CHARS_RE.test(newName)) {
      const found = [...new Set(newName.split('').filter((c) => INVALID_CHARS_RE.test(c)))];
      return `Name cannot contain ${found.map((c) => `"${c}"`).join(' ')}  — invalid characters: < > : " | ? * \\ /`;
    }
    return null;
  }, [newName]);

  const tabClasses = (active: boolean) =>
    `focus-ring relative flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
      active ? 'text-text' : 'text-text-muted hover:text-text'
    }`;

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <SurfaceCard level={3} className="w-full max-w-lg p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Rocket className="w-7 h-7 text-accent-setup" />
          <div>
            <h1 className="text-xl font-semibold text-text tracking-wide leading-none">POF</h1>
            <p className="text-2xs font-medium text-text-muted uppercase tracking-wider mt-1">
              Power of Fun
            </p>
          </div>
        </div>

        {/* UE Version pills */}
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          {UE_VERSIONS.map((v) => (
            <button
              key={v.value}
              type="button"
              data-testid={`pof-setup-wizard-version-pill-${v.value}`}
              aria-pressed={ueVersion === v.value}
              onClick={() => setProject({ ueVersion: v.value })}
              title={v.note}
              className={`focus-ring px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                ueVersion === v.value
                  ? 'bg-accent-medium text-accent-setup border-accent-strong'
                  : 'bg-surface-deep text-text-muted border-border hover:text-text hover:border-border-bright'
              }`}
            >
              UE {v.label}
            </button>
          ))}
        </div>

        {/* Version hint */}
        <p className="text-center text-xs text-text-subtle mb-5">
          {ueVersion.startsWith('5.5')
            ? 'Full AI training data'
            : `Web search for UE ${selectedMajorMinor} API changes`}
        </p>

        {/* Mode tabs */}
        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            data-testid="pof-setup-wizard-tab-existing"
            onClick={() => setMode('existing')}
            className={tabClasses(mode === 'existing')}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open Existing
            {mode === 'existing' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-accent-setup" />
            )}
          </button>
          <button
            type="button"
            data-testid="pof-setup-wizard-tab-fresh"
            onClick={() => setMode('fresh')}
            className={tabClasses(mode === 'fresh')}
          >
            <Plus className="w-3.5 h-3.5" />
            Start Fresh
            {mode === 'fresh' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-accent-setup" />
            )}
          </button>
        </div>

        {/* === Open Existing === */}
        {mode === 'existing' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning for UE projects…</span>
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {filteredProjects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    data-testid={`pof-setup-wizard-project-item-${slugifyForTestId(project.name)}`}
                    onClick={() => handleOpenExisting(project)}
                    className="focus-ring w-full flex items-center gap-3 p-3 text-left bg-surface-deep border border-border rounded-lg hover:bg-surface-hover hover:border-border-bright transition-all"
                  >
                    <FolderOpen className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{project.name}</p>
                      <p className="text-xs text-text-muted font-mono truncate">{project.path}</p>
                    </div>
                    {project.engineVersion && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-2xs font-medium bg-accent-medium text-accent-setup border border-accent-strong">
                        {project.engineVersion}
                      </span>
                    )}
                    {!project.validated && (
                      <StatusDot state="warn" size="md" title="Missing Config — may be incomplete" label="Unverified project" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 text-text-subtle mx-auto mb-3" />
                <p className="text-sm text-text-muted">No UE {selectedMajorMinor} projects found</p>
                <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                  {UE_VERSIONS.filter((v) => v.value !== ueVersion).map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setProject({ ueVersion: v.value })}
                      className={LINK_CLASSES}
                    >
                      Switch to {v.label}
                    </button>
                  ))}
                  <span className="text-text-subtle">|</span>
                  <button type="button" onClick={() => setMode('fresh')} className={LINK_CLASSES}>
                    Start fresh project
                  </button>
                </div>
              </div>
            )}

            {!loading && projects.length > 0 && (
              <p className="text-xs text-text-muted text-center mt-3">
                {filteredProjects.length} of {projects.length} projects match UE {selectedMajorMinor}
              </p>
            )}
          </div>
        )}

        {/* === Start Fresh === */}
        {mode === 'fresh' && (
          <div className="pt-4">
            <input
              type="text"
              data-testid="pof-setup-wizard-project-name-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameValid && handleStartFresh()}
              placeholder="Project name"
              autoFocus
              className={`w-full px-3 py-2 bg-surface-deep border rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors ${
                nameError
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-border focus:border-border-bright'
              }`}
            />
            {nameError ? (
              <p className="text-xs text-red-400 mt-2">{nameError}</p>
            ) : (
              <p className="text-xs text-text-muted font-mono mt-2 truncate">
                {newName.trim() ? `${DEFAULT_PROJECTS_DIR}\\${newName.trim()}` : DEFAULT_PROJECTS_DIR}
              </p>
            )}
            <Button
              data-testid="pof-setup-wizard-create-btn"
              intent="primary"
              onClick={handleStartFresh}
              disabled={!nameValid}
              leftIcon={<Rocket className="w-4 h-4" />}
              className="w-full justify-center mt-4"
            >
              Create &amp; Launch
            </Button>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
