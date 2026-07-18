'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, FolderOpen } from 'lucide-react';
import type { ScannedAsset, AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';
import { TYPE_CONFIG } from './constants';
import { formatBytes, formatDate } from './helpers';
import { DependencyGraph } from './DependencyGraph';

interface AssetCardProps {
  asset: ScannedAsset;
  isExpanded: boolean;
  edgeCount: Record<string, number>;
  allAssets: ScannedAsset[];
  dependencies: AssetDependencyEdge[];
  setExpandedAsset: (value: string | null) => void;
}

export function AssetCard({ asset, isExpanded, edgeCount, allAssets, dependencies, setExpandedAsset }: AssetCardProps) {
  const conf = TYPE_CONFIG[asset.type];
  const Icon = conf.icon;

  return (
    <motion.div
      key={asset.relativePath}
      layout
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ y: isExpanded ? 0 : -5, scale: isExpanded ? 1 : 1.02 }}
      className={`relative group ${isExpanded ? 'col-span-full row-span-2' : ''}`}
      style={{ perspective: 1000 }}
    >
      <div
        className={`h-full flex flex-col relative transition-all duration-300 ${isExpanded ? 'border-2 shadow-2xl' : 'border shadow-lg cursor-pointer'}`}
        style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: '16px',
          overflow: 'hidden',
          borderColor: isExpanded ? `${conf.color}80` : `${conf.color}30`,
          boxShadow: isExpanded ? `0 0 30px -5px ${conf.color}40, inset 0 0 20px -10px ${conf.color}20` : `0 10px 20px -10px rgba(0,0,0,0.5), inset 0 0 10px -5px ${conf.color}20`,
        }}
        onClick={() => !isExpanded && setExpandedAsset(asset.relativePath)}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: `${conf.color}20`, opacity: isExpanded ? 1 : 0.4 }} />

        {/* Particle Background */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
          style={{ backgroundImage: `radial-gradient(circle at center, ${conf.color}20 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

        {/* Header */}
        <div className="p-4 flex flex-col relative z-10 flex-1 border-b" style={{ borderColor: `${conf.color}20`, backgroundColor: `${conf.color}05` }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-xl border shadow-inner overflow-hidden relative" style={{ backgroundColor: `${conf.color}15`, borderColor: `${conf.color}40` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,255,255,0.2)] to-transparent pointer-events-none" />
              <Icon className="w-5 h-5 relative z-10" style={{ color: conf.color, filter: `drop-shadow(0 0 4px ${conf.color}80)` }} />
            </div>
            <div className="flex flex-col items-end">
              <span
                className="text-xs px-2 py-0.5 rounded font-mono font-bold uppercase border shadow-sm"
                style={{ color: conf.color, backgroundColor: conf.color + '15', borderColor: `${conf.color}30` }}
              >
                {conf.label}
              </span>
              <span className="text-xs text-text-muted mt-1.5 tabular-nums font-mono">{formatBytes(asset.sizeBytes)}</span>
            </div>
          </div>

          <div className="mt-auto">
            <h3 className="text-sm font-bold text-text mb-1 truncate tracking-wide" title={asset.name}>{asset.name}</h3>
            <p className="text-xs text-text-muted font-mono truncate opacity-60 flex items-center gap-1" title={asset.relativePath}>
              <FolderOpen className="w-3 h-3" /> {asset.relativePath}
            </p>
          </div>
        </div>

        {/* Footer Info */}
        {!isExpanded && (
          <div className="px-4 py-2.5 bg-surface/40 flex justify-between items-center relative z-10">
            <span className="text-xs text-text-muted opacity-80">{formatDate(asset.modifiedAt)}</span>
            <div className="text-xs text-text-muted font-mono bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">
              {edgeCount[asset.relativePath] ?? 0} edges
            </div>
          </div>
        )}

        {/* Expanded Content (Dependency Graph) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative z-10 flex-1 bg-background/60 backdrop-blur-md"
            >
              <div className="p-4 border-t" style={{ borderColor: `${conf.color}20` }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xs text-cyan-500 font-mono uppercase flex items-center gap-2">
                    <ScanLine className="w-4 h-4" /> Dependency Graph
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedAsset(null); }}
                    className="text-xs text-text-muted hover:text-text px-2 py-1 rounded bg-surface border border-border shadow-sm cursor-pointer hover:bg-surface-hover transition-colors font-mono"
                  >
                    CLOSE
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/30 bg-black/40 shadow-inner p-4 custom-scrollbar flex justify-center">
                  <DependencyGraph
                    asset={asset}
                    allAssets={allAssets}
                    dependencies={dependencies}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
