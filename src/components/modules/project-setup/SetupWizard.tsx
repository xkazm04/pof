'use client';

import { useState } from 'react';
import { Rocket, Folder } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { PathBrowser } from './PathBrowser';

export function SetupWizard() {
  const [startFresh, setStartFresh] = useState(true);
  const [pathValidated, setPathValidated] = useState(false);
  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const canProceed = projectName.trim().length > 0 && projectPath.trim().length > 0 && pathValidated;

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
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProject({ projectName: e.target.value })}
                placeholder="MyAwesomeGame"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-border-bright"
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-xs text-text-muted">Project Path</label>
                <button
                  onClick={() => setStartFresh(!startFresh)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                    startFresh
                      ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
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
              {ueVersion.startsWith('5.6') || ueVersion.startsWith('5.7') ? (
                <p className="text-xs text-amber-400/80 mt-1">
                  Claude will web search UE {ueVersion} specific setup procedures and API changes.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Launch button */}
        <div className="flex items-center justify-end mt-8">
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
