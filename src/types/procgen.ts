import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

export interface ProcgenRun {
  id: number;
  roomCount: number;
  seed: number;
  createdAt: string;
}

export interface ScatterRun {
  id: number;
  instanceCount: number;
  seed: number;
  createdAt: string;
}

export interface ZoneGraphPin {
  id: number;
  seed: number;
  params: ZoneGraphParams;
  label: string;
  zoneCount: number;
  topology: string;
  createdAt: string;
}
