'use client';

import { ClipboardCheck, Wrench, CheckCircle2, XCircle, Hammer } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SetupStatusPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.setup;

const CHECKLIST_ITEMS = [
  { id: 'engine', label: 'Unreal Engine 5.7', detail: 'C:\\Program Files\\Epic Games\\UE_5.7', ok: true },
  { id: 'vs', label: 'Visual Studio 2022', detail: 'v17.12 with C++ workload', ok: true },
  { id: 'msvc', label: 'MSVC Toolchain', detail: 'v14.44.35207', ok: true },
  { id: 'wsdk', label: 'Windows SDK', detail: '10.0.26100', ok: true },
  { id: 'dotnet', label: '.NET 8.0 Runtime', detail: '8.0.11', ok: true },
  { id: 'project', label: 'UProject File', detail: 'PoF-Dzin-Full.uproject', ok: true },
  { id: 'source', label: 'Source Directory', detail: 'Source/PoF-Dzin-Full/', ok: true },
  { id: 'build', label: 'Initial Build', detail: 'Development Win64', ok: false },
] as const;

const BUILD_VERIFY = [
  { label: 'Compile C++', status: 'pass' as const, duration: '42s' },
  { label: 'Link Editor', status: 'pass' as const, duration: '8s' },
  { label: 'Cook Content', status: 'warn' as const, duration: '2m 14s' },
  { label: 'Run Automation Tests', status: 'fail' as const, duration: '18s' },
] as const;

function verifyColor(status: string): string {
  if (status === 'pass') return STATUS_SUCCESS;
  if (status === 'warn') return STATUS_WARNING;
  return STATUS_ERROR;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function StatusMicro() {
  const okCount = CHECKLIST_ITEMS.filter((c) => c.ok).length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <ClipboardCheck className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{okCount}/{CHECKLIST_ITEMS.length} ok</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function StatusCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Status Checklist</span>
        <span className="font-mono text-text">{CHECKLIST_ITEMS.filter((c) => c.ok).length}/{CHECKLIST_ITEMS.length}</span>
      </div>
      {CHECKLIST_ITEMS.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.ok ? STATUS_SUCCESS : STATUS_ERROR }}
          />
          <span className="text-text-muted flex-1 truncate">{item.label}</span>
          {item.ok
            ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
            : <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />}
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function StatusFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Environment checklist and build verification — confirms toolchain, SDK, and project structure are ready.
      </SurfaceCard>

      {/* Checklist */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Wrench} label="Environment Checklist" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {CHECKLIST_ITEMS.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2 text-xs"
            >
              {item.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
                : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />}
              <span className="text-text font-medium flex-1 truncate">{item.label}</span>
              <span className="text-text-muted text-2xs truncate max-w-[180px]">{item.detail}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Build Verify */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Hammer} label="Build Verification" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {BUILD_VERIFY.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-text font-medium">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-2xs">{step.duration}</span>
                  <span
                    className="text-2xs px-1.5 py-0.5 rounded uppercase"
                    style={{ backgroundColor: `${verifyColor(step.status)}${OPACITY_15}`, color: verifyColor(step.status) }}
                  >
                    {step.status}
                  </span>
                </div>
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
export function SetupStatusPanel({ featureMap, defs }: SetupStatusPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Setup Status" icon={<ClipboardCheck className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <StatusMicro />}
          {density === 'compact' && <StatusCompact />}
          {density === 'full' && <StatusFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
