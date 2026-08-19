import { motion } from 'framer-motion';
import { Activity, Clock, Zap, Play } from 'lucide-react';
import type { DirectorEvent } from '@/types/game-director';
import { STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACCENT, EVENT_ICONS } from './constants';

export function TimelineView({ events, onSimulate }: { events: DirectorEvent[]; onSimulate?: () => Promise<void> }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        iconColor={ACCENT}
        satelliteIcons={[Clock, Zap]}
        title="No events recorded yet"
        description="The timeline shows every action and observation recorded during a playtest. Simulated sessions record only what the fixture actually did — the entries are prefixed SIMULATED and no screenshot events appear, because none are captured."
        action={onSimulate ? { label: 'Simulate Playtest', onClick: () => { void onSimulate(); }, icon: Play } : undefined}
      />
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-3">
        {events.map((event, idx) => {
          const Icon = EVENT_ICONS[event.type] ?? Activity;
          const isError = event.type === 'error';
          const isFinding = event.type === 'finding';

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.02 }}
              className="relative flex items-start gap-3"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-[-18px] w-3 h-3 rounded-full border-2 border-surface-deep flex-shrink-0"
                style={{
                  backgroundColor: isError ? STATUS_ERROR : isFinding ? STATUS_WARNING : 'var(--border-bright)',
                }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isError ? STATUS_ERROR : isFinding ? STATUS_WARNING : 'var(--text-muted)' }}
                  />
                  <span className="text-sm" style={{ color: isError ? STATUS_ERROR : 'var(--text)' }}>
                    {event.message}
                  </span>
                </div>
                <span className="text-2xs text-text-muted">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
