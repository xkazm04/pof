import { useCallback, useState } from 'react';
import { Sparkles, Skull, AlertTriangle, Copy, Check } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { UI_TIMEOUTS } from '@/lib/constants';
import { formatReportCardText, type FightReportCard } from '@/lib/combat/fight-report';
import { BAND_STYLE } from './constants';

// ── Fight Report Card (Story Mode) ──────────────────────────────────────────

/**
 * Narrated, shareable plain-language summary of a finished run — the headline
 * answer a non-technical stakeholder grasps in one read. Reads from the pure
 * `narrateSummary` generator; a Copy button exports it as shareable text.
 */
export function FightReportCardPanel({
  report, scenarioName, iterations,
}: {
  report: FightReportCard;
  scenarioName?: string;
  iterations?: number;
}) {
  const [copied, setCopied] = useState(false);
  const style = BAND_STYLE[report.band];

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatReportCardText(report, scenarioName));
      setCopied(true);
      window.setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }, [report, scenarioName]);

  return (
    <SurfaceCard className={`p-5 border ${style.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`w-4 h-4 ${style.text}`} />
        <h2 className="text-sm font-medium text-text">Fight Report Card</h2>
        <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        <button
          onClick={handleCopy}
          title="Copy this report as shareable text"
          className="focus-ring ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-2xs text-text-muted hover:text-text transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Headline (win rate) */}
      <p className={`text-lg font-semibold leading-snug ${style.text}`}>{report.headline}</p>

      {/* Verdict (pace) */}
      <p className="mt-1 text-sm text-text-muted">{report.verdict}</p>

      {/* Top fix (dominant threat) */}
      {report.topFix && (
        <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}>
          <Skull className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${style.text}`} />
          <p className="text-xs text-text leading-relaxed">{report.topFix}</p>
        </div>
      )}

      {/* Secondary call-outs */}
      {report.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {report.notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2 text-2xs text-text-muted">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Sample-size footnote */}
      {iterations != null && (
        <p className="mt-3 text-2xs text-text-muted/60">
          Based on {iterations.toLocaleString()} simulated fights.
        </p>
      )}
    </SurfaceCard>
  );
}
