/**
 * Typed client for the Observation Spine verbs over the /pof/python/run bridge.
 * `observe(verb, args)` dispatches `observation.<verb>` and returns the Observation.
 */
import { runPython, type RunPythonOptions } from '@/lib/bridge/run-python';
import type { Observation, ObservationKind } from './types';

export type Verb = 'get_state' | 'api_probe' | 'evaluate_pose' | 'capture_frame' | 'run_scenario';

export async function observe<T = unknown>(
  verb: Verb,
  args: Record<string, unknown>,
  opts: RunPythonOptions = {},
): Promise<Observation<T>> {
  const res = await runPython<Observation<T>>(`observation.${verb}`, 'run', args, opts);
  if (!res.ok) {
    return {
      kind: 'metric' as ObservationKind,
      data: { error: res.error } as T,
      capturedAt: new Date(0).toISOString(),
    };
  }
  return res.data;
}
