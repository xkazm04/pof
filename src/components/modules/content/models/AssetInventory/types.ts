import type { ScannedAsset } from '@/app/api/filesystem/scan-assets/route';
import type { InventoryEdge } from '@/lib/asset-inventory/declared-edges';

export type SortKey = 'name' | 'type' | 'size' | 'modified';
export type SortDir = 'asc' | 'desc';
/** Reconcile filter against UE's manifest; null when no manifest is connected. */
export type UeFilter = 'all' | 'not-in-manifest' | null;

export interface DependencyGraphProps {
  asset: ScannedAsset;
  allAssets: ScannedAsset[];
  dependencies: InventoryEdge[];
  /** Whether UE's manifest lists this asset; null when no manifest is connected. */
  ueListed: boolean | null;
}

export interface BridgeManifestSummary {
  blueprints: number;
  materials: number;
  animations: number;
  dataTables: number;
  other: number;
  total: number;
  checksum: string;
  generatedAt: string;
}
