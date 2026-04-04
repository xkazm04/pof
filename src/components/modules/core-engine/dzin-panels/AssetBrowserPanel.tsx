'use client';

import { FolderSearch, Filter, Grid3x3 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface AssetBrowserPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS['visual-gen'];

const ASSET_CATEGORIES = [
  { name: 'Static Meshes', count: 342, format: '.uasset', color: ACCENT_CYAN },
  { name: 'Skeletal Meshes', count: 87, format: '.uasset', color: ACCENT_VIOLET },
  { name: 'Materials', count: 214, format: '.uasset', color: ACCENT_ORANGE },
  { name: 'Textures', count: 1256, format: '.png/.exr', color: ACCENT_EMERALD },
] as const;

const RECENT_ASSETS = [
  { name: 'SM_Sword_01', type: 'StaticMesh', path: '/Game/Weapons/', size: '2.4 MB', modified: '2026-03-31' },
  { name: 'SK_Hero_Base', type: 'SkeletalMesh', path: '/Game/Characters/', size: '18.6 MB', modified: '2026-03-30' },
  { name: 'MI_Metal_Worn', type: 'MaterialInstance', path: '/Game/Materials/', size: '0.3 MB', modified: '2026-03-30' },
  { name: 'T_Stone_Normal', type: 'Texture2D', path: '/Game/Textures/', size: '5.1 MB', modified: '2026-03-29' },
  { name: 'SM_Shield_Round', type: 'StaticMesh', path: '/Game/Weapons/', size: '1.8 MB', modified: '2026-03-28' },
] as const;

const FILTER_TAGS = ['Weapon', 'Character', 'Environment', 'UI', 'VFX', 'Audio'] as const;

/* ── Micro density ──────────────────────────────────────────────────────── */

function BrowserMicro() {
  const total = ASSET_CATEGORIES.reduce((s, c) => s + c.count, 0);
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <FolderSearch className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{total} assets</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function BrowserCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Asset Categories</span>
        <span className="font-mono text-text">{FILTER_TAGS.length} tags</span>
      </div>
      {ASSET_CATEGORIES.map((c) => (
        <div key={c.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
          <span className="text-text flex-1">{c.name}</span>
          <span className="text-text-muted font-mono">{c.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function BrowserFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Asset browser with category filtering, tag-based search, and recent asset history for the content pipeline.
      </SurfaceCard>

      {/* Categories */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Grid3x3} label="Asset Categories" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gap} mt-2`}>
          {ASSET_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            >
              <SurfaceCard level={3} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text">{cat.name}</span>
                  <span className="text-2xs font-mono" style={{ color: cat.color }}>{cat.count}</span>
                </div>
                <div className="text-2xs text-text-muted">Format: {cat.format}</div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Filter Tags */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Filter} label="Filter Tags" color={ACCENT} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FILTER_TAGS.map((tag) => (
            <span
              key={tag}
              className="text-2xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
            >
              {tag}
            </span>
          ))}
        </div>
      </SurfaceCard>

      {/* Recent Assets */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FolderSearch} label="Recent Assets" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {RECENT_ASSETS.map((asset, i) => (
            <motion.div
              key={asset.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-text font-medium">{asset.name}</span>
                <span className="text-text-muted text-2xs">{asset.modified}</span>
              </div>
              <div className="flex gap-3 text-text-muted text-2xs">
                <span>{asset.type}</span>
                <span>{asset.path}</span>
                <span>{asset.size}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AssetBrowserPanel({ featureMap, defs }: AssetBrowserPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Asset Browser" icon={<FolderSearch className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <BrowserMicro />}
          {density === 'compact' && <BrowserCompact />}
          {density === 'full' && <BrowserFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
