'use client';

import { useState } from 'react';
import { Zap, Send, Lightbulb } from 'lucide-react';
import { usePromptSuggestions } from '@/hooks/useSessionAnalytics';
import type { QuickAction, ActionComplexity } from '@/types/modules';

const COMPLEXITY_CONFIG: Record<ActionComplexity, { label: string; color: string; bg: string; border: string }> = {
  beginner:     { label: 'Beginner',      color: '#22c55e', bg: '#22c55e10', border: '#22c55e25' },
  intermediate: { label: 'Intermediate',  color: '#f59e0b', bg: '#f59e0b10', border: '#f59e0b25' },
  advanced:     { label: 'Advanced',      color: '#ef4444', bg: '#ef444410', border: '#ef444425' },
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
  const { suggestions, fetchSuggestions } = usePromptSuggestions(moduleId ?? '');

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
    <div className="flex flex-col h-full">
      {/* Quick Actions */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Zap className="w-3.5 h-3.5 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Quick Actions</h3>
        </div>
        <div className="p-2 space-y-0.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const complexity = action.complexity ? COMPLEXITY_CONFIG[action.complexity] : null;

            return (
              <button
                key={action.id}
                onClick={() => onRunPrompt(action.prompt)}
                disabled={isRunning}
                className="w-full text-left px-2.5 py-2 rounded-md text-xs text-text hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center gap-2">
                  {Icon && (
                    <Icon
                      className="w-3.5 h-3.5 flex-shrink-0 text-[#4a4e6a] group-hover:text-text-muted-hover transition-colors"
                    />
                  )}
                  <span className="flex-1 truncate">{action.label}</span>
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
                  <p className="text-2xs text-[#4a4e6a] mt-0.5 truncate pl-[22px]">{action.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ask Claude input */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Send className="w-3 h-3 text-text-muted" />
          <span className="text-xs text-text-muted uppercase tracking-wider">Ask Claude</span>
        </div>

        {/* Prompt suggestions */}
        {suggestions.length > 0 && customPrompt.trim() && (
          <div className="mb-1.5 space-y-1">
            {suggestions.map((s, i) => (
              <div
                key={`${s.type}-${i}`}
                className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-[#fbbf2408] border border-[#fbbf2415]"
              >
                <Lightbulb className="w-2.5 h-2.5 flex-shrink-0 mt-0.5 text-[#fbbf24]" />
                <span className="text-2xs text-[#b0a070] leading-relaxed">{s.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${moduleLabel.toLowerCase()}...`}
            className="flex-1 px-2.5 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-[#4a4e6a] outline-none focus:border-border-bright transition-colors min-w-0"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isRunning}
            className="px-2.5 py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
