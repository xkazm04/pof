'use client';

import { useState, useCallback } from 'react';
import { Send, Lightbulb, Copy, Check } from 'lucide-react';
import { usePromptSuggestions } from '@/hooks/useSessionAnalytics';
import type { QuickAction, ActionComplexity, SubModuleId } from '@/types/modules';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

const COMPLEXITY_CONFIG: Record<ActionComplexity, { label: string; color: string; bg: string; border: string }> = {
  beginner:     { label: 'Beginner',      color: STATUS_SUCCESS, bg: 'var(--status-green-subtle)',   border: 'var(--status-green-strong)' },
  intermediate: { label: 'Intermediate',  color: '#f59e0b', bg: 'var(--status-amber-subtle)',  border: 'var(--status-amber-strong)' },
  advanced:     { label: 'Advanced',      color: '#ef4444', bg: 'var(--status-red-subtle)',    border: 'var(--status-red-strong)' },
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
          <Send className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Ask Claude</span>
        </div>

        {/* Prompt suggestions */}
        {suggestions.length > 0 && customPrompt.trim() && (
          <div className="mb-2 space-y-1">
            {suggestions.map((s, i) => (
              <div
                key={`${s.type}-${i}`}
                className="flex items-start gap-1.5 px-2.5 py-2 rounded-md bg-[#fbbf2408] border border-[#fbbf2415]"
              >
                <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#fbbf24]" />
                <span className="text-xs text-[#b0a070] leading-relaxed">{s.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${moduleLabel.toLowerCase()}...`}
            className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors min-w-0"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isRunning}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
            style={{
              backgroundColor: `${accentColor}24`,
              color: accentColor,
              border: `1px solid ${accentColor}38`,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyPromptButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [prompt]);

  return (
    <button
      onClick={handleCopy}
      className="absolute right-1.5 top-1.5 p-1 rounded text-text-muted hover:text-text hover:bg-border transition-all opacity-30 scale-95 group-hover/action:opacity-100 group-hover/action:scale-100"
      title={copied ? 'Copied!' : 'Copy prompt'}
    >
      {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}
