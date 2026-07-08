import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { VariantStats } from '@/types/prompt-evolution';
import { rateVariant } from './helpers';

export function StatsBadge({ stats }: { stats: VariantStats }) {
  if (stats.trials === 0) {
    return <Badge variant="default" className="text-[11px]">untested</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={rateVariant(stats)} className="text-[11px]">
        {Math.round(stats.successRate * 100)}% · {stats.successes}/{stats.trials}
      </Badge>
      {stats.wins > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-yellow-500" title={`Won ${stats.wins} A/B test${stats.wins === 1 ? '' : 's'}`}>
          <Trophy className="w-3 h-3" />
          {stats.wins}
        </span>
      )}
    </span>
  );
}
