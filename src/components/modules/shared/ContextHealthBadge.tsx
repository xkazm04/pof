'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { STATUS_SUCCESS, MODULE_COLORS } from '@/lib/chart-colors';

interface FieldStatus {
  label: string;
  value: string;
  ok: boolean;
}

function getFieldStatuses(
  projectName: string,
  projectPath: string,
  ueVersion: string,
): FieldStatus[] {
  return [
    {
      label: 'Project Name',
      value: projectName || 'Not set',
      ok: !!projectName && projectName !== 'MyProject',
    },
    {
      label: 'Project Path',
      value: projectPath || 'Not set',
      ok: !!projectPath,
    },
    {
      label: 'UE Version',
      value: ueVersion || 'Not set',
      ok: !!ueVersion,
    },
  ];
}

function formatTimeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ContextHealthBadge() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const dynamicContext = useProjectStore((s) => s.dynamicContext);
  const isScanning = useProjectStore((s) => s.isScanning);
  const scanError = useProjectStore((s) => s.scanError);
  const scanProject = useProjectStore((s) => s.scanProject);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fields = getFieldStatuses(projectName, projectPath, ueVersion);
  const staticHealthy = fields.every((f) => f.ok);
  const hasDynamic = !!dynamicContext;
  const allHealthy = staticHealthy && hasDynamic;
  const missingCount = fields.filter((f) => !f.ok).length;

  // Auto-scan when tooltip opens and we have project configured but no scan data
  useEffect(() => {
    if (showTooltip && staticHealthy && !dynamicContext && !isScanning) {
      scanProject();
    }
  }, [showTooltip, staticHealthy, dynamicContext, isScanning, scanProject]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTooltip]);

  const handleMouseEnter = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 300);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 200);
  };

  const handleClick = () => {
    setShowTooltip(false);
    navigateToModule('project-setup');
  };

  const handleRescan = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Force rescan by clearing cache timestamp
    useProjectStore.setState({ dynamicContext: null });
    scanProject();
  }, [scanProject]);

  const dotColor = allHealthy ? STATUS_SUCCESS : staticHealthy ? MODULE_COLORS.core : MODULE_COLORS.content;
  const glowColor = allHealthy
    ? 'rgba(34,197,94,0.4)'
    : staticHealthy
      ? 'rgba(59,130,246,0.4)'
      : 'rgba(245,158,11,0.4)';

  return (
    <div ref={containerRef} className="relative flex items-center">
      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative flex items-center justify-center w-4 h-4 rounded-full cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
        aria-label={
          allHealthy
            ? 'Context healthy — all fields configured, project scanned'
            : staticHealthy && !hasDynamic
              ? 'Context partial — project not yet scanned'
              : `Context incomplete — ${missingCount} field${missingCount > 1 ? 's' : ''} missing`
        }
        title=""
      >
        <span
          className="block rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: dotColor,
            boxShadow: `0 0 4px ${glowColor}`,
          }}
        />
        {/* Pulse ring for non-green state */}
        {!allHealthy && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${dotColor}` }}
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="absolute left-1/2 top-full mt-2 z-50 -translate-x-1/2"
          >
            <div className="bg-[#161633] border border-[#2a2a4a] rounded-lg shadow-xl p-3 min-w-[240px] max-w-[320px]">
              <p className="text-xs font-semibold text-text-muted-hover uppercase tracking-wider mb-2">
                Context Health
              </p>

              {/* Static fields */}
              <div className="space-y-1.5">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center gap-2">
                    <span
                      className="flex-shrink-0 rounded-full"
                      style={{
                        width: 5,
                        height: 5,
                        backgroundColor: f.ok ? STATUS_SUCCESS : MODULE_COLORS.content,
                      }}
                    />
                    <span className="text-xs text-text-muted flex-shrink-0">
                      {f.label}
                    </span>
                    <span
                      className={`text-xs truncate ml-auto ${
                        f.ok ? 'text-text-muted' : 'text-[#f59e0b]'
                      }`}
                      style={{ maxWidth: 120 }}
                    >
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dynamic context section */}
              {staticHealthy && (
                <>
                  <div className="mt-3 pt-2.5 border-t border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-text-muted-hover uppercase tracking-wider">
                        Project Scan
                      </p>
                      <button
                        onClick={handleRescan}
                        disabled={isScanning}
                        className="flex items-center gap-1 text-2xs text-text-muted hover:text-text-muted transition-colors disabled:opacity-50"
                        title="Rescan project files"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isScanning ? 'animate-spin' : ''}`} />
                        {isScanning ? 'Scanning' : 'Rescan'}
                      </button>
                    </div>

                    {scanError && (
                      <p className="text-xs text-red-400/80 mb-1.5">{scanError}</p>
                    )}

                    {dynamicContext ? (
                      <div className="space-y-1">
                        <ScanRow
                          label="C++ Classes"
                          value={`${dynamicContext.classes.length} found`}
                          ok={dynamicContext.classes.length > 0}
                        />
                        <ScanRow
                          label="Source Files"
                          value={`${dynamicContext.sourceFileCount}`}
                          ok={dynamicContext.sourceFileCount > 0}
                        />
                        <ScanRow
                          label="Build Deps"
                          value={`${dynamicContext.buildDependencies.length} modules`}
                          ok={dynamicContext.buildDependencies.length > 0}
                        />
                        <ScanRow
                          label="Plugins"
                          value={`${dynamicContext.plugins.length} detected`}
                          ok
                        />
                        <p className="text-2xs text-text-muted mt-1.5">
                          Scanned {formatTimeAgo(dynamicContext.scannedAt)}
                        </p>
                      </div>
                    ) : !isScanning ? (
                      <p className="text-xs text-text-muted">
                        Not yet scanned. Will scan before next CLI prompt.
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        <div className="w-3 h-3 border border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-text-muted">Scanning project files...</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!staticHealthy && (
                <button
                  onClick={handleClick}
                  className="mt-2.5 w-full text-xs font-medium text-[#3b82f6] hover:text-[#60a5fa] transition-colors text-center py-1 rounded bg-surface-hover hover:bg-[#1e1e40]"
                >
                  Open Project Setup
                </button>
              )}

              {allHealthy && (
                <p className="mt-2 text-xs text-[#22c55e]/70 text-center">
                  All context fields configured
                </p>
              )}
            </div>

            {/* Tooltip arrow */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#161633] border-l border-t border-[#2a2a4a]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScanRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex-shrink-0 rounded-full"
        style={{
          width: 5,
          height: 5,
          backgroundColor: ok ? STATUS_SUCCESS : 'var(--text-muted)',
        }}
      />
      <span className="text-xs text-text-muted flex-shrink-0">{label}</span>
      <span className="text-xs text-text-muted truncate ml-auto">{value}</span>
    </div>
  );
}
