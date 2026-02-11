'use client';

import { useState } from 'react';
import { Rocket, ChevronRight, ChevronLeft, Gamepad2, Folder, Gauge } from 'lucide-react';
import { useProjectStore, type GameGenre, type ExperienceLevel } from '@/stores/projectStore';
import { PathBrowser } from './PathBrowser';

const GENRES: { id: GameGenre; label: string; description: string; icon: string }[] = [
  { id: 'roguelike', label: 'Roguelike', description: 'Procedural dungeons, permadeath, item synergies', icon: '🗡️' },
  { id: 'tower-defense', label: 'Tower Defense', description: 'Wave-based, tower placement, upgrade paths', icon: '🏰' },
  { id: 'platformer', label: 'Platformer', description: 'Movement-focused, level-based, collectibles', icon: '🏃' },
  { id: 'fps', label: 'FPS', description: 'First-person shooting, weapons, enemies', icon: '🔫' },
  { id: 'rpg', label: 'RPG', description: 'Stats, inventory, quests, dialogue', icon: '⚔️' },
  { id: 'puzzle', label: 'Puzzle', description: 'Logic-based, mechanics-driven, progression', icon: '🧩' },
  { id: 'simulation', label: 'Simulation', description: 'Systems management, economy, AI agents', icon: '🏭' },
  { id: 'other', label: 'Other', description: 'Custom game type', icon: '🎮' },
];

const EXPERIENCE_LEVELS: { id: ExperienceLevel; label: string; description: string }[] = [
  { id: 'beginner', label: 'Beginner', description: 'New to UE5 and C++' },
  { id: 'intermediate', label: 'Intermediate', description: 'Some UE5 experience' },
  { id: 'advanced', label: 'Advanced', description: 'Experienced with UE5 C++' },
];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [startFresh, setStartFresh] = useState(true);
  const [pathValidated, setPathValidated] = useState(false);
  const setProject = useProjectStore((s) => s.setProject);
  const completeSetup = useProjectStore((s) => s.completeSetup);
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const gameGenre = useProjectStore((s) => s.gameGenre);
  const experienceLevel = useProjectStore((s) => s.experienceLevel);

  const canProceed = () => {
    switch (step) {
      case 0: return !!gameGenre;
      case 1: return projectName.trim().length > 0 && projectPath.trim().length > 0 && pathValidated;
      case 2: return true;
      default: return false;
    }
  };

  const handleComplete = async () => {
    // When starting fresh, the full project root = parentDir/projectName
    const fullProjectPath = startFresh
      ? `${projectPath}\\${projectName}`
      : projectPath;

    setProject({ isNewProject: startFresh, projectPath: fullProjectPath });

    // Persist to SQLite for server-side access
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectPath: fullProjectPath,
          ueVersion,
          gameGenre: gameGenre ?? '',
          experienceLevel,
          isSetupComplete: 'true',
          isNewProject: String(startFresh),
        }),
      });
    } catch {
      // Non-critical — localStorage still has the data
    }

    completeSetup();
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a1a] px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Rocket className="w-8 h-8 text-[#00ff88]" />
          <div>
            <h1 className="text-2xl font-bold text-[#e0e4f0]">POF</h1>
            <p className="text-xs text-[#6b7294]">Power of Fun - Game Dev Assistant</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-[#00ff88] w-6' : s < step ? 'bg-[#00ff88]/50' : 'bg-[#1e1e3a]'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Genre */}
        {step === 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="w-5 h-5 text-[#00ff88]" />
              <h2 className="text-lg font-semibold text-[#e0e4f0]">What are you building?</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => setProject({ gameGenre: genre.id })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    gameGenre === genre.id
                      ? 'bg-[#00ff88]/10 border-[#00ff88]/30'
                      : 'bg-[#111128] border-[#1e1e3a] hover:border-[#2e2e5a]'
                  }`}
                >
                  <span className="text-2xl">{genre.icon}</span>
                  <p className="text-sm font-medium text-[#e0e4f0] mt-2">{genre.label}</p>
                  <p className="text-[10px] text-[#6b7294] mt-1">{genre.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Project Config */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Folder className="w-5 h-5 text-[#00ff88]" />
              <h2 className="text-lg font-semibold text-[#e0e4f0]">Project Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#6b7294] mb-1 block">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProject({ projectName: e.target.value })}
                  placeholder="MyAwesomeGame"
                  className="w-full px-3 py-2 bg-[#111128] border border-[#1e1e3a] rounded-lg text-sm text-[#e0e4f0] placeholder-[#6b7294] outline-none focus:border-[#2e2e5a]"
                />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs text-[#6b7294]">Project Path</label>
                  <button
                    onClick={() => setStartFresh(!startFresh)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                      startFresh
                        ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
                        : 'bg-[#111128] border-[#1e1e3a] text-[#6b7294] hover:border-[#2e2e5a]'
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
                <p className="text-[10px] text-[#6b7294] mt-1">
                  {startFresh
                    ? 'Claude will create the full project structure in this directory'
                    : 'Browse to your existing .uproject root'}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#6b7294] mb-1 block">UE Version</label>
                <select
                  value={ueVersion}
                  onChange={(e) => setProject({ ueVersion: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111128] border border-[#1e1e3a] rounded-lg text-sm text-[#e0e4f0] outline-none focus:border-[#2e2e5a]"
                >
                  <option value="5.5.4">UE 5.5.4 (best AI coverage)</option>
                  <option value="5.6.1">UE 5.6.1 (web search for setup)</option>
                  <option value="5.7.3">UE 5.7.3 (web search for setup)</option>
                </select>
                {ueVersion.startsWith('5.6') || ueVersion.startsWith('5.7') ? (
                  <p className="text-[10px] text-amber-400/80 mt-1">
                    Claude will web search UE {ueVersion} specific setup procedures and API changes.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Experience Level */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-5 h-5 text-[#00ff88]" />
              <h2 className="text-lg font-semibold text-[#e0e4f0]">Experience Level</h2>
            </div>
            <div className="space-y-3">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setProject({ experienceLevel: level.id })}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    experienceLevel === level.id
                      ? 'bg-[#00ff88]/10 border-[#00ff88]/30'
                      : 'bg-[#111128] border-[#1e1e3a] hover:border-[#2e2e5a]'
                  }`}
                >
                  <p className="text-sm font-medium text-[#e0e4f0]">{level.label}</p>
                  <p className="text-xs text-[#6b7294] mt-1">{level.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 px-4 py-2 text-sm text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : <div />}

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-lg text-sm hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1 px-6 py-2 bg-[#00ff88] text-[#0a0a1a] rounded-lg text-sm font-semibold hover:bg-[#00ff88]/90 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              Launch POF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
