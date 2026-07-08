import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { TranslationQAFinding, LocaleQAStatus } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { SCALE } from './constants';
import { ReadyToShipBadge } from './ReadyToShipBadge';
import { QAFindingCard } from './QAFindingCard';

export function QATab({
  findings,
  byLocale,
  targetLocales,
  hasTranslations,
}: {
  findings: TranslationQAFinding[];
  byLocale: Record<string, LocaleQAStatus>;
  targetLocales: string[];
  hasTranslations: boolean;
}) {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  if (!hasTranslations) {
    return (
      <SurfaceCard>
        <div className="text-center py-10">
          <ShieldCheck className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
          <p className="text-sm text-text-muted mb-1">No translations to validate yet</p>
          <p className={`${TEXT_SCALE.body} text-text-muted`}>
            Run the pipeline to translate strings — QA then checks each result for dropped
            placeholders, number drift, untranslated segments, and glossary compliance.
          </p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Per-locale ready-to-ship gate */}
      <SurfaceCard>
        <h3 className={`${SCALE.title} mb-3 flex items-center gap-1.5`}>
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Ready to Ship by Locale
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {targetLocales.map((code) => {
            const status = byLocale[code];
            const locInfo = SUPPORTED_LOCALES.find((l) => l.code === code);
            return (
              <div key={code} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <span className="text-2xs font-medium text-text truncate">{locInfo?.nativeName ?? code}</span>
                {status ? <ReadyToShipBadge status={status} /> : <Badge variant="default">no data</Badge>}
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Findings */}
      {findings.length === 0 ? (
        <SurfaceCard>
          <div className="text-center py-10">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: ACCENT_EMERALD }} />
            <p className="text-sm text-text">All translations passed QA</p>
            <p className="text-2xs text-text-muted mt-1">Every locale is clear to ship.</p>
          </div>
        </SurfaceCard>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="error">{criticalCount} critical</Badge>
            <Badge variant="warning">{warningCount} warnings</Badge>
            <Badge variant="default">{infoCount} info</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {findings.map((f) => (
              <QAFindingCard key={f.id} finding={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
