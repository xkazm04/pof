'use client';

import { useState, useCallback } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import {
  MODULE_COLORS, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { HUD_WBP_CLASSES } from './wbp-classes';

const ACCENT = MODULE_COLORS.core;

/**
 * WBP-starter (folder-04 §6 / Phase 2b).
 *
 * Lets the operator pick a BindWidget-coupled C++ widget class and dispatch an
 * agentic task that scaffolds a stub WBP + a wiring README in the UE project —
 * the documented path to using the project's real HUD widgets when the
 * autonomous-only (pure-C++) path is insufficient.
 */
export function WBPStarterPanel({ moduleId }: { moduleId: SubModuleId }) {
  const [targetClass, setTargetClass] = useState<string>(HUD_WBP_CLASSES[0]);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: 'wbp-starter',
    label: 'WBP Starter',
    accentColor: ACCENT,
  });

  const handleScaffold = useCallback(() => {
    const cls = targetClass.trim();
    if (!cls || isRunning) return;
    const name = cls.replace(/^U/, '');
    execute(TaskFactory.wbpStarter(moduleId, cls, getAppOrigin(), `Scaffold WBP_${name}`));
  }, [targetClass, isRunning, execute, moduleId]);

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl"
      style={{
        backgroundColor: withOpacity(ACCENT, OPACITY_8),
        border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-bold text-text">Scaffold a Widget Blueprint</h3>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Generate a stub <code>WBP_&lt;name&gt;</code> for a <code>BindWidget</code>-coupled C++ widget plus a
        README listing the child widgets to wire by hand. Pick a known HUD class or type your own.
      </p>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        <span>Target widget class</span>
        <input
          aria-label="Target widget class"
          value={targetClass}
          onChange={(e) => setTargetClass(e.target.value)}
          list="wbp-class-suggestions"
          placeholder="UARPGHUDWidget"
          spellCheck={false}
          className="px-2 py-1.5 rounded-lg font-mono text-sm bg-surface-deep/50 text-text outline-none"
          style={{ border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
        />
        <datalist id="wbp-class-suggestions">
          {HUD_WBP_CLASSES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="flex flex-wrap gap-1.5">
        {HUD_WBP_CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTargetClass(c)}
            className="px-2 py-0.5 rounded text-xs font-mono cursor-pointer transition-all hover:brightness-110"
            style={{
              backgroundColor: withOpacity(ACCENT, targetClass === c ? OPACITY_20 : OPACITY_8),
              color: withOpacity(ACCENT, OPACITY_50),
              border: `1px solid ${withOpacity(ACCENT, OPACITY_12)}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleScaffold}
        disabled={isRunning}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          backgroundColor: withOpacity(ACCENT, OPACITY_12),
          border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`,
          color: ACCENT,
        }}
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        <span>Scaffold WBP</span>
      </button>
    </div>
  );
}
