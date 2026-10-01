'use client';

import { X } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { lintAiCoverage } from '@/lib/bestiary/ai-coverage';
import type { SenseProfile } from '@/lib/bestiary/sense-profile';
import { ARCHETYPES, type ArchetypeConfig } from '../_shared/data';
import { BlueprintPanel } from '../../unique-tabs/_design';

const SOURCE_LABEL: Record<SenseProfile['source'], string> = {
  btSummary: 'declared in btSummary',
  'combat-definition': 'combat definition',
  default: 'generic',
};

interface BrainSubjectBarProps {
  /** The enemy whose brain the tab shows; null = generic view. */
  subject: ArchetypeConfig | null;
  profile: SenseProfile;
  onSubjectChange?: (id: string | null) => void;
  accent: string;
}

/**
 * 'Brains of: <enemy>' — which enemy the AI Logic tab is drawn for, a picker over
 * every archetype, and that enemy's behaviour coverage (lintAiCoverage over its
 * btSummary): what its brain covers, and the core behaviours it is missing.
 */
export function BrainSubjectBar({ subject, profile, onSubjectChange, accent }: BrainSubjectBarProps) {
  const findings = subject ? lintAiCoverage(subject.btSummary) : [];
  return (
    <BlueprintPanel color={accent} className="p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {subject ? (
          <h3 className="text-sm font-bold text-text">Brains of: <span style={{ color: subject.color }}>{subject.label}</span></h3>
        ) : (
          <p className="text-sm text-text-muted">Generic brain — expand an enemy in Archetypes, or pick one here.</p>
        )}
        <select aria-label="Brain subject" value={subject?.id ?? ''}
          onChange={e => onSubjectChange?.(e.target.value || null)}
          className="ml-auto max-w-[16rem] bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus-ring-inset transition-colors">
          <option value="">Generic (no enemy)</option>
          {ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {subject && (
          <button type="button" aria-label="Clear brain subject" onClick={() => onSubjectChange?.(null)}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover/40 focus-ring-inset cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {subject && (
        <>
          <p className="text-xs text-text-muted font-mono">
            Sense: <span className="text-text">{profile.detail}</span> ({SOURCE_LABEL[profile.source]})
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Behaviour coverage">
            {findings.map(f => {
              const color = f.covered ? STATUS_SUCCESS : STATUS_WARNING;
              return (
                <li key={f.behavior} data-testid={`coverage-${f.behavior}`} data-covered={String(f.covered)}
                  className="text-xs font-mono px-2 py-0.5 rounded border text-text"
                  style={{ backgroundColor: withOpacity(color, OPACITY_10), borderColor: withOpacity(color, OPACITY_30) }}>
                  {f.covered ? `${f.label}: ${f.detail} ✓` : `${f.label} — missing`}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BlueprintPanel>
  );
}
