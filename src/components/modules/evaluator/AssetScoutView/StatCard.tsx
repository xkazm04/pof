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

// ── Tab Button ──────────────────────────────────────────────────────────────

export function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-emerald-400' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-emerald-500" />
      )}
    </button>
  );
}
