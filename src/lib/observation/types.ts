/**
 * Observation Spine (SP1) — the durable ground-truth contract.
 *
 * Mirrors the Python observation envelope (Content/Python/observation/__init__.py).
 * An Observation is a typed reading of UE reality; a Verdict judges Observations
 * against an Intent's required Tier. See
 * docs/superpowers/specs/2026-05-29-llm-ue-interface-design.md.
 */

export type ObservationKind = 'pose' | 'frame' | 'state' | 'metric' | 'api';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type VerdictStatus = 'pass' | 'fail' | 'inconclusive';

export interface Observation<T = unknown> {
  kind: ObservationKind;
  data: T;
  capturedAt: string;
  scenarioId?: string;
  /** Reference into pipeline_artifacts once recorded. */
  artifactRef?: string;
}

export interface Verdict {
  intentId: string;
  tier: Tier;
  status: VerdictStatus;
  evidence: Observation[];
  reason: string;
}

export function makeObservation<T>(
  kind: ObservationKind,
  data: T,
  opts: { capturedAt: string; scenarioId?: string; artifactRef?: string },
): Observation<T> {
  return {
    kind,
    data,
    capturedAt: opts.capturedAt,
    scenarioId: opts.scenarioId,
    artifactRef: opts.artifactRef,
  };
}

export function makeVerdict(
  intentId: string,
  tier: Tier,
  status: VerdictStatus,
  evidence: Observation[],
  reason: string,
): Verdict {
  return { intentId, tier, status, evidence, reason };
}
