'use client';

import { useCallback } from 'react';
import { Rocket, Loader2, CheckCircle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, MODULE_COLORS,
  OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import type { FeatureInitState } from '@/hooks/useFeatureInitStatus';
import { getFeatureInitPrompt } from './feature-init-prompts';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';

const ACCENT = MODULE_COLORS.core;

interface FeatureInitButtonProps {
  moduleId: SubModuleId;
  sectionId: string;
  initStatus: FeatureInitState;
  onInitStart: () => void;
  onInitComplete: () => void;
}

/**
 * Button that triggers a CLI LLM session to initialize a feature
 * in the UE5 project and connect it with PoF.
 *
 * Placed inside each feature's section (VisibleSection) so users
 * can initialize features one by one.
 */
export function FeatureInitButton({
  moduleId,
  sectionId,
  initStatus,
  onInitStart,
  onInitComplete,
}: FeatureInitButtonProps) {
  const initPrompt = getFeatureInitPrompt(moduleId, sectionId);

  const { sendPrompt, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: `init-${sectionId}`,
    label: `Init: ${sectionId}`,
    accentColor: ACCENT,
    onComplete: (success) => {
      if (success) {
        onInitComplete();
      }
    },
  });

  const handleInit = useCallback(() => {
    if (!initPrompt || isRunning) return;
    onInitStart();
    sendPrompt(initPrompt.prompt);
  }, [initPrompt, isRunning, onInitStart, sendPrompt]);

  if (!initPrompt) return null;

  // Already initialized
  if (initStatus === 'initialized') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-mono"
        style={{
          backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_8),
          border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}`,
          color: STATUS_SUCCESS,
        }}
      >
        <CheckCircle className="w-4 h-4" />
        <span>Initialized — connected to project</span>
      </div>
    );
  }

  // Currently initializing
  if (initStatus === 'initializing' || isRunning) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-mono"
        style={{
          backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8),
          border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_20)}`,
          color: STATUS_WARNING,
        }}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Initializing feature in UE5 project...</span>
      </div>
    );
  }

  // Ready to initialize
  return (
    <button
      type="button"
      onClick={handleInit}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98]"
      style={{
        backgroundColor: withOpacity(ACCENT, OPACITY_8),
        border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`,
        color: ACCENT,
      }}
    >
      <Rocket className="w-4 h-4" />
      <span>{initPrompt.label}</span>
      <span
        className="ml-auto px-1.5 py-0.5 rounded text-xs"
        style={{
          backgroundColor: withOpacity(ACCENT, OPACITY_12),
          color: withOpacity(ACCENT, OPACITY_50),
        }}
      >
        CLI
      </span>
    </button>
  );
}
