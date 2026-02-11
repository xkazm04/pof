'use client';

import { useState } from 'react';
import { Zap, Send } from 'lucide-react';
import type { QuickAction } from '@/types/modules';

interface QuickActionsPanelProps {
  actions: QuickAction[];
  onRunPrompt: (prompt: string) => void;
  accentColor: string;
  isRunning: boolean;
  moduleLabel: string;
}

export function QuickActionsPanel({ actions, onRunPrompt, accentColor, isRunning, moduleLabel }: QuickActionsPanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    onRunPrompt(customPrompt.trim());
    setCustomPrompt('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Quick Actions */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[#1e1e3a]">
          <Zap className="w-3.5 h-3.5 text-[#6b7294]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7294]">Quick Actions</h3>
        </div>
        <div className="p-2 space-y-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onRunPrompt(action.prompt)}
              disabled={isRunning}
              className="w-full text-left px-3 py-2.5 rounded-md text-xs text-[#e0e4f0] hover:bg-[#1a1a3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ask Claude input */}
      <div className="p-2 border-t border-[#1e1e3a]">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Send className="w-3 h-3 text-[#6b7294]" />
          <span className="text-[10px] text-[#6b7294] uppercase tracking-wider">Ask Claude</span>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${moduleLabel.toLowerCase()}...`}
            className="flex-1 px-2.5 py-2 bg-[#111128] border border-[#1e1e3a] rounded-md text-[11px] text-[#e0e4f0] placeholder-[#4a4e6a] outline-none focus:border-[#2e2e5a] transition-colors min-w-0"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isRunning}
            className="px-2.5 py-2 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 flex-shrink-0"
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
