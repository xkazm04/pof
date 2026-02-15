'use client';

import { useState } from 'react';
import { Send, Clock, Zap, ChevronRight, ChevronDown, Info, Lightbulb, X } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SUB_MODULE_MAP, getCategoryForSubModule } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { ModuleHeaderDecoration } from './ModuleHeaderDecoration';
import { getModuleName, getAPIMacro, getEnginePath, getBuildCommand } from '@/lib/prompt-context';
import type { SubModuleId, TaskHistoryEntry } from '@/types/modules';

const EMPTY_HISTORY: TaskHistoryEntry[] = [];

interface ModuleShellProps {
  moduleId: SubModuleId;
}

export function ModuleShell({ moduleId }: ModuleShellProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [contextExpanded, setContextExpanded] = useState(false);
  const module = SUB_MODULE_MAP[moduleId];
  const category = getCategoryForSubModule(moduleId);
  const moduleHealth = useModuleStore((s) => s.moduleHealth[moduleId]);
  const moduleHistory = useModuleStore((s) => s.moduleHistory[moduleId]) ?? EMPTY_HISTORY;
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const findSessionByModule = useCLIPanelStore((s) => s.findSessionByModule);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(`pof-art-gap-dismissed-${moduleId}`) === '1';
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(`pof-art-gap-dismissed-${moduleId}`, '1');
  };

  if (!module || !category) return null;

  const Icon = module.icon;
  const accentColor = category.accentColor;

  const sendToTerminal = (prompt: string) => {
    // Find or create a terminal tab for this module
    let tabId = findSessionByModule(moduleId);
    const isNew = !tabId;
    if (!tabId) {
      tabId = createSession({
        label: module.label,
        accentColor,
        moduleId,
        projectPath,
      });
    }
    setActiveTab(tabId);

    // Delay dispatch for new sessions to allow terminal mount
    const dispatch = () => {
      window.dispatchEvent(
        new CustomEvent('pof-cli-prompt', {
          detail: { tabId, prompt },
        })
      );
    };
    if (isNew) {
      setTimeout(dispatch, 150);
    } else {
      dispatch();
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendToTerminal(prompt);
  };

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    sendToTerminal(customPrompt.trim());
    setCustomPrompt('');
  };

  const feasibilityTooltip: Record<string, string> = {
    strong: 'AI-assisted code generation effectiveness for this module. Strong = high success rate, well-suited for automated C++ generation.',
    moderate: 'AI-assisted code generation effectiveness for this module. Moderate = decent success rate, may need manual adjustments for complex patterns.',
    challenging: 'AI-assisted code generation effectiveness for this module. Challenging = lower success rate, expect significant manual review and iteration.',
  };

  const feasibilityBadge = module.feasibilityRating && (
    <span className={`relative group/feas inline-flex items-center cursor-default text-xs px-1.5 py-0.5 rounded border ${
      module.feasibilityRating === 'strong' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
      module.feasibilityRating === 'moderate' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
      'text-red-400 bg-red-400/10 border-red-400/20'
    }`}>
      {module.feasibilityRating}
      <span className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 w-[200px] px-2.5 py-2 rounded bg-surface-hover border border-border-bright text-xs leading-relaxed text-[#b0b4cc] opacity-0 group-hover/feas:opacity-100 transition-opacity">
        {feasibilityTooltip[module.feasibilityRating]}
      </span>
    </span>
  );

  return (
    <main className="p-6 max-w-4xl" aria-label={`${module.label} module`}>
      {/* Header */}
      <div className="relative overflow-hidden flex items-center gap-3 mb-6">
        <ModuleHeaderDecoration moduleId={moduleId} variant="full" />
        <Icon className="w-6 h-6 relative" style={{ color: accentColor }} aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text">{module.label}</h1>
            {feasibilityBadge}
          </div>
          <p className="text-xs text-text-muted">{module.description}</p>
        </div>
      </div>

      {/* Art-gap awareness banner for moderate feasibility modules */}
      {!bannerDismissed && module.feasibilityRating === 'moderate' && (() => {
        const tip = module.knowledgeTips.find((t) => t.source === 'feasibility');
        if (!tip) return null;
        return (
          <div className="mb-6 flex items-start gap-3 bg-amber-500/5 border-l-2 border-amber-400 px-4 py-3 rounded-r-lg">
            <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-300 mb-1">{tip.title}</p>
              <p className="text-xs text-text-muted leading-relaxed">{tip.content}</p>
            </div>
            <button
              onClick={dismissBanner}
              aria-label="Dismiss tip"
              className="p-0.5 rounded hover:bg-[#ffffff10] transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 text-text-muted" />
            </button>
          </div>
        );
      })()}

      {/* Status card */}
      {moduleHealth && moduleHealth.tasksCompleted > 0 && (
        <SurfaceCard className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Tasks completed</span>
            <span className="text-sm font-semibold" style={{ color: accentColor }}>{moduleHealth.tasksCompleted}</span>
          </div>
        </SurfaceCard>
      )}

      {/* Quick Actions */}
      <section className="mb-6" aria-label="Quick actions">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <h2 className="text-sm font-medium text-text">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Available actions">
          {module.quickActions.map((action, index) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.prompt)}
              aria-label={action.label}
              className="text-left flex items-start gap-2.5 px-3 py-3.5 bg-surface border border-border rounded-lg hover:border-border-bright hover:bg-surface-hover transition-all group"
            >
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-2xs font-semibold mt-px"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}24`,
                  border: `1px solid ${accentColor}38`,
                }}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <span className="text-xs font-medium text-text group-hover:text-text">{action.label}</span>
                {action.description && (
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{action.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Ask Claude */}
      <section className="mb-6" aria-label="Ask Claude">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <h2 className="text-sm font-medium text-text">Ask Claude</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${module.label.toLowerCase()}...`}
            aria-label={`Ask about ${module.label.toLowerCase()}`}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim()}
            aria-label="Send prompt"
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accentColor}24`, color: accentColor, border: `1px solid ${accentColor}38` }}
          >
            Send
          </button>
        </div>
      </section>

      {/* Context Preview */}
      <ContextPreview
        projectName={projectName}
        projectPath={projectPath}
        ueVersion={ueVersion}
        moduleLabel={module.label}
        isExpanded={contextExpanded}
        onToggle={() => setContextExpanded((v) => !v)}
      />

      {/* Task History */}
      {moduleHistory.length > 0 && (
        <section aria-label="Task history">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
            <h2 className="text-sm font-medium text-text">History</h2>
          </div>
          <div className="space-y-1" role="list">
            {moduleHistory.slice(-5).reverse().map((entry) => (
              <div key={entry.id} role="listitem" className="flex items-center justify-between py-1.5 px-3 bg-surface border border-border rounded text-xs">
                <span className="text-text truncate">{entry.prompt.slice(0, 60)}</span>
                <span className={entry.status === 'completed' ? 'text-green-400' : 'text-red-400'}>{entry.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ContextPreview({
  projectName,
  projectPath,
  ueVersion,
  moduleLabel,
  isExpanded,
  onToggle,
}: {
  projectName: string;
  projectPath: string;
  ueVersion: string;
  moduleLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const moduleName = getModuleName(projectName);
  const apiMacro = getAPIMacro(moduleName);
  const enginePath = getEnginePath(ueVersion);
  const buildCmd = getBuildCommand(enginePath, moduleName, projectPath);

  const fields = [
    { label: 'Project', value: moduleName },
    { label: 'Path', value: projectPath || '(not set)' },
    { label: 'Module', value: `${moduleName} → ${moduleLabel}` },
    { label: 'API Macro', value: apiMacro },
    { label: 'UE Version', value: ueVersion || '(not set)' },
    { label: 'Build Cmd', value: buildCmd },
    { label: 'Rules', value: 'No TodoWrite, no Explore, verify build, quote paths' },
  ];

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle injected context preview"
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-muted transition-colors"
      >
        {isExpanded
          ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3" aria-hidden="true" />
        }
        <Info className="w-3 h-3" aria-hidden="true" />
        Injected context preview
      </button>
      {isExpanded && (
        <SurfaceCard level={2} className="mt-2 px-3 py-2.5 space-y-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-2 text-xs">
              <span className="text-text-muted flex-shrink-0 w-16 text-right">{f.label}</span>
              <span className="text-text-muted-hover font-mono break-all">{f.value}</span>
            </div>
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}
