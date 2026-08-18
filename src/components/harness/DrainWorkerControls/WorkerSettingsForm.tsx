'use client';

import { MicroLabel } from '@/components/ui/MicroLabel';

export interface WorkerSettings {
  /** Tick cadence in seconds (the route floors the resulting ms at 5s). */
  intervalSeconds: string;
  executor: 'bridge' | 'spawn';
  /** '' = both runtime tiers. */
  tier: '' | 'L3' | 'L4';
  catalogId: string;
}

export const DEFAULT_WORKER_SETTINGS: WorkerSettings = {
  intervalSeconds: '30',
  executor: 'bridge',
  tier: '',
  catalogId: '',
};

const CONTROL =
  'w-full text-xs font-mono rounded border border-border/60 bg-surface-deep/60 text-text px-2 py-1 focus-ring';

interface Props {
  values: WorkerSettings;
  onChange: (patch: Partial<WorkerSettings>) => void;
  disabled?: boolean;
}

/**
 * The worker's start settings. Every field maps 1:1 onto a key the existing toggle
 * route already parses (`intervalMs`, `executor`, `tier`, `catalogId`) — the panel
 * adds no drain capability, only a way to reach the one that exists.
 */
export function WorkerSettingsForm({ values, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-0 p-0 m-0 min-w-0">
      <legend className="sr-only">Drain worker settings</legend>

      <label htmlFor="drain-worker-interval" className="block space-y-1">
        <MicroLabel as="span" uppercase>Interval (s)</MicroLabel>
        <input
          id="drain-worker-interval"
          value={values.intervalSeconds}
          onChange={(e) => onChange({ intervalSeconds: e.target.value })}
          className={CONTROL}
        />
      </label>

      <label htmlFor="drain-worker-executor" className="block space-y-1">
        <MicroLabel as="span" uppercase>Executor</MicroLabel>
        <select
          id="drain-worker-executor"
          value={values.executor}
          onChange={(e) => onChange({ executor: e.target.value === 'spawn' ? 'spawn' : 'bridge' })}
          className={CONTROL}
        >
          <option value="bridge">bridge (running editor)</option>
          <option value="spawn">spawn (headless boot)</option>
        </select>
      </label>

      <label htmlFor="drain-worker-tier" className="block space-y-1">
        <MicroLabel as="span" uppercase>Tier</MicroLabel>
        <select
          id="drain-worker-tier"
          value={values.tier}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ tier: v === 'L3' || v === 'L4' ? v : '' });
          }}
          className={CONTROL}
        >
          <option value="">L3 + L4</option>
          <option value="L3">L3 only</option>
          <option value="L4">L4 only</option>
        </select>
      </label>

      <label htmlFor="drain-worker-catalog" className="block space-y-1">
        <MicroLabel as="span" uppercase>Catalog</MicroLabel>
        <input
          id="drain-worker-catalog"
          value={values.catalogId}
          onChange={(e) => onChange({ catalogId: e.target.value })}
          placeholder="(every catalog)"
          className={CONTROL}
        />
      </label>
    </fieldset>
  );
}
