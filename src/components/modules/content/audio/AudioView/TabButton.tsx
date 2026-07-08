'use client';
import { Music } from 'lucide-react';

export function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  accent,
}: {
  label: string;
  icon: typeof Music;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accent }}
        />
      )}
    </button>
  );
}
