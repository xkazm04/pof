'use client';

import { useState, useCallback } from 'react';
import { Send, ListChecks, Workflow } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';

import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { AnimationStateMachine } from './AnimationStateMachine';
import { AnimationChecklist } from './AnimationChecklist';
import type { ChecklistStep } from './AnimationChecklist';
import { ACCENT_VIOLET, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';

const ANIM_ACCENT = ACCENT_VIOLET;

export function AnimationsView() {
  const mod = SUB_MODULE_MAP['animations'];
  const cat = getCategoryForSubModule('animations');

  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);

  const [customPrompt, setCustomPrompt] = useState('');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // ── Checklist CLI session (for AnimationChecklist setup guide) ──

  const checklistCli = useModuleCLI({
    moduleId: 'animations',
    sessionKey: 'animations-checklist',
    label: 'Anim Setup',
    accentColor: ANIM_ACCENT,
  });

  const appOrigin = getAppOrigin();

  const handleGenerateStep = useCallback((step: ChecklistStep) => {
    if (!step.prompt) return;
    const task = TaskFactory.checklist('animations', step.id, step.prompt, 'Anim Setup', appOrigin);
    checklistCli.execute(task);
  }, [checklistCli, appOrigin]);

  const handleMarkComplete = useCallback((stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setChecklistItem('animations', stepId, true);
  }, [setChecklistItem]);

  // ── State machine CLI session ──

  const smCli = useChecklistCLI({
    moduleId: 'animations',
    sessionKey: 'animations-statemachine',
    label: 'Anim State Machine',
    accentColor: ANIM_ACCENT,
  });

  const handleSelectState = useCallback((stateId: string, prompt: string) => {
    smCli.sendPrompt(stateId, prompt);
  }, [smCli]);

  // ── Custom prompt ──

  const customCli = useModuleCLI({
    moduleId: 'animations',
    sessionKey: 'animations-custom',
    label: 'Animations',
    accentColor: ANIM_ACCENT,
  });

  const handleCustomPrompt = useCallback(() => {
    if (!customPrompt.trim()) return;
    const task = TaskFactory.askClaude('animations', customPrompt.trim(), 'Animations');
    customCli.execute(task);
    setCustomPrompt('');
  }, [customPrompt, customCli]);

  if (!mod || !cat) return null;

  // ── Extra tabs ──

  const extraTabs: ExtraTab[] = [
    {
      id: 'setup',
      label: 'Setup Guide',
      icon: ListChecks,
      render: () => (
        <AnimationChecklist
          onGenerate={handleGenerateStep}
          isGenerating={checklistCli.isRunning}
          completedSteps={completedSteps}
          onMarkComplete={handleMarkComplete}
        />
      ),
    },
    {
      id: 'states',
      label: 'State Machine',
      icon: Workflow,
      render: () => (
        <AnimationStateMachine
          onSelectState={handleSelectState}
          isRunning={smCli.isRunning}
          activeStateId={smCli.activeItemId}
        />
      ),
    },
    {
      id: 'ask',
      label: 'Ask Claude',
      icon: Send,
      render: () => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-text-muted" />
            <h3 className="text-xs font-medium text-text">Ask Claude</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
              placeholder="Ask about animation blueprints, montages, blend spaces..."
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={!customPrompt.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: `${ANIM_ACCENT}${OPACITY_15}`, color: ANIM_ACCENT, border: `1px solid ${ANIM_ACCENT}${OPACITY_30}` }}
            >
              Send
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="animations"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('animations')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
