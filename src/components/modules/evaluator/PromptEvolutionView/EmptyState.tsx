import { BarChart3 } from 'lucide-react';

// ── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-8 h-8 text-text-muted/30 mb-3" />
      <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
      <p className="text-xs text-text-muted/70 max-w-xs">{description}</p>
    </div>
  );
}
