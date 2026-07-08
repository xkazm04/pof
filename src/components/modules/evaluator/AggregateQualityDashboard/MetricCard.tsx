import { TrendingUp } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <KPICard
      layout="vertical"
      animated
      accent={accent}
      icon={<Icon className="w-3.5 h-3.5" style={{ color: accent }} />}
      label={label}
      value={value}
      sub={sub}
    />
  );
}
