'use client';

import { Activity } from 'lucide-react';

export function SourceBadge({
  label,
  active,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  icon: typeof Activity;
}) {
  return (
    <div
      className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
      style={{
        backgroundColor: active ? 'var(--border)' : 'var(--surface-deep)',
        border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`,
      }}
      title={`${label}: ${active ? 'Data available' : 'No data'}`}
    >
      <Icon
        className="w-3 h-3"
        style={{ color: active ? 'var(--text)' : '#3a3a5a' }}
      />
    </div>
  );
}
