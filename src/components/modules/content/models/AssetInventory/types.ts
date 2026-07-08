import type { ScannedAsset, AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';

export type SortKey = 'name' | 'type' | 'size' | 'modified';
export type SortDir = 'asc' | 'desc';

export interface DependencyGraphProps {
  asset: ScannedAsset;
  allAssets: ScannedAsset[];
  dependencies: AssetDependencyEdge[];
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
