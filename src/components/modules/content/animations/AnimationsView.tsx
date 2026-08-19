'use client';

import { useState, useCallback, useMemo } from 'react';
import { Send, ListChecks, Workflow, Sparkles, Download } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { ChecklistUnconfirmedBanner } from '../../shared/ChecklistUnconfirmedBanner';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';

import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useChecklistCLI } from '@/hooks/useChecklistCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { AnimationStateMachine } from './AnimationStateMachine';
import { EMPTY_PROGRESS } from './AnimationStateMachine/constants';
import { AnimationChecklist } from './AnimationChecklist';
import { AIComboChoreographer } from './AIComboChoreographer';
import { MixamoImport } from './MixamoImport';
import type { ChecklistStep } from './AnimationChecklist';
import { ACCENT_VIOLET, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';

const ANIM_ACCENT = ACCENT_VIOLET;

export function AnimationsView() {
  const mod = SUB_MODULE_MAP['animations'];
  const cat = getCategoryForSubModule('animations');

  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);

  const [customPrompt, setCustomPrompt] = useState('');

  // The Setup Guide's completions are DERIVED from the persisted module
  // progress, never held in a local Set. `onMarkComplete` has always written
  // into `moduleStore.checklistProgress` (a declared aux progress surface, see
  // `checklist-progress-keys`), and that record survives reload — but the bar
  // used to read a `useState` Set that was never seeded from it, so every
  // checkmark vanished on remount while the app still held the record. The
  // sibling state-machine graph reads the same store correctly
  // (`useAnimationStateMachine`); this is that pattern.
  //
  // The module record also carries the state-machine's `anim-*` / `scanned-*`
  // node keys; `AnimationChecklist` counts only its own `ANIMATION_STEPS`, so
  // passing the whole set is safe and adds no key namespace.
  const animProgress = useModuleStore((s) => s.checklistProgress['animations'] ?? EMPTY_PROGRESS);
  const completedSteps = useMemo(
    () => new Set(Object.keys(animProgress).filter((id) => animProgress[id])),
    [animProgress],
  );

  // ── Checklist CLI session (for AnimationChecklist setup guide) ──

  const checklistCli = useModuleCLI({
    moduleId: 'animations',
    sessionKey: 'animations-checklist',
    label: 'Anim Setup',
    accentColor: ANIM_ACCENT,
  });

  const appOrigin = getAppOrigin();

  // `step.id` is load-bearing, not just a progress key: the `checklist` task
  // handler resolves it back to this step (`findAnimationChecklistStep`) and
  // composes the body with `buildAnimationChecklistPrompt`, so the authored
  // Mixamo-retarget + commandlet-automation guidance ships. `step.prompt` stays
  // the argument so an id that no longer resolves degrades to the generic body
  // instead of dispatching an empty task.
  const handleGenerateStep = useCallback((step: ChecklistStep) => {
    if (!step.prompt) return;
    const task = TaskFactory.checklist('animations', step.id, step.prompt, 'Anim Setup', appOrigin);
    checklistCli.execute(task);
  }, [checklistCli, appOrigin]);

  // Single write: the store IS the state the bar renders, so there is no
  // local-only copy left to drift out of sync with it.
  const handleMarkComplete = useCallback((stepId: string) => {
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
        <div data-testid="pof-module-arpg-animation-tab-setup">
          <AnimationChecklist
            onGenerate={handleGenerateStep}
            isGenerating={checklistCli.isRunning}
            completedSteps={completedSteps}
            onMarkComplete={handleMarkComplete}
          />
        </div>
      ),
    },
    {
      id: 'mixamo',
      label: 'Mixamo Import',
      icon: Download,
      render: () => (
        <div className="max-w-2xl mx-auto p-4" data-testid="pof-module-animations-tab-mixamo">
          <MixamoImport />
        </div>
      ),
    },
    {
      id: 'states',
      label: 'State Machine',
      icon: Workflow,
      render: () => (
        <div data-testid="pof-module-arpg-animation-tab-states">
          <ChecklistUnconfirmedBanner cli={smCli} />
          <AnimationStateMachine
            onSelectState={handleSelectState}
            isRunning={smCli.isRunning}
            activeStateId={smCli.activeItemId}
          />
        </div>
      ),
    },
    {
      id: 'combo-ai',
      label: 'Combo Designer',
      icon: Sparkles,
      render: () => (
        <div data-testid="pof-module-arpg-animation-tab-combo-ai">
          <AIComboChoreographer />
        </div>
      ),
    },
    {
      id: 'ask',
      label: 'Ask Claude',
      icon: Send,
      render: () => (
        <div className="space-y-2" data-testid="pof-module-arpg-animation-tab-ask">
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
