'use client';

import { memo } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import type { SubModuleId } from '@/types/modules';
import { STATUS_COLORS } from './constants';
import { deriveStatusForModule } from './helpers';

export const StatusBadge = memo(function StatusBadge({ moduleId }: { moduleId: SubModuleId }) {
  const status = useCLIPanelStore((s) => deriveStatusForModule(s.sessions, moduleId));

  if (!status) return null;

  const color = STATUS_COLORS[status];
  const label = status === 'failed' ? 'Task failed' : 'Task running';

  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-deep"
      style={{ backgroundColor: color }}
      title={label}
      aria-label={label}
    >
      {status === 'running' && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
      )}
    </span>
  );
});
