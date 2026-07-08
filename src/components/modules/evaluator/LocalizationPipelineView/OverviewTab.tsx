import { Globe, Languages, BookOpen, ArrowRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { ScanResult, LOCTEXTReplacementSuggestion, LocaleQAStatus } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { ACCENT_EMERALD, ACCENT_INDIGO, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { SCALE } from './constants';
import { ReadyToShipBadge } from './ReadyToShipBadge';
import { ExpansionFactorBars } from './ExpansionFactorBars';
import { ReplacementCard } from './ReplacementCard';

export function OverviewTab({
  scanResult,
  locReadiness,
  localizedCount,
  totalStrings,
  hardcoded,
  ftextCount,
  progress,
  expansionIssues,
  qaByLocale,
  replacements,
}: {
  scanResult: ScanResult;
  locReadiness: number;
  localizedCount: number;
  totalStrings: number;
  hardcoded: number;
  ftextCount: number;
  progress: Record<string, number>;
  expansionIssues: Record<string, number>;
  qaByLocale: Record<string, LocaleQAStatus>;
  replacements: LOCTEXTReplacementSuggestion[];
}) {
  return (
    <div className="space-y-4">
      {/* Readiness gauge */}
      <SurfaceCard>
        <div className="flex items-center gap-6">
          <ProgressRing value={locReadiness} size={72} strokeWidth={6} color={ACCENT_INDIGO} />
          <div>
            <p className={SCALE.title}>Localization Readiness</p>
            <p className={`${TEXT_SCALE.body} text-text-muted mt-0.5`}>
              {localizedCount} of {totalStrings} strings use NSLOCTEXT/LOCTEXT macros
            </p>
            {hardcoded > 0 && (
              <p className={`${TEXT_SCALE.meta} mt-1`} style={{ color: STATUS_ERROR }}>
                {hardcoded} hardcoded + {ftextCount} FText::FromString need conversion
              </p>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Translation progress per locale */}
      {Object.keys(progress).length > 0 && (
        <SurfaceCard>
          <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            Translation Progress by Locale
          </h3>
          <div className="space-y-2">
            {Object.entries(progress).map(([locale, pct]) => {
              const locInfo = SUPPORTED_LOCALES.find((l) => l.code === locale);
              const expIssues = expansionIssues[locale] ?? 0;
              return (
                <div key={locale} className="flex items-center gap-3">
                  <span className="text-2xs text-text-muted w-24 shrink-0">
                    {locInfo?.nativeName ?? locale}
                  </span>
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${locInfo?.nativeName ?? locale} translation progress`}
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? ACCENT_EMERALD : pct >= 50 ? STATUS_WARNING : STATUS_ERROR }}
                    />
                  </div>
                  <span className="text-2xs text-text-muted w-10 text-right">{pct}%</span>
                  {expIssues > 0 && (
                    <Badge variant="warning">{expIssues} exp</Badge>
                  )}
                  {qaByLocale[locale] && <ReadyToShipBadge status={qaByLocale[locale]} />}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* Expansion factor comparison */}
      <SurfaceCard>
        <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          Text Expansion by Locale
        </h3>
        <p className={`${TEXT_SCALE.body} text-text-muted mb-3`}>
          How much longer (or shorter) translated text is compared to English. Higher values risk UI overflow.
        </p>
        <ExpansionFactorBars />
      </SurfaceCard>

      {/* Module breakdown */}
      <SurfaceCard>
        <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          Module Breakdown
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(scanResult.moduleBreakdown).map(([mod, data]) => (
            <div key={mod} className="rounded-lg border border-border p-2.5">
              <p className={`${TEXT_SCALE.meta} font-medium text-text truncate`}>{mod}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={SCALE.meta}>{data.total} strings</span>
                {data.hardcoded > 0 && (
                  <span className={TEXT_SCALE.meta} style={{ color: STATUS_ERROR }}>{data.hardcoded} hardcoded</span>
                )}
                {data.localized > 0 && (
                  <span className={TEXT_SCALE.meta} style={{ color: ACCENT_EMERALD }}>{data.localized} loc</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* LOCTEXT replacements preview */}
      {replacements.length > 0 && (
        <SurfaceCard>
          <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            LOCTEXT Replacement Suggestions ({replacements.length})
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {replacements.slice(0, 10).map((r) => (
              <ReplacementCard key={r.stringId} replacement={r} />
            ))}
            {replacements.length > 10 && (
              <p className="text-2xs text-text-muted text-center py-1">
                +{replacements.length - 10} more — switch to Strings tab for full list
              </p>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
