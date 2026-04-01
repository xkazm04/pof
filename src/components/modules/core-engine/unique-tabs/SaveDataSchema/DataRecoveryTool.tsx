'use client';

import { useState } from 'react';
import { Wrench, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT } from './data';
import { RECOVERY_STEPS, RECOVERY_RESULTS, type RecoveryStep } from './data-panels';

export function DataRecoveryTool() {
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('confirm');
  const recoveryOverall = RECOVERY_RESULTS.reduce((sum, r) => sum + r.confidence, 0) / RECOVERY_RESULTS.length;

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10">
        <SectionHeader label="DATA_RECOVERY_TOOL" icon={Wrench} color={ACCENT} />
      </div>

      <div className="p-4 space-y-4">
        {/* Step indicators */}
        <div className="flex items-center gap-1 justify-center">
          {RECOVERY_STEPS.map((step, i, arr) => {
            const stepIndex = RECOVERY_STEPS.findIndex(s => s.id === recoveryStep);
            const isComplete = i <= stepIndex;
            const isCurrent = i === stepIndex;
            return (
              <div key={step.id} className="flex items-center gap-1">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-widest border transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-cyan-500 bg-cyan-950/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : isComplete
                        ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                        : 'border-border/20 bg-surface-deep text-text-muted'
                  }`}
                  onClick={() => setRecoveryStep(step.id)}
                >
                  {isComplete && !isCurrent && <CheckCircle2 className="w-3 h-3" />}
                  {step.label}
                </motion.div>
                {i < arr.length - 1 && (
                  <div className={`w-6 h-px ${isComplete ? 'bg-emerald-500/40' : 'bg-border/20'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Recovery confidence gauge */}
        <div className="flex justify-center">
          <div className="relative w-[72px] h-[72px]">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <circle
                cx="36" cy="36" r="28" fill="none"
                stroke={recoveryOverall >= 80 ? STATUS_SUCCESS : recoveryOverall >= 50 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - recoveryOverall / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out', filter: `drop-shadow(0 0 6px ${recoveryOverall >= 80 ? STATUS_SUCCESS : STATUS_WARNING})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-lg font-mono font-bold" style={{ color: recoveryOverall >= 80 ? STATUS_SUCCESS : STATUS_WARNING }}>
                {Math.round(recoveryOverall)}%
              </span>
              <span className="text-xs font-mono text-text-muted uppercase">confidence</span>
            </div>
          </div>
        </div>

        {/* Recovery results */}
        <div className="space-y-1.5">
          <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Recovery Results</span>
          {RECOVERY_RESULTS.map((result, i) => {
            const statusColor = result.status === 'recovered' ? STATUS_SUCCESS : result.status === 'partial' ? STATUS_WARNING : STATUS_ERROR;
            const StatusIcon = result.status === 'recovered' ? CheckCircle2 : result.status === 'partial' ? AlertTriangle : XCircle;
            return (
              <motion.div
                key={result.field}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 px-3 py-2 border border-border/20 bg-surface-deep rounded-sm font-mono text-xs"
              >
                <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
                <span className="text-text font-bold w-36 flex-shrink-0">{result.field}</span>
                <span className="text-xs uppercase font-bold tracking-widest w-20 flex-shrink-0" style={{ color: statusColor }}>
                  {result.status}
                </span>
                <div className="flex-1 h-1.5 bg-surface-deep rounded-full overflow-hidden border border-border/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: statusColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                  />
                </div>
                <span className="font-bold text-xs w-8 text-right flex-shrink-0" style={{ color: statusColor }}>{result.confidence}%</span>
                <span className="text-text-muted text-xs hidden lg:block truncate">{result.detail}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 px-3 py-2 border border-border/20 bg-surface-deep rounded-sm font-mono text-xs">
          <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text-muted uppercase tracking-widest">Summary:</span>
          <span style={{ color: STATUS_SUCCESS }}>{RECOVERY_RESULTS.filter(r => r.status === 'recovered').length} recovered</span>
          <span className="text-text-muted">|</span>
          <span style={{ color: STATUS_WARNING }}>{RECOVERY_RESULTS.filter(r => r.status === 'partial').length} partial</span>
          <span className="text-text-muted">|</span>
          <span style={{ color: STATUS_ERROR }}>{RECOVERY_RESULTS.filter(r => r.status === 'lost').length} lost</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
