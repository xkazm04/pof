import { KPICard } from '@/components/ui/KPICard';

// ── Stat Card ───────────────────────────────────────────────────────────────

export function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <KPICard
      icon={icon}
      label={label}
      value={<span className={color}>{value}</span>}
    />
  );
}
