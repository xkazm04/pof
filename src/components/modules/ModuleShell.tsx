'use client';

import { useState } from 'react';
import { Send, Clock, Zap } from 'lucide-react';
import { SUB_MODULE_MAP, getCategoryForSubModule } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { SubModuleId, TaskHistoryEntry } from '@/types/modules';

const EMPTY_HISTORY: TaskHistoryEntry[] = [];

interface ModuleShellProps {
  moduleId: SubModuleId;
}

export function ModuleShell({ moduleId }: ModuleShellProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const module = SUB_MODULE_MAP[moduleId];
  const category = getCategoryForSubModule(moduleId);
  const moduleHealth = useModuleStore((s) => s.moduleHealth[moduleId]);
  const moduleHistory = useModuleStore((s) => s.moduleHistory[moduleId]) ?? EMPTY_HISTORY;
  const projectPath = useProjectStore((s) => s.projectPath);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const findSessionByModule = useCLIPanelStore((s) => s.findSessionByModule);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);

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

  const feasibilityBadge = module.feasibilityRating && (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
      module.feasibilityRating === 'strong' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
      module.feasibilityRating === 'moderate' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
      'text-red-400 bg-red-400/10 border-red-400/20'
    }`}>
      {module.feasibilityRating}
    </span>
  );

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Icon className="w-6 h-6" style={{ color: accentColor }} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[#e0e4f0]">{module.label}</h1>
            {feasibilityBadge}
          </div>
          <p className="text-xs text-[#6b7294]">{module.description}</p>
        </div>
      </div>

      {/* Status card */}
      {moduleHealth && moduleHealth.tasksCompleted > 0 && (
        <div className="mb-6 p-4 bg-[#111128] border border-[#1e1e3a] rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6b7294]">Tasks completed</span>
            <span className="text-sm font-semibold" style={{ color: accentColor }}>{moduleHealth.tasksCompleted}</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#6b7294]" />
          <h2 className="text-sm font-medium text-[#e0e4f0]">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {module.quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.prompt)}
              className="text-left p-3 bg-[#111128] border border-[#1e1e3a] rounded-lg hover:border-[#2e2e5a] hover:bg-[#1a1a3a] transition-all group"
            >
              <span className="text-xs font-medium text-[#e0e4f0] group-hover:text-white">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ask Claude */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-[#6b7294]" />
          <h2 className="text-sm font-medium text-[#e0e4f0]">Ask Claude</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder={`Ask about ${module.label.toLowerCase()}...`}
            className="flex-1 px-3 py-2 bg-[#111128] border border-[#1e1e3a] rounded-lg text-xs text-[#e0e4f0] placeholder-[#6b7294] outline-none focus:border-[#2e2e5a] transition-colors"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Task History */}
      {moduleHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#6b7294]" />
            <h2 className="text-sm font-medium text-[#e0e4f0]">History</h2>
          </div>
          <div className="space-y-1">
            {moduleHistory.slice(-5).reverse().map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 px-3 bg-[#111128] border border-[#1e1e3a] rounded text-xs">
                <span className="text-[#e0e4f0] truncate">{entry.prompt.slice(0, 60)}</span>
                <span className={entry.status === 'completed' ? 'text-green-400' : 'text-red-400'}>{entry.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
