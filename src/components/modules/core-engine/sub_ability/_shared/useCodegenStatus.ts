'use client';

import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { CallbackStatus } from '@/lib/cli-task';
import type { CodegenReport, EnrichedAbilitySpec } from '@/lib/ability/spec';

/** What the UI knows about the last generate-gas-effects run for an entity. */
export type CodegenState = 'idle' | 'dispatched' | 'confirmed' | 'failed';

export interface CodegenStatus {
  state: CodegenState;
  /** The persisted report behind a confirmed/failed state (null while idle/dispatched). */
  report: CodegenReport | null;
  /** Why it failed — always set when `state === 'failed'` (Rule 4). */
  reason: string | null;
  /** Call when the task is dispatched. */
  markDispatched: () => void;
  /** Wire straight into `useModuleCLI({ onComplete })`. */
  onCliComplete: (success: boolean, callbackStatus?: CallbackStatus) => void;
}

/**
 * Turns a fire-and-forget `generate-gas-effects` dispatch into a reported
 * outcome: on run completion it reads the spec back from the DB and surfaces
 * the codegen provenance the task's callback wrote. A run that emitted no
 * callback marker (or whose POST failed) is `failed` with that reason — never
 * a silent success, and never an eternal "dispatched…".
 */
export function useCodegenStatus(catalogId: string, entityId: string): CodegenStatus {
  const [state, setState] = useState<CodegenState>('idle');
  const [report, setReport] = useState<CodegenReport | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const markDispatched = useCallback(() => {
    setState('dispatched');
    setReport(null);
    setReason(null);
  }, []);

  const onCliComplete = useCallback((success: boolean, callbackStatus?: CallbackStatus) => {
    const fail = (why: string) => {
      setState('failed');
      setReport(null);
      setReason(why);
    };

    if (callbackStatus === 'missing') {
      fail('The agent finished without reporting a result — no files were confirmed in the UE project.');
      return;
    }
    if (callbackStatus === 'failed') {
      fail("The agent reported a result but it was rejected (the app couldn't record it).");
      return;
    }

    void (async () => {
      const res = await tryApiFetch<EnrichedAbilitySpec | null>(
        `/api/ability-spec?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (!res.ok) {
        logger.warn('[codegen-status] spec read-back failed:', res.error);
        fail(`Couldn't read the codegen result back: ${res.error}`);
        return;
      }
      const rep = res.data?.codegen ?? null;
      if (!rep) {
        fail(
          success
            ? 'The run ended without a codegen report — nothing was confirmed in the UE project.'
            : 'The CLI run failed before it could report any generated C++.',
        );
        return;
      }
      setReport(rep);
      setReason(rep.status === 'failed' ? (rep.reason ?? 'Codegen failed for an unreported reason.') : null);
      setState(rep.status === 'confirmed' ? 'confirmed' : 'failed');
    })();
  }, [catalogId, entityId]);

  return { state, report, reason, markDispatched, onCliComplete };
}
