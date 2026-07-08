import {
  Database, TestTube, Camera, Cpu, Activity, Radio,
} from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { HttpMethod, SubsystemDef } from './types';

export const SUBSYSTEMS: SubsystemDef[] = [
  {
    id: 'status',
    label: 'Status',
    icon: Activity,
    color: ACCENT_EMERALD,
    endpoints: [
      { method: 'GET', path: '/pof/status', description: 'Plugin version, engine info, editor state' },
    ],
  },
  {
    id: 'manifest',
    label: 'Manifest',
    icon: Database,
    color: ACCENT_CYAN,
    endpoints: [
      { method: 'GET', path: '/pof/manifest', description: 'Full asset manifest (or ?checksum-only)' },
      { method: 'GET', path: '/pof/manifest/blueprint', description: 'Single blueprint by ?path=' },
    ],
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube,
    color: ACCENT_VIOLET,
    endpoints: [
      { method: 'POST', path: '/pof/test/run', description: 'Submit test spec for execution' },
      { method: 'GET', path: '/pof/test/results', description: 'Retrieve all test results' },
      { method: 'POST', path: '/pof/test/run-automation', description: 'Run UE5 automation tests' },
    ],
  },
  {
    id: 'snapshots',
    label: 'Snapshots',
    icon: Camera,
    color: ACCENT_ORANGE,
    endpoints: [
      { method: 'POST', path: '/pof/snapshot/capture', description: 'Capture snapshot presets' },
      { method: 'POST', path: '/pof/snapshot/baseline', description: 'Save baseline snapshots' },
      { method: 'GET', path: '/pof/snapshot/diff', description: 'Get snapshot diff report' },
    ],
  },
  {
    id: 'compile',
    label: 'Compile',
    icon: Cpu,
    color: ACCENT_EMERALD,
    endpoints: [
      { method: 'POST', path: '/pof/compile/live', description: 'Trigger live coding hot-reload' },
      { method: 'GET', path: '/pof/compile/status', description: 'Poll current compile status' },
      { method: 'POST', path: '/pof/compile/hot-patch', description: 'Write + compile + verify + auto-revert' },
      { method: 'GET', path: '/pof/compile/hot-patch/status', description: 'Poll hot-patch pipeline status' },
    ],
  },
  {
    id: 'live-state',
    label: 'Live State (WS)',
    icon: Radio,
    color: ACCENT_VIOLET,
    endpoints: [
      { method: 'GET', path: '/pof/live', description: 'WebSocket endpoint for bidirectional live state sync' },
    ],
    notIntegrated: false,
  },
];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: ACCENT_EMERALD,
  POST: ACCENT_CYAN,
};

// ── Latency sparkline ─────────────────────────────────────────────────────────

/** Samples retained per endpoint in the latency ring buffer. */
export const MAX_LATENCY_SAMPLES = 30;
/** Inline sparkline canvas size (px). */
export const SPARK_W = 60;
export const SPARK_H = 16;
