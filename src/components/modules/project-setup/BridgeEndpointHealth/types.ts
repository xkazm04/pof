// ── Endpoint catalog (from PofHttpServer.cpp) ───────────────────────────────

export type HttpMethod = 'GET' | 'POST';

export interface EndpointDef {
  method: HttpMethod;
  path: string;
  description: string;
}

export interface SubsystemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  endpoints: EndpointDef[];
  /** If true, the subsystem is declared but not yet implemented in the C++ plugin. */
  notIntegrated?: boolean;
}

// ── Health state ────────────────────────────────────────────────────────────

export type HealthStatus = 'unknown' | 'healthy' | 'error' | 'timeout';

export interface EndpointHealth {
  status: HealthStatus;
  statusCode?: number;
  responseMs?: number;
  lastChecked?: number;
}
