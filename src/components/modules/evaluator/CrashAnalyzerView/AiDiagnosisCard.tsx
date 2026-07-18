'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, ArrowRight, Eye } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { CrashDiagnosis } from '@/types/crash-analyzer';

export function AiDiagnosisCard({ diagnosis }: { diagnosis: CrashDiagnosis }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(diagnosis.fixPrompt);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Insecure origin, denied permission, or unsupported API — surface it
      // instead of showing a false "Copied!" success.
      setCopied(false);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), UI_TIMEOUTS.copyFeedback);
    }
  }, [diagnosis]);

  return (
    <SurfaceCard>
      <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5 text-emerald-400" />
        AI Root Cause Analysis
        <ProgressRing value={Math.round(diagnosis.confidence * 100)} size={20} strokeWidth={2} color={ACCENT_EMERALD} />
      </h3>

      <div className="space-y-3">
        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Summary</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.summary} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Root Cause</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.rootCause} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">UE5 Pattern</p>
          <Badge variant="warning">{diagnosis.uePattern}</Badge>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Fix Description</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.fixDescription} /></p>
        </div>

        {/* Fix prompt */}
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-2xs font-medium text-emerald-400 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> One-Click Fix Prompt
            </p>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className={`w-3 h-3 ${copyFailed ? 'text-red-400' : ''}`} />}
              {copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs leading-relaxed text-emerald-300/80 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
            {diagnosis.fixPrompt}
          </pre>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {diagnosis.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-surface-2 text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
