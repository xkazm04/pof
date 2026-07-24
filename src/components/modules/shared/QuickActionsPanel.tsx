'use client';

import { useState } from 'react';
import { Send, Lightbulb, Zap } from 'lucide-react';
import { usePromptSuggestions } from '@/hooks/useSessionAnalytics';
import type { QuickAction, ActionComplexity, SubModuleId } from '@/types/modules';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_8, OPACITY_15, withOpacity,
} from '@/lib/chart-colors';
import { AccentButton } from '@/components/ui/AccentButton';
import { CopyButton } from '@/components/ui/CopyButton';

const COMPLEXITY_CONFIG: Record<ActionComplexity, { label: string; color: string; bg: string; border: string }> = {
  beginner:     { label: 'Beginner',      color: STATUS_SUCCESS, bg: 'var(--status-green-subtle)',   border: 'var(--status-green-strong)' },
  intermediate: { label: 'Intermediate',  color: STATUS_WARNING, bg: 'var(--status-amber-subtle)',  border: 'var(--status-amber-strong)' },
  advanced:     { label: 'Advanced',      color: STATUS_ERROR,   bg: 'var(--status-red-subtle)',    border: 'var(--status-red-strong)' },
};

interface QuickActionsPanelProps {
  actions: QuickAction[];
  onRunPrompt: (prompt: string) => void;
  accentColor: string;
  isRunning: boolean;
  moduleLabel: string;
  moduleId?: string;
}

export function QuickActionsPanel({ actions, onRunPrompt, accentColor, isRunning, moduleLabel, moduleId }: QuickActionsPanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const { suggestions, fetchSuggestions } = usePromptSuggestions((moduleId ?? '') as SubModuleId);

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    onRunPrompt(customPrompt.trim());
    setCustomPrompt('');
  };

  const handlePromptChange = (value: string) => {
    setCustomPrompt(value);
    if (moduleId) fetchSuggestions(value);
  };

  return (
    <div className="flex flex-col h-[calc(100%-49px)]">
      {/* Quick Actions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {actions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Zap className="w-5 h-5 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text">No quick actions for {moduleLabel}</p>
            <p className="text-xs text-text-muted leading-relaxed">
              This module has no preset actions yet. Describe what you need in the
              box below and Claude will work from that.
            </p>
          </div>
        )}
        {actions.map((action) => {
          const Icon = action.icon;
          const complexity = action.complexity ? COMPLEXITY_CONFIG[action.complexity] : null;

          return (
            <div key={action.id} className="group/action relative">
              <button
                onClick={() => onRunPrompt(action.prompt)}
                disabled={isRunning}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-text hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2.5">
                  {Icon && (
                    <Icon
                      className="w-4 h-4 flex-shrink-0 text-text-muted group-hover/action:text-text-muted-hover transition-colors"
                    />
                  )}
                  <span className="flex-1">{action.label}</span>
                  {complexity && (
                    <span
                      className="flex-shrink-0 text-2xs font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        color: complexity.color,
                        backgroundColor: complexity.bg,
                        border: `1px solid ${complexity.border}`,
                      }}
                    >
                      {complexity.label}
                    </span>
                  )}
                </div>
                {action.description && (
                  <p className="text-xs text-text-muted mt-1 pl-[26px] leading-relaxed">{action.description}</p>
                )}
              </button>
              <CopyPromptButton prompt={action.prompt} />
            </div>
          );
        })}
      </div>

      {/* Ask Claude input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Send className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Ask Claude</span>
        </div>

        {/* Prompt suggestions — announced as they appear, since they arrive
            asynchronously while the user is still typing. */}
        <div aria-live="polite">
          {suggestions.length > 0 && customPrompt.trim() && (
            <div className="mb-2 space-y-1">
              {suggestions.map((s, i) => (
                <div
                  key={`${s.type}-${i}`}
                  className="flex items-start gap-1.5 px-2.5 py-2 rounded-md"
                  style={{
                    backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8),
                    border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_15)}`,
                  }}
                >
                  <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: STATUS_WARNING }} aria-hidden="true" />
                  <span className="text-xs text-text leading-relaxed">{s.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${moduleLabel.toLowerCase()}...`}
            aria-label={`Ask Claude about ${moduleLabel.toLowerCase()}`}
            className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors min-w-0"
          />
          <AccentButton
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isRunning}
            accentColor={accentColor}
            className="flex-shrink-0"
          >
            Send
          </AccentButton>
        </div>
      </div>
    </div>
  );
}

function CopyPromptButton({ prompt }: { prompt: string }) {
  return (
    <CopyButton
      text={prompt}
      size="xs"
      tooltip="Copy prompt"
      className="absolute right-1.5 top-1.5 p-1 opacity-30 scale-95 group-hover/action:opacity-100 group-hover/action:scale-100"
    />
  );
}

