'use client';

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
      // min-width keeps each card legible so the wrapping row reflows 4 → 2 → 1
      // instead of squashing all four onto one cramped line.
      className="min-w-[170px]"
    />
  );
}
