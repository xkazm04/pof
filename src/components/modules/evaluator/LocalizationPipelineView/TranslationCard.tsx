import { ArrowRight, ArrowLeft } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { TranslationEntry } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES, REVIEW_GATE } from '@/lib/localization/definitions';
import { ACCENT_EMERALD, STATUS_WARNING } from '@/lib/chart-colors';
import { STATUS_STYLE } from './constants';
import { expansionColor, formatExpansion } from './helpers';

export function TranslationCard({ entry, sourceText }: { entry: TranslationEntry; sourceText: string }) {
  const locInfo = SUPPORTED_LOCALES.find((l) => l.code === entry.locale);
  const style = STATUS_STYLE[entry.status];
  const targetDir = locInfo?.direction ?? 'ltr';
  const isRtl = targetDir === 'rtl';
  const DirectionArrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <SurfaceCard level={2}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium text-text-muted">{locInfo?.nativeName ?? entry.locale}</span>
            <span className="text-2xs" style={{ color: style.color }}>{style.label}</span>
            {entry.expansionWarning && (
              <Badge variant="warning">expansion</Badge>
            )}
          </div>
          <p dir="ltr" className="text-xs text-text-muted mt-0.5">&quot;{sourceText}&quot;</p>
          <p
            dir={targetDir}
            lang={entry.locale}
            className="text-xs text-text font-medium mt-0.5 flex items-center gap-1"
          >
            <DirectionArrow className="w-3 h-3 shrink-0 text-text-muted" aria-hidden="true" />
            <span>&quot;{entry.translatedText}&quot;</span>
          </p>
          {locInfo && locInfo.expansionFactor !== 1.0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min((locInfo.expansionFactor / 1.5) * 100, 100)}%`,
                    backgroundColor: expansionColor(locInfo.expansionFactor),
                  }}
                />
              </div>
              <span className="text-2xs text-text-muted">{formatExpansion(locInfo.expansionFactor)}</span>
            </div>
          )}
          {entry.translatorNotes && (
            <p className="text-2xs text-text-muted mt-1 italic">{entry.translatorNotes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ProgressRing value={Math.round(entry.confidence * 100)} size={28} strokeWidth={3} color={entry.confidence >= REVIEW_GATE ? ACCENT_EMERALD : STATUS_WARNING} />
        </div>
      </div>
      {entry.charDelta !== 0 && (
        <p className="text-2xs text-text-muted mt-1">
          {entry.charDelta > 0 ? '+' : ''}{entry.charDelta} chars vs source
        </p>
      )}
    </SurfaceCard>
  );
}
