import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type MaterialCategory = 'elemental' | 'stylized' | 'utility';

export interface MaterialPattern {
  id: string;
  name: string;
  category: MaterialCategory;
  icon: LucideIcon;
  description: string;
  /** High-level approach using HLSL / material nodes */
  approach: string;
  /** Key HLSL snippet or node description */
  hlslSnippet: string;
  tags: string[];
}

export interface MaterialPatternCatalogConfig {
  patterns: MaterialPattern[];
}
