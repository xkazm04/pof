import { useState, useCallback } from 'react';
import { ArrowRight, Copy, Check } from 'lucide-react';
import type { LOCTEXTReplacementSuggestion } from '@/types/localization-pipeline';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, STATUS_ERROR } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';

export function ReplacementCard({ replacement }: { replacement: LOCTEXTReplacementSuggestion }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(replacement.suggestedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [replacement.suggestedCode]);

  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <ArrowRight className="w-3 h-3 text-indigo-400" />
        <span className={`${TEXT_SCALE.meta} font-medium text-text`}>LOCTEXT Replacement</span>
      </div>
      <pre className="text-xs leading-relaxed p-1.5 rounded bg-status-red-subtle overflow-x-auto mb-1" style={{ color: STATUS_ERROR }}>
        - {replacement.originalCode}
      </pre>
      <pre className="text-xs leading-relaxed p-1.5 rounded bg-status-green-subtle overflow-x-auto mb-1" style={{ color: ACCENT_EMERALD }}>
        + {replacement.suggestedCode}
      </pre>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
      >
        {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied!' : 'Copy suggested'}
      </button>
    </div>
  );
}
