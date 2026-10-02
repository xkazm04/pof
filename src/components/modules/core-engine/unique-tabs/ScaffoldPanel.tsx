'use client';

import { Hammer, Loader2, RefreshCw } from 'lucide-react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_NEUTRAL,
  OPACITY_12, OPACITY_20, withOpacity,
} from '@/lib/chart-colors';
import type { SectionScaffold, SectionScaffoldView } from '@/components/modules/core-engine/unique-tabs/useSectionScaffold';

const ACCENT = MODULE_COLORS.core;

interface SectionRef { id: string; label: string }

function chipText(v: SectionScaffoldView): { text: string; color: string } | null {
  switch (v.state) {
    case 'no-prompt': return null;
    case 'unverifiable': return { text: 'no class to verify', color: STATUS_NEUTRAL };
    case 'unscanned': return { text: 'project not scanned', color: STATUS_NEUTRAL };
    case 'scaffolded': return { text: `${v.present.length}/${v.present.length} in project`, color: STATUS_SUCCESS };
    case 'partial': return { text: `missing ${v.missing.join(', ')}`, color: STATUS_WARNING };
    case 'absent': return { text: v.reason ?? 'not in project', color: v.reason ? STATUS_WARNING : STATUS_NEUTRAL };
  }
}

/** Non-interactive project-state chip for a Feature Map card (the card itself is a button). */
export function ScaffoldChip({ view, running }: { view: SectionScaffoldView; running: boolean }) {
  const chip = running ? { text: 'scaffolding…', color: ACCENT } : chipText(view);
  if (!chip) return null;
  return (
    <span
      data-scaffold-state={view.state}
      className="block text-xs font-mono truncate"
      title={chip.text}
      style={{ color: chip.color }}
    >
      {chip.text}
    </span>
  );
}

/**
 * Under the grid: which of the active group's sections are missing from the project,
 * a Scaffold button per section and "Scaffold next" for the module's first missing one.
 * Every run is a click; the state shown comes from the project scan.
 */
export function ScaffoldPanel({ scaffold: s, sections }: { scaffold: SectionScaffold; sections: SectionRef[] }) {
  if (!s.hasProject) {
    return <p className="text-xs font-mono text-text-muted">Open a UE project to see which sections exist in it.</p>;
  }
  if (!s.scanned) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs font-mono text-text-muted">
        <span>Scan the project to see which sections exist in it.</span>
        <PanelBtn label="Scan project" onClick={s.scan} disabled={s.isScanning} icon={s.isScanning ? 'busy' : 'scan'} />
      </div>
    );
  }
  const labelOf = (id: string) => sections.find((x) => x.id === id)?.label ?? id;
  const next = s.queue[0];
  const rows = sections.flatMap((sec) => {
    const view = s.stateOf(sec.id);
    return view.state === 'absent' || view.state === 'partial'
      ? [{ sec, missing: view.missing.join(', '), reason: view.reason }]
      : [];
  });

  return (
    <div data-scaffold-panel className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
          In your project
        </span>
        <div className="flex items-center gap-1.5">
          <PanelBtn label="Rescan" onClick={s.scan} disabled={s.isScanning || s.busy} icon={s.isScanning ? 'busy' : 'scan'} />
          {next && (
            <PanelBtn
              label={`Scaffold next: ${labelOf(next)}`}
              onClick={() => s.scaffold(next)}
              disabled={s.busy}
              icon={s.running === next ? 'busy' : 'build'}
            />
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs font-mono text-text-muted">Every verifiable section in this group is in the project.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ sec, missing, reason }) => (
            <li key={sec.id} className="flex items-center justify-between gap-2 text-xs font-mono">
              <span className="truncate text-text-muted" title={missing}>
                {`${sec.label}: missing ${missing}${reason ? ` (${reason})` : ''}`}
              </span>
              <PanelBtn
                label={`Scaffold ${sec.label}`}
                onClick={() => s.scaffold(sec.id)}
                disabled={s.busy}
                icon={s.running === sec.id ? 'busy' : 'build'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelBtn({ label, onClick, disabled, icon }: { label: string; onClick: () => void; disabled?: boolean; icon: 'busy' | 'scan' | 'build' }) {
  const Icon = icon === 'busy' ? Loader2 : icon === 'scan' ? RefreshCw : Hammer;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: withOpacity(ACCENT, disabled ? OPACITY_12 : OPACITY_20), color: ACCENT }}
    >
      <Icon className={`w-3 h-3${icon === 'busy' ? ' animate-spin' : ''}`} aria-hidden="true" />
      {label}
    </button>
  );
}
