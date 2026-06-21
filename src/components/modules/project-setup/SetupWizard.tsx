'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { Rocket, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { slugifyForTestId } from '@/lib/test-ids';
import { StatusDot } from '@/components/ui/StatusDot';
import { labFontVars } from '@/components/layout-lab/fonts';
import { Button, Panel, Input, Chip } from '@/components/layout-lab/ui';

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

/** Mono accent text-link used in the empty-state row. */
const linkStyle: CSSProperties = {
  fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-accent)',
  background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
  textUnderlineOffset: 2,
};

/** First-run landing, in the lab's Blueprint identity (data-theme + --lab-* tokens).
 *  Pick a UE version, then open a detected project or start fresh. */
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

  const tabStyle = (active: boolean): CSSProperties => ({
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--lab-s2)',
    padding: 'var(--lab-s3)', fontSize: 'var(--lab-fs-sm)', fontFamily: 'var(--lab-font-body)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    borderBottom: active ? '2px solid var(--lab-accent)' : '2px solid transparent',
    color: active ? 'var(--lab-ink)' : 'var(--lab-muted)',
    transition: 'color var(--lab-dur-fast) var(--lab-ease)',
  });

  return (
    <div
      data-theme="blueprint"
      data-lab-root
      className={labFontVars}
      style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--lab-s6)', background: 'var(--lab-bg)', color: 'var(--lab-text)',
        fontFamily: 'var(--lab-font-body)',
        backgroundImage: 'var(--lab-grid-image)', backgroundSize: 'var(--lab-grid-size)',
      }}
    >
      <Panel style={{ width: '100%', maxWidth: 560, padding: 'var(--lab-s7)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--lab-s3)', marginBottom: 'var(--lab-s6)' }}>
          <Rocket style={{ width: 28, height: 28, color: 'var(--lab-accent)' }} />
          <div>
            <h1 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--lab-ink)', lineHeight: 1 }}>POF</h1>
            <p style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lab-muted)', marginTop: 4 }}>Power of Fun</p>
          </div>
        </div>

        {/* UE Version pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--lab-s2)', marginBottom: 'var(--lab-s2)', flexWrap: 'wrap' }}>
          {UE_VERSIONS.map((v) => (
            <Button
              key={v.value}
              data-testid={`pof-setup-wizard-version-pill-${v.value}`}
              mono
              active={ueVersion === v.value}
              onClick={() => setProject({ ueVersion: v.value })}
              title={v.note}
            >
              UE {v.label}
            </Button>
          ))}
        </div>

        {/* Version hint */}
        <p style={{ textAlign: 'center', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginBottom: 'var(--lab-s5)' }}>
          {ueVersion.startsWith('5.5')
            ? 'Full AI training data'
            : `Web search for UE ${selectedMajorMinor} API changes`}
        </p>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--lab-line)', marginBottom: 'var(--lab-s4)' }}>
          <button
            type="button"
            data-testid="pof-setup-wizard-tab-existing"
            onClick={() => setMode('existing')}
            className="focus-ring"
            style={tabStyle(mode === 'existing')}
          >
            <FolderOpen style={{ width: 14, height: 14 }} />
            Open Existing
          </button>
          <button
            type="button"
            data-testid="pof-setup-wizard-tab-fresh"
            onClick={() => setMode('fresh')}
            className="focus-ring"
            style={tabStyle(mode === 'fresh')}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Start Fresh
          </button>
        </div>

        {/* === Open Existing === */}
        {mode === 'existing' && (
          <div>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--lab-s2)', padding: 'var(--lab-s7) 0', color: 'var(--lab-muted)' }}>
                <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 'var(--lab-fs-sm)' }}>Scanning for UE projects…</span>
              </div>
            ) : filteredProjects.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lab-s2)', maxHeight: 320, overflowY: 'auto' }}>
                {filteredProjects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    data-testid={`pof-setup-wizard-project-item-${slugifyForTestId(project.name)}`}
                    onClick={() => handleOpenExisting(project)}
                    className="focus-ring"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--lab-s3)',
                      padding: 'var(--lab-s3)', textAlign: 'left', cursor: 'pointer',
                      background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)',
                    }}
                  >
                    <FolderOpen style={{ width: 16, height: 16, color: 'var(--lab-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: 500, color: 'var(--lab-text)' }}>{project.name}</p>
                      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.path}</p>
                    </div>
                    {project.engineVersion && <Chip tone="accent">{project.engineVersion}</Chip>}
                    {!project.validated && (
                      <StatusDot state="warn" size="md" title="Missing Config — may be incomplete" label="Unverified project" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--lab-s7) 0' }}>
                <FolderOpen style={{ width: 32, height: 32, color: 'var(--lab-line)', margin: '0 auto var(--lab-s3)' }} />
                <p style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>No UE {selectedMajorMinor} projects found</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--lab-s3)', marginTop: 'var(--lab-s3)' }}>
                  {UE_VERSIONS.filter((v) => v.value !== ueVersion).map((v) => (
                    <button key={v.value} type="button" className="focus-ring" onClick={() => setProject({ ueVersion: v.value })} style={linkStyle}>
                      Switch to {v.label}
                    </button>
                  ))}
                  <span style={{ color: 'var(--lab-line)' }}>|</span>
                  <button type="button" className="focus-ring" onClick={() => setMode('fresh')} style={linkStyle}>
                    Start fresh project
                  </button>
                </div>
              </div>
            )}

            {!loading && projects.length > 0 && (
              <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', textAlign: 'center', marginTop: 'var(--lab-s3)' }}>
                {filteredProjects.length} of {projects.length} projects match UE {selectedMajorMinor}
              </p>
            )}
          </div>
        )}

        {/* === Start Fresh === */}
        {mode === 'fresh' && (
          <div style={{ paddingTop: 'var(--lab-s4)' }}>
            <Input
              type="text"
              data-testid="pof-setup-wizard-project-name-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameValid && handleStartFresh()}
              placeholder="Project name"
              autoFocus
              style={{ fontSize: 'var(--lab-fs-sm)', padding: 'var(--lab-s3)', ...(nameError ? { borderColor: 'var(--lab-bad)' } : {}) }}
            />
            {nameError ? (
              <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-bad)', marginTop: 'var(--lab-s2)' }}>{nameError}</p>
            ) : (
              <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginTop: 'var(--lab-s2)' }}>
                {newName.trim() ? `${DEFAULT_PROJECTS_DIR}\\${newName.trim()}` : DEFAULT_PROJECTS_DIR}
              </p>
            )}
            <Button
              data-testid="pof-setup-wizard-create-btn"
              variant="accent"
              onClick={handleStartFresh}
              disabled={!nameValid}
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--lab-s4)', padding: 'var(--lab-s3)', opacity: nameValid ? 1 : 0.4, cursor: nameValid ? 'pointer' : 'not-allowed' }}
            >
              <Rocket style={{ width: 16, height: 16 }} />
              Create &amp; Launch
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
