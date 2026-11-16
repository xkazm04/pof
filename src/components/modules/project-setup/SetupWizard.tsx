'use client';

import { useState, useEffect } from 'react';
import { Rocket, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { slugifyForTestId } from '@/lib/test-ids';
import { StatusDot } from '@/components/ui/StatusDot';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/modules/project-setup/ErrorBanner';
import { useNewProjectPlan } from '@/components/modules/project-setup/useNewProjectPlan';
import type { PlanIssue } from '@/lib/project-setup/newProjectPlan';
import { engineFit, engineFitNote, orderByEngineFit } from '@/lib/project-setup/engineFloor';
import { useActiveGameStore, gameUrl } from '@/stores/activeGameStore';
import type { GameId } from '@/lib/games/types';

/** The one Unreal version PoF is built and verified against. Older projects still open (the
 *  recorded engine is a floor, see `engineFloor`); there is no toggle for earlier releases. */
const UE_VERSIONS = [
  { value: '5.8.0', label: '5.8', note: 'tooling default' },
] as const;

type Engine = 'ue5' | 'godot';

interface DetectedGodotProject {
  gameId: GameId;
  name: string;
  path: string;
  root: string;
  engineVersion: string;
  validated: boolean;
}

/** The pill value for an installed engine version (same major.minor), else the raw version. */
const pillValueFor = (version: string) =>
  UE_VERSIONS.find((v) => version.startsWith(v.value.split('.').slice(0, 2).join('.')))?.value ?? version;

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

const scanFailure = (e: unknown) => (e instanceof Error ? e.message : 'The scan did not complete');

/** A project scan that failed: its reason and a retry, in place of the "nothing found" row. */
function DetectError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-4" data-testid="pof-setup-wizard-detect-error">
      <ErrorBanner message={`Could not scan for projects: ${message}`} />
      <div className="text-center mt-3">
        <button type="button" data-testid="pof-setup-wizard-detect-retry" onClick={onRetry} className={LINK_CLASSES}>
          Retry
        </button>
      </div>
    </div>
  );
}

/** First-run landing in the app's design system (surface cards, accent-setup,
 *  underline tabs). Pick a UE version, then open a detected project or start fresh. */
export function SetupWizard() {
  const [mode, setMode] = useState<'existing' | 'fresh'>('existing');
  const [newName, setNewName] = useState('');
  const [projects, setProjects] = useState<DetectedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [engine, setEngine] = useState<Engine>('ue5');
  const [godotProjects, setGodotProjects] = useState<DetectedGodotProject[]>([]);
  const [godotLoading, setGodotLoading] = useState(true);
  // A failed scan is not an empty machine: the "nothing found" rows must not claim it.
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [godotError, setGodotError] = useState<string | null>(null);
  const [projectsAttempt, setProjectsAttempt] = useState(0);
  const [godotAttempt, setGodotAttempt] = useState(0);

  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const { plan, engines, root, retry } = useNewProjectPlan(newName, ueVersion);
  const installed = engines ? new Set(engines.map((e) => e.version.split('.').slice(0, 2).join('.'))) : null;

  // Scan for existing projects on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setProjectsError(null);
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
      } catch (e) {
        if (!cancelled) setProjectsError(scanFailure(e));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectsAttempt]);

  // Godot projects (a folder with project.godot) of the registered Godot games, e.g. RTAI
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setGodotLoading(true);
      setGodotError(null);
      try {
        const data = await apiFetch<{ projects: DetectedGodotProject[] }>(
          '/api/filesystem/browse',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'detect-godot-projects' }),
          },
        );
        if (!cancelled) setGodotProjects(data.projects ?? []);
      } catch (e) {
        if (!cancelled) setGodotError(scanFailure(e));
      }
      if (!cancelled) setGodotLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [godotAttempt]);

  // Derived: the recorded engine is a floor, not a pin. Every project is listed; matches
  // first, a project built on a NEWER engine than the selected one carries a warning.
  const selectedMajorMinor = ueVersion.split('.').slice(0, 2).join('.');
  const orderedProjects = orderByEngineFit(projects, ueVersion);
  const matchCount = orderedProjects.filter((p) => p.fit.kind === 'match').length;

  // Open an existing project — one click
  const handleOpenExisting = (project: DetectedProject) => {
    const matchedVersion = project.engineVersion
      ? UE_VERSIONS.find((v) => engineFit(project.engineVersion, v.value).kind === 'match')?.value ?? ueVersion
      : ueVersion;

    setProject({
      projectName: project.name,
      projectPath: project.path,
      ueVersion: matchedVersion,
      isNewProject: false,
    });
    completeSetup();
  };

  // Open a Godot project: it is a game workspace, not a UE module set. Select its game (the
  // lab and /status show that game's pipelines) and write `g` so a stale URL cannot win.
  const handleOpenGodot = (project: DetectedGodotProject) => {
    setProject({ projectName: project.name, projectPath: project.path, isNewProject: false });
    useActiveGameStore.getState().setGame(project.gameId);
    const next = gameUrl(window.location.href, project.gameId);
    if (next) window.history.replaceState(window.history.state, '', next);
    completeSetup();
  };

  // Start a fresh project — only a plan with no blockers (real root, buildable name, no collision)
  const handleStartFresh = () => {
    if (!plan.canCreate || !plan.projectPath) return;
    setProject({ projectName: plan.identifier, projectPath: plan.projectPath, isNewProject: true });
    completeSetup();
  };

  // The name collides with an existing UE project: open it instead of scaffolding over it
  const handleOpenCollision = (target: NonNullable<PlanIssue['openExisting']>) => {
    const key = target.path.toLowerCase();
    const detected = projects.find((p) => p.path.toLowerCase() === key);
    if (detected) return handleOpenExisting(detected);
    setProject({ projectName: target.name, projectPath: target.path, isNewProject: false });
    completeSetup();
  };

  // 'empty' is not an error to show; 'root-pending' is a transient status line.
  const shownIssues = plan.issues.filter((i) => i.code !== 'empty' && i.code !== 'root-pending');
  const nameError = newName.length > 0 && shownIssues.length > 0;

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

        {/* Engine pills: Unreal 5.8 (the version in use) or Godot */}
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          {UE_VERSIONS.map((v) => {
            const active = engine === 'ue5';
            return (
              <button
                key={v.value}
                type="button"
                data-testid={`pof-setup-wizard-version-pill-${v.value}`}
                aria-pressed={active}
                onClick={() => { setEngine('ue5'); setProject({ ueVersion: v.value }); }}
                title={installed ? `${v.note} · ${installed.has(v.label) ? 'installed' : 'not installed'}` : v.note}
                data-installed={installed ? String(installed.has(v.label)) : undefined}
                className={`focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-accent-medium text-accent-setup border-accent-strong'
                    : 'bg-surface-deep text-text-muted border-border hover:text-text hover:border-border-bright'
                }`}
              >
                UE {v.label}
                {installed?.has(v.label) && <StatusDot state="ok" size="xs" label="installed" />}
              </button>
            );
          })}
          <button
            type="button"
            data-testid="pof-setup-wizard-engine-pill-godot"
            aria-pressed={engine === 'godot'}
            onClick={() => { setEngine('godot'); setMode('existing'); }}
            title="Open a Godot project (a folder with project.godot)"
            className={`focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              engine === 'godot'
                ? 'bg-accent-medium text-accent-setup border-accent-strong'
                : 'bg-surface-deep text-text-muted border-border hover:text-text hover:border-border-bright'
            }`}
          >
            Godot
          </button>
        </div>

        {/* Engine hint */}
        <p className="text-center text-xs text-text-subtle mb-5">
          {engine === 'godot'
            ? 'Godot projects open in their game workspace'
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
          {engine === 'ue5' && (
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
          )}
        </div>

        {/* === Open Existing === */}
        {engine === 'godot' && (
          <div data-testid="pof-setup-wizard-godot-list">
            {godotLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning for Godot projects…</span>
              </div>
            ) : godotError ? (
              <DetectError message={godotError} onRetry={() => setGodotAttempt((n) => n + 1)} />
            ) : godotProjects.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {godotProjects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    data-testid={`pof-setup-wizard-godot-item-${slugifyForTestId(project.gameId)}`}
                    onClick={() => handleOpenGodot(project)}
                    className="focus-ring w-full flex items-center gap-3 p-3 text-left bg-surface-deep border border-border rounded-lg hover:bg-surface-hover hover:border-border-bright transition-all"
                  >
                    <FolderOpen className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{project.name}</p>
                      <p className="text-xs text-text-muted font-mono truncate">{project.path}</p>
                    </div>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-2xs font-medium bg-accent-medium text-accent-setup border border-accent-strong">
                      Godot {project.engineVersion}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 text-text-subtle mx-auto mb-3" />
                <p className="text-sm text-text-muted">No Godot projects found</p>
                <p className="text-xs text-text-subtle mt-1">A registered game&apos;s folder must hold a project.godot</p>
              </div>
            )}
          </div>
        )}

        {engine === 'ue5' && mode === 'existing' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning for UE projects…</span>
              </div>
            ) : projectsError ? (
              <DetectError message={projectsError} onRetry={() => setProjectsAttempt((n) => n + 1)} />
            ) : orderedProjects.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {orderedProjects.map((project) => {
                  const note = engineFitNote(project.fit, project.engineVersion, ueVersion);
                  return (
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
                    {note && <StatusDot state="warn" size="md" title={note} label={note} />}
                    {!project.validated && (
                      <StatusDot state="warn" size="md" title="Missing Config — may be incomplete" label="Unverified project" />
                    )}
                  </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 text-text-subtle mx-auto mb-3" />
                <p className="text-sm text-text-muted">No UE projects found</p>
                <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                  <button type="button" onClick={() => setMode('fresh')} className={LINK_CLASSES}>
                    Start fresh project
                  </button>
                </div>
              </div>
            )}

            {!loading && projects.length > 0 && (
              <p className="text-xs text-text-muted text-center mt-3">
                {matchCount} of {projects.length} projects built on UE {selectedMajorMinor}
              </p>
            )}
          </div>
        )}

        {/* === Start Fresh === */}
        {engine === 'ue5' && mode === 'fresh' && (
          <div className="pt-4">
            <input
              type="text"
              data-testid="pof-setup-wizard-project-name-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartFresh()}
              placeholder="Project name"
              autoFocus
              className={`w-full px-3 py-2 bg-surface-deep border rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors ${
                nameError
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-border focus:border-border-bright'
              }`}
            />
            <p className="text-xs text-text-muted font-mono mt-2 truncate" data-testid="pof-setup-wizard-project-path">
              {plan.projectPath ?? root ?? 'Resolving your Unreal Projects folder…'}
            </p>
            {newName.length > 0 && shownIssues.map((issue) => (
              <div key={issue.code} data-testid={`pof-setup-wizard-issue-${issue.code}`} className="flex items-center gap-2 mt-2 flex-wrap">
                <p className="text-xs text-red-400">{issue.message}</p>
                {issue.openExisting && (
                  <button type="button" data-testid="pof-setup-wizard-open-existing" className={LINK_CLASSES}
                    onClick={() => handleOpenCollision(issue.openExisting!)}>
                    Open it instead
                  </button>
                )}
                {issue.code === 'root-unreadable' && (
                  <button type="button" onClick={retry} className={LINK_CLASSES}>Retry</button>
                )}
              </div>
            ))}
            {plan.suggestion && (
              <button type="button" data-testid="pof-setup-wizard-name-suggestion" onClick={() => setNewName(plan.suggestion!)}
                className="focus-ring mt-2 px-2 py-0.5 rounded text-xs font-mono bg-accent-medium text-accent-setup border border-accent-strong">
                Use {plan.suggestion}
              </button>
            )}
            {plan.advisories.map((a) => (
              <div key={a.code} className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusDot state="warn" size="sm" />
                <p className="text-xs text-text-muted">{a.message}</p>
                {a.suggestedVersion && (
                  <button type="button" data-testid="pof-setup-wizard-engine-switch" className={LINK_CLASSES}
                    onClick={() => setProject({ ueVersion: pillValueFor(a.suggestedVersion!) })}>
                    Switch to UE {a.suggestedVersion}
                  </button>
                )}
                {a.install && (
                  <a href={a.install.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>{a.install.label}</a>
                )}
              </div>
            ))}
            <Button
              data-testid="pof-setup-wizard-create-btn"
              intent="primary"
              onClick={handleStartFresh}
              disabled={!plan.canCreate}
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
