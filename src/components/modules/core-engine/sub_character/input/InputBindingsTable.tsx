'use client';

import { useState, useCallback, useMemo } from 'react';
import { Keyboard, RotateCcw, Send } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_SUCCESS, OVERLAY_WHITE, OPACITY_8, withOpacity,
} from '@/lib/chart-colors';
import { bindingsApplyGate, normalizeKeyEvent } from '@/lib/character/input-bindings';
import { useCharacterBlueprintStore, useResolvedBindings } from '@/stores/characterBlueprintStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useCaptureNext } from '@/hooks/useHotkey';
import { TaskFactory } from '@/lib/cli-task';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { ACCENT } from '../_shared/data';
import { InputBindingsBanner } from './InputBindingsBanner';
import { InputBindingsRow } from './InputBindingsRow';
import { buildBindingsApplyPrompt } from './build-bindings-apply-prompt';

interface InputBindingsTableProps {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
}

/** Rebind table over the persisted binding profile, with a conflict-gated "Apply to IMC_Default". */
export function InputBindingsTable({ moduleId, featureMap }: InputBindingsTableProps) {
  const resolved = useResolvedBindings();
  const setBindingOverride = useCharacterBlueprintStore((s) => s.setBindingOverride);
  const resetBindings = useCharacterBlueprintStore((s) => s.resetBindings);
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: 'input-bindings',
    label: 'Input Bindings',
    accentColor: ACCENT,
  });

  const gate = useMemo(() => bindingsApplyGate(resolved), [resolved]);
  const hasConflicts = resolved.conflicts.size > 0;
  const hasOverrides = resolved.changed.length > 0;

  const handleStartRebind = useCallback((action: string) => {
    setRebindingAction((cur) => (cur === action ? null : action));
  }, []);

  /** Only an explicit click dispatches — nothing here writes to the UE project on its own. */
  const handleApply = useCallback(() => {
    if (!gate.ok || isRunning) return;
    const n = resolved.changed.length;
    execute(TaskFactory.askClaude(moduleId, buildBindingsApplyPrompt(resolved), `Apply ${n} rebind${n === 1 ? '' : 's'} to IMC_Default`));
  }, [gate, isRunning, resolved, moduleId, execute]);

  /* ── Exclusive capture of the next key while rebinding ───────────────── */
  // The keyboard door takes the key before anything else sees it, and releases
  // the capture when this pane is hidden — a half-finished rebind in a hidden
  // pane never swallows the next keystroke app-wide.
  useCaptureNext(rebindingAction !== null, (e) => {
    if (rebindingAction !== null && e.key !== 'Escape') setBindingOverride(rebindingAction, normalizeKeyEvent(e.key));
    setRebindingAction(null);
  });

  const accent = hasConflicts ? STATUS_ERROR : STATUS_SUCCESS;

  return (
    <BlueprintPanel className="p-4" color={accent}>
      <div className="flex items-center justify-between mb-0 gap-2 flex-wrap">
        <SectionHeader icon={Keyboard} label="Input Bindings" color={accent} />
        <div className="flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={() => { resetBindings(); setRebindingAction(null); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-border hover:bg-surface/60 text-text-muted transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset All
            </button>
          )}
          {!gate.ok && <span className="text-xs font-mono text-text-muted">{gate.reason}</span>}
          <button
            onClick={handleApply}
            disabled={!gate.ok || isRunning}
            title={gate.ok ? 'Dispatch a CLI task that updates IMC_Default' : gate.reason}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: gate.ok ? STATUS_SUCCESS : 'var(--text-muted)' }}
          >
            <Send className="w-3 h-3" /> Apply to IMC_Default
          </button>
        </div>
      </div>

      <InputBindingsBanner conflicts={resolved.conflicts} totalBindings={resolved.effective.length} />

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_8) }}>
              {['Action', 'Key', 'Handler', 'Frequency', 'Status'].map((h) => (
                <th key={h} className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resolved.effective.map((binding, i) => (
              <InputBindingsRow
                key={binding.action}
                binding={binding}
                index={i}
                isRebinding={rebindingAction === binding.action}
                conflicts={resolved.conflicts}
                status={featureMap.get(binding.featureName)?.status ?? 'unknown'}
                onStartRebind={handleStartRebind}
              />
            ))}
          </tbody>
        </table>
      </div>
    </BlueprintPanel>
  );
}
