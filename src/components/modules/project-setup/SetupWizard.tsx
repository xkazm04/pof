'use client';

import { useState, useMemo } from 'react';
import { Rocket, Folder, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { PathBrowser } from './PathBrowser';

const INVALID_PATH_CHARS = /[<>:"|?*]/;

export function SetupWizard() {
  const [startFresh, setStartFresh] = useState(true);
  const [pathValidated, setPathValidated] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // Validation
  const nameEmpty = projectName.trim().length === 0;
  const nameHasInvalidChars = INVALID_PATH_CHARS.test(projectName);
  const nameError = nameTouched
    ? nameEmpty
      ? 'Project name is required'
      : nameHasInvalidChars
        ? 'Name contains invalid path characters: < > : " | ? *'
        : null
    : null;
  const nameValid = !nameEmpty && !nameHasInvalidChars;
  const pathSelected = projectPath.trim().length > 0 && pathValidated;

  const canProceed = nameValid && pathSelected;

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!nameValid) missing.push('project name');
    if (!pathSelected) missing.push('project path');
    return missing;
  }, [nameValid, pathSelected]);

  const handleComplete = () => {
    // When starting fresh, the full project root = parentDir/projectName
    const fullProjectPath = startFresh
      ? `${projectPath}\\${projectName}`
      : projectPath;

    setProject({ isNewProject: startFresh, projectPath: fullProjectPath });
    completeSetup();
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Rocket className="w-8 h-8 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-text">POF</h1>
            <p className="text-xs text-text-muted">Power of Fun - Game Dev Assistant</p>
          </div>
        </div>

        {/* Project Config */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Folder className="w-5 h-5 text-[#00ff88]" />
            <h2 className="text-lg font-semibold text-text">Project Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Project Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProject({ projectName: e.target.value })}
                  onBlur={() => setNameTouched(true)}
                  placeholder="MyAwesomeGame"
                  className={`w-full px-3 py-2 bg-surface border rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors ${
                    nameError
                      ? 'border-[#f87171] focus:border-[#f87171]'
                      : nameTouched && nameValid
                        ? 'border-[#4ade80]/40 focus:border-[#4ade80]/60'
                        : 'border-border focus:border-border-bright'
                  }`}
                />
                {nameTouched && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {nameValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-[#f87171]" />
                    )}
                  </span>
                )}
              </div>
              {nameError && (
                <p className="text-xs text-[#f87171] mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-xs text-text-muted flex items-center gap-1.5">
                  Project Path
                  {pathSelected ? (
                    <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
                  ) : projectPath.trim() ? (
                    <XCircle className="w-3 h-3 text-[#f87171]" />
                  ) : null}
                </label>
                <button
                  onClick={() => setStartFresh(!startFresh)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                    startFresh
                      ? 'bg-accent-medium border-accent-strong text-[#00ff88]'
                      : 'bg-surface border-border text-text-muted hover:border-border-bright'
                  }`}
                >
                  {startFresh ? 'Starting fresh' : 'I have a project'}
                </button>
              </div>
              <PathBrowser
                value={projectPath}
                startFresh={startFresh}
                onSelect={(path) => {
                  setProject({ projectPath: path });
                  setPathValidated(true);
                }}
                onProjectDetected={(name) => {
                  if (!projectName.trim()) {
                    setProject({ projectName: name });
                  }
                }}
                onEngineDetected={(version) => {
                  // Match detected version to closest dropdown option
                  const options = ['5.5.4', '5.6.1', '5.7.3'];
                  const majorMinor = version.split('.').slice(0, 2).join('.');
                  const match = options.find((o) => o.startsWith(majorMinor));
                  setProject({ ueVersion: match || version });
                }}
              />
              <p className="text-xs text-text-muted mt-1">
                {startFresh
                  ? 'Claude will create the full project structure in this directory'
                  : 'Browse to your existing .uproject root'}
              </p>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">UE Version</label>
              <select
                value={ueVersion}
                onChange={(e) => setProject({ ueVersion: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text outline-none focus:border-border-bright"
              >
                <option value="5.5.4">UE 5.5.4 (best AI coverage)</option>
                <option value="5.6.1">UE 5.6.1 (web search for setup)</option>
                <option value="5.7.3">UE 5.7.3 (web search for setup)</option>
              </select>
              {ueVersion.startsWith('5.5') ? (
                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  Best coverage — Claude has full training data for UE 5.5 APIs.
                </p>
              ) : (
                <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  Claude will web search UE {ueVersion} specific setup procedures and API changes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Launch button */}
        <div className="flex items-center justify-end gap-3 mt-8">
          {!canProceed && missingFields.length > 0 && (
            <p className="text-xs text-text-muted">
              Missing: {missingFields.join(', ')}
            </p>
          )}
          <button
            onClick={handleComplete}
            disabled={!canProceed}
            className="flex items-center gap-1 px-6 py-2 bg-[#00ff88] text-background rounded-lg text-sm font-semibold hover:bg-[#00ff88]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket className="w-4 h-4" />
            Launch POF
          </button>
        </div>
      </div>
    </div>
  );
}
