import type { PofRoute, PofRouteMethod, PofSubsystemId } from '@/lib/pof-bridge/routes';
import type { ProbeFailureKind } from '@/lib/bridge-doctor/probes';

// ── Endpoint catalog (derived from POF_ROUTES, @/lib/pof-bridge/routes) ─────

export type HttpMethod = PofRouteMethod;

/** One monitored row: a declared PoF route. */
export type EndpointDef = PofRoute;

/** Presentation for one subsystem; its endpoints come from the route table. */
export interface SubsystemDef {
  id: PofSubsystemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  endpoints: readonly EndpointDef[];
  /** If true, the subsystem is declared but not yet implemented in the C++ plugin. */
  notIntegrated?: boolean;
}

// ── Health state ────────────────────────────────────────────────────────────

export type HealthStatus = 'unknown' | 'healthy' | 'error' | 'timeout';

/**
 * Outcome of one probe. Routes whose plan is `not-probed` never get an entry —
 * they are outside every healthy/probed count by construction.
 */
export interface EndpointHealth {
  status: HealthStatus;
  /** The Bridge Doctor's classification of a failed probe. */
  kind?: ProbeFailureKind;
  statusCode?: number;
  responseMs?: number;
  lastChecked?: number;
}
