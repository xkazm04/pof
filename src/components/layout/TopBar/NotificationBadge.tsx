'use client';

import { Bell } from 'lucide-react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { STATUS_ERROR } from '@/lib/chart-colors';

// --- Notification badge (unchanged) ---

export function NotificationBadge() {
  const unreadCount = useActivityFeedStore((s) => s.events.filter((e) => !e.dismissed).length);
  const toggleOpen = useActivityFeedStore((s) => s.toggleOpen);
  const isOpen = useActivityFeedStore((s) => s.isOpen);

  return (
    <button
      onClick={toggleOpen}
      aria-label={`Activity feed${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      aria-expanded={isOpen}
      className={`relative p-1.5 rounded-md transition-colors focus-ring ${
        isOpen
          ? 'bg-status-red-subtle'
          : 'text-text-muted hover:text-text hover:bg-surface'
      }`}
      style={isOpen ? { color: STATUS_ERROR } : undefined}
      title="Activity feed"
    >
      <Bell className="w-4 h-4" aria-hidden="true" />
      {unreadCount > 0 && (
        <span aria-hidden="true" style={{ backgroundColor: STATUS_ERROR }} className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 text-2xs font-bold text-white rounded-full leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
