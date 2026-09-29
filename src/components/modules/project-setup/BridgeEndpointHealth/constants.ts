import {
  Database, TestTube, Camera, Cpu, Activity, Radio, Terminal,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { POF_ROUTES, type PofSubsystemId } from '@/lib/pof-bridge/routes';
import type { HttpMethod, SubsystemDef } from './types';

/** Rows come from the one declared route table — never a second copy here. */
const routesOf = (id: PofSubsystemId) => POF_ROUTES.filter((r) => r.subsystem === id);

export const SUBSYSTEMS: SubsystemDef[] = [
  { id: 'status', label: 'Status', icon: Activity, color: ACCENT_EMERALD, endpoints: routesOf('status') },
  { id: 'manifest', label: 'Manifest', icon: Database, color: ACCENT_CYAN, endpoints: routesOf('manifest') },
  { id: 'testing', label: 'Testing', icon: TestTube, color: ACCENT_VIOLET, endpoints: routesOf('testing') },
  { id: 'snapshots', label: 'Snapshots', icon: Camera, color: ACCENT_ORANGE, endpoints: routesOf('snapshots') },
  { id: 'compile', label: 'Compile', icon: Cpu, color: ACCENT_EMERALD, endpoints: routesOf('compile') },
  { id: 'python', label: 'Python', icon: Terminal, color: ACCENT_CYAN, endpoints: routesOf('python') },
  { id: 'live-state', label: 'Live State (WS)', icon: Radio, color: ACCENT_VIOLET, endpoints: routesOf('live-state') },
];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: ACCENT_EMERALD,
  POST: ACCENT_CYAN,
  WS: ACCENT_VIOLET,
};

// ── Latency sparkline ─────────────────────────────────────────────────────────

/** Samples retained per endpoint in the latency ring buffer. */
export const MAX_LATENCY_SAMPLES = 30;
/** Inline sparkline canvas size (px). */
export const SPARK_W = 60;
export const SPARK_H = 16;
