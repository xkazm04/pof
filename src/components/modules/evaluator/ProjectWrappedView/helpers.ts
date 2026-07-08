import type { ProjectWrapped } from '@/types/project-wrapped';

// ── Format helpers ─────────────────────────────────────────────────────────────

export function formatLongDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

export function spanCaption(w: ProjectWrapped): string {
  if (!w.firstSessionDate || !w.lastSessionDate) return 'Lifetime recap';
  const first = monthLabel(w.firstSessionDate.slice(0, 7));
  const last = monthLabel(w.lastSessionDate.slice(0, 7));
  const range = first === last ? first : `${first} — ${last}`;
  return `${range} · ${w.spanDays} day${w.spanDays === 1 ? '' : 's'}`;
}
