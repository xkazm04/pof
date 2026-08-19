import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { LocaleQAStatus } from '@/types/localization-pipeline';

/* ── Translation QA ─────────────────────────────────────────────────────── */

/**
 * Per-locale "ready to ship" gate. Green only when the locale has translations
 * and zero blocking (critical/warning) QA findings; amber with a fix count
 * otherwise. Mirrors the memoQ/Lokalise "clean QA run" ship gate.
 */
export function ReadyToShipBadge({ status }: { status: LocaleQAStatus }) {
  if (status.totalEntries === 0) {
    return <Badge variant="default">no data</Badge>;
  }
  if (status.readyToShip) {
    return (
      // The domain glyph IS this badge's shape cue, so opt out of the generic
      // ramp check-mark rather than stacking two icons in one 10px pill.
      <Badge variant="success" showIcon={false}>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck aria-hidden="true" className="w-3 h-3" />
          ready to ship
        </span>
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      {status.blockingCount} to fix
    </Badge>
  );
}
