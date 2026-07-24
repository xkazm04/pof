'use client';

import { useState } from 'react';
import { Send, Clock, Zap, Lightbulb, X } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { Tooltip } from '@/components/ui/Tooltip';
import { STATUS_TOKENS } from '@/lib/status-token';
import { SUB_MODULE_MAP, getCategoryForSubModule } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { ModuleHeaderDecoration } from '@/components/modules/ModuleHeaderDecoration';
import type { SubModuleId } from '@/types/modules';
import { EMPTY_HISTORY } from './constants';
import { ContextPreview } from './ContextPreview';

interface ModuleShellProps {
  moduleId: SubModuleId;
}

export function ModuleShell({ moduleId }: ModuleShellProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [contextExpanded, setContextExpanded] = useState(false);
  const mod = SUB_MODULE_MAP[moduleId];
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

  if (!mod || !category) return null;

  const Icon = mod.icon;
  const accentColor = category.accentColor;
  // `slice` copies first, so `reverse` never mutates the store's array.
  const recentHistory = moduleHistory.slice(-5).reverse();

  const sendToTerminal = (prompt: string) => {
    // Find or create a terminal tab for this module
    let tabId = findSessionByModule(moduleId);
    const isNew = !tabId;
    if (!tabId) {
      tabId = createSession({
        label: mod.label,
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
    strong: 'How well AI-assisted code generation works for this module. Strong = high success rate, well suited to automated C++ generation.',
    moderate: 'How well AI-assisted code generation works for this module. Moderate = decent success rate, may need manual adjustments for complex patterns.',
    challenging: 'How well AI-assisted code generation works for this module. Challenging = lower success rate, expect significant manual review and iteration.',
  };

  // Keyboard-reachable badge: the shared Tooltip opens on hover AND focus, links
  // the explanation via aria-describedby, and dismisses on Escape.
  const feasibilityBadge = mod.feasibilityRating && (
    <Tooltip content={feasibilityTooltip[mod.feasibilityRating]} multiline placement="bottom">
      <span
        tabIndex={0}
        className={`focus-ring inline-flex items-center cursor-help text-xs px-1.5 py-0.5 rounded border ${
          mod.feasibilityRating === 'strong' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
          mod.feasibilityRating === 'moderate' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
          'text-red-400 bg-red-400/10 border-red-400/20'
        }`}
      >
        {/* Name comes from content (robust on a generic element) rather than aria-label. */}
        <span className="sr-only">Codegen feasibility: </span>
        {mod.feasibilityRating}
      </span>
    </Tooltip>
  );

  return (
    <main className="p-6 max-w-4xl" aria-label={`${mod.label} module`}>
      {/* Header */}
      <div className="relative flex items-center gap-3 mb-6">
        {/* The decoration bleeds past the header box, so it clips on its own layer —
            clipping the header itself would swallow the feasibility tooltip below it. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <ModuleHeaderDecoration moduleId={moduleId} variant="full" />
        </div>
        <Icon className="w-6 h-6 relative" style={{ color: accentColor }} aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text">{mod.label}</h1>
            {feasibilityBadge}
          </div>
          <p className="text-xs text-text-muted">{mod.description}</p>
        </div>
      </div>

      {/* Art-gap awareness banner for moderate feasibility modules */}
      {!bannerDismissed && mod.feasibilityRating === 'moderate' && (() => {
        const tip = mod.knowledgeTips.find((t) => t.source === 'feasibility');
        if (!tip) return null;
        return (
          <div className="mb-6 flex items-start gap-3 bg-amber-500/5 border-l-2 border-amber-400 px-4 py-3 rounded-r-lg">
            <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-300 mb-1">{tip.title}</p>
              <p className="text-xs text-text-muted leading-relaxed">{tip.content}</p>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label={`Dismiss tip: ${tip.title}`}
              className="focus-ring p-0.5 rounded hover:bg-[#ffffff10] transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 text-text-muted" aria-hidden="true" />
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
        {mod.quickActions.length === 0 ? (
          <SurfaceCard className="p-4">
            <p className="text-xs text-text-muted leading-relaxed">
              No quick actions are defined for this module yet. Use{' '}
              <span className="text-text font-medium">Ask Claude</span> below — your prompt is sent to
              the terminal with this module&apos;s project context already attached.
            </p>
          </SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Available actions">
            {mod.quickActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="focus-ring text-left flex items-start gap-2.5 px-3 py-3.5 bg-surface border border-border rounded-lg hover:border-border-bright hover:bg-surface-hover transition-all group"
              >
                <span
                  aria-hidden="true"
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
        )}
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
            placeholder={`Ask about ${mod.label.toLowerCase()}...`}
            aria-label={`Ask about ${mod.label.toLowerCase()}`}
            aria-describedby="module-shell-ask-hint"
            className="focus-ring-inset flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none transition-colors"
          />
          <button
            type="button"
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim()}
            className="focus-ring px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accentColor}24`, color: accentColor, border: `1px solid ${accentColor}38` }}
          >
            Send
          </button>
        </div>
        {/* Matches MicroLabel's subtle tier; needs a real `id` for aria-describedby. */}
        <p id="module-shell-ask-hint" className="mt-1.5 text-xs text-text-subtle">
          Press Enter to send. Opens a terminal tab for {mod.label} with the project context below.
        </p>
      </section>

      {/* Context Preview */}
      <ContextPreview
        projectName={projectName}
        projectPath={projectPath}
        ueVersion={ueVersion}
        moduleLabel={mod.label}
        isExpanded={contextExpanded}
        onToggle={() => setContextExpanded((v) => !v)}
      />

      {/* Task History */}
      {recentHistory.length > 0 && (
        <section aria-label="Task history">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
            <h2 className="text-sm font-medium text-text">History</h2>
            {moduleHistory.length > recentHistory.length && (
              <MicroLabel>
                Showing last {recentHistory.length} of {moduleHistory.length}
              </MicroLabel>
            )}
          </div>
          <ul className="space-y-1">
            {recentHistory.map((entry) => {
              // Colorblind-safe: glyph + word from the shared status token, never hue alone.
              const token = STATUS_TOKENS[entry.status === 'completed' ? 'ok' : 'bad'];
              const StatusIcon = token.Icon;
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-1.5 px-3 bg-surface border border-border rounded text-xs">
                  {/* Full prompt on hover — the row itself truncates with a real ellipsis. */}
                  <span className="text-text truncate" title={entry.prompt}>{entry.prompt}</span>
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1 font-medium"
                    style={{ color: token.color }}
                  >
                    <StatusIcon className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                    {entry.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
