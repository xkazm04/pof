import { ArrowRight } from 'lucide-react';
import type { LOCTEXTReplacementSuggestion } from '@/types/localization-pipeline';
import { ACCENT_EMERALD, STATUS_ERROR } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { CopyTextButton } from './CopyTextButton';

export function ReplacementCard({ replacement }: { replacement: LOCTEXTReplacementSuggestion }) {
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
      <CopyTextButton text={replacement.suggestedCode} label="Copy suggested" />
    </div>
  );
}
