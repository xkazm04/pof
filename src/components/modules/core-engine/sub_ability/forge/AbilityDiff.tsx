'use client';

import { useMemo } from 'react';
import {
  GitCompareArrows, ArrowRight, Plus, Minus, Gauge, Shield, Code2,
} from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_WARNING, ACCENT_CYAN, ACCENT_RED, ACCENT_GREEN,
  OPACITY_8, withOpacity,
} from '@/lib/chart-colors';
import { groupDeltas } from '@/lib/genome/genome-diff';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { ACCENT } from './constants';
import {
  diffAbilityStats, diffAbilityTags, diffLines,
  abilityHasChanges,
} from './ability-diff';
import { CodeDiff } from './CodeDiff';

/* ── Refinement diff: what the last follow-up changed ────────────────── *
 * Side-by-side preview of the stat / tag / code deltas between the prior
 * ability and the refined one, so a refine is auditable rather than an
 * opaque swap.
 * ────────────────────────────────────────────────────────────────────── */

const DIRECTION_COLOR = {
  up: ACCENT_EMERALD,
  down: STATUS_WARNING,
  neutral: ACCENT_CYAN,
} as const;

export function AbilityDiff({ prior, next, instruction }: {
  prior: ForgedAbility;
  next: ForgedAbility;
  instruction: string;
}) {
  const statGroups = useMemo(() => groupDeltas(diffAbilityStats(prior, next)), [prior, next]);
  const tagChanges = useMemo(() => diffAbilityTags(prior, next), [prior, next]);
  const headerDiff = useMemo(() => diffLines(prior.headerCode, next.headerCode), [prior, next]);
  const cppDiff = useMemo(() => diffLines(prior.cppCode, next.cppCode), [prior, next]);

  const headerChanged = prior.headerCode !== next.headerCode;
  const cppChanged = prior.cppCode !== next.cppCode;
  const anyChange = abilityHasChanges(prior, next);

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <GitCompareArrows size={15} style={{ color: ACCENT }} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-200">What changed</div>
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Refined <span className="text-zinc-400">{prior.displayName}</span> with
            {' '}“<span className="text-zinc-300">{instruction}</span>”
          </div>
        </div>
      </div>

      {!anyChange && (
        <p className="text-xs font-mono text-zinc-500">
          The refine returned an identical ability — no stat, tag, or code changes detected.
        </p>
      )}

      {/* Stats */}
      {statGroups.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Gauge} label="Stats" color={ACCENT_RED} />
          {statGroups.map(({ group, items }) => (
            <div key={group} className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-600">{group}</div>
              {items.map((d) => (
                <div key={`${group}-${d.label}`} className="flex items-center gap-2 text-xs font-mono pl-1">
                  <span className="flex-1 text-zinc-500 truncate">{d.label}</span>
                  <span className="text-zinc-600">{d.from}</span>
                  <ArrowRight size={11} className="shrink-0" style={{ color: DIRECTION_COLOR[d.direction] }} />
                  <span className="font-semibold" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.to}</span>
                  {d.delta && (
                    <span className="w-16 text-right tabular-nums" style={{ color: DIRECTION_COLOR[d.direction] }}>
                      {d.delta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {tagChanges.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Shield} label="Tags" color={ACCENT_GREEN} />
          {tagChanges.map((tc) => (
            <div key={tc.group} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono uppercase tracking-[0.15em] text-zinc-600 w-24 shrink-0">{tc.group}</span>
              {tc.removed.map((t) => (
                <span
                  key={`r-${t}`}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono line-through"
                  style={{ color: ACCENT_RED, background: withOpacity(ACCENT_RED, OPACITY_8) }}
                >
                  <Minus size={10} /> {t}
                </span>
              ))}
              {tc.added.map((t) => (
                <span
                  key={`a-${t}`}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono"
                  style={{ color: ACCENT_GREEN, background: withOpacity(ACCENT_GREEN, OPACITY_8) }}
                >
                  <Plus size={10} /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Code */}
      {(headerChanged || cppChanged) && (
        <div className="space-y-2">
          <SectionHeader icon={Code2} label="Code" color={ACCENT} />
          {headerChanged && (
            <CodeDiff filename={`${next.className}.h`} lines={headerDiff} />
          )}
          {cppChanged && (
            <CodeDiff filename={`${next.className}.cpp`} lines={cppDiff} />
          )}
        </div>
      )}
    </BlueprintPanel>
  );
}
