'use client';

import { MicroLabel } from '@/components/ui/MicroLabel';
import { THEME_DIRECTIVE_MAX } from './controlGuards';
import type { StartFormValues } from './types';

const INPUT =
  'w-full text-xs font-mono rounded border border-border/60 bg-surface-deep/60 text-text px-2 py-1 focus-ring';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

function Field({ id, label, value, onChange, placeholder, hint, required }: FieldProps) {
  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="flex items-baseline gap-1">
        <MicroLabel as="span" uppercase>{label}</MicroLabel>
        {required && <MicroLabel as="span" tone="muted" aria-hidden>required</MicroLabel>}
      </span>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
      {hint && <MicroLabel as="span" tone="muted">{hint}</MicroLabel>}
    </label>
  );
}

interface StartFormProps {
  values: StartFormValues;
  onChange: (patch: Partial<StartFormValues>) => void;
  /** Prefill project identity from the currently-open PoF project. */
  onUseCurrentProject: () => void;
  /** Disabled while a start/pause/resume POST is in flight. */
  disabled?: boolean;
}

/**
 * The start-run form. Every field maps 1:1 onto a `POST /api/harness` start key
 * that the route already accepts — the panel adds no engine capability, it just
 * makes the existing body reachable without hand-writing curl.
 */
export function StartForm({ values, onChange, onUseCurrentProject, disabled }: StartFormProps) {
  return (
    <fieldset disabled={disabled} className="space-y-3 border-0 p-0 m-0 min-w-0">
      <legend className="sr-only">Harness run configuration</legend>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field
          id="harness-project-path" label="Project path" required
          value={values.projectPath} onChange={(v) => onChange({ projectPath: v })}
          placeholder="C:\Users\me\Documents\Unreal Projects\PoF"
        />
        <Field
          id="harness-project-name" label="Project name" required
          value={values.projectName} onChange={(v) => onChange({ projectName: v })}
          placeholder="PoF"
        />
        <Field
          id="harness-ue-version" label="UE version" required
          value={values.ueVersion} onChange={(v) => onChange({ ueVersion: v })}
          placeholder="5.8"
        />
      </div>

      <button
        type="button"
        onClick={onUseCurrentProject}
        className="text-xs text-text-muted hover:text-text underline underline-offset-2 focus-ring rounded"
      >
        Use the currently-open PoF project
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field
          id="harness-state-path" label="State path"
          value={values.statePath} onChange={(v) => onChange({ statePath: v })}
          placeholder="<projectPath>/.harness"
          hint="Same path resumes the same run; also what a post-restart resume rehydrates from."
        />
        <Field
          id="harness-max-iterations" label="Max iterations"
          value={values.maxIterations} onChange={(v) => onChange({ maxIterations: v })}
          placeholder="auto"
        />
        <Field
          id="harness-target-pass-rate" label="Target pass rate"
          value={values.targetPassRate} onChange={(v) => onChange({ targetPassRate: v })}
          placeholder="90"
          hint="A 0–1 fraction or a 0–100 percent — the route normalizes both."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          id="harness-budget" label="Budget (USD)"
          value={values.budgetUsd} onChange={(v) => onChange({ budgetUsd: v })}
          placeholder="25"
          hint="Blank keeps the route's default cap; tick Uncapped to opt out entirely."
        />
        <Field
          id="harness-scenario" label="Scenario"
          value={values.scenario} onChange={(v) => onChange({ scenario: v })}
          placeholder="(auto-generated plan)"
          hint="A curated area set. An unknown name is refused by the API, which names the valid ones."
        />
      </div>

      <label htmlFor="harness-theme" className="block space-y-1">
        <span className="flex items-baseline gap-1">
          <MicroLabel as="span" uppercase>Theme directive</MicroLabel>
          <MicroLabel as="span" tone="muted">
            {values.themeDirective.length}/{THEME_DIRECTIVE_MAX}
          </MicroLabel>
        </span>
        <textarea
          id="harness-theme"
          rows={2}
          value={values.themeDirective}
          onChange={(e) => onChange({ themeDirective: e.target.value })}
          placeholder="Creative direction applied to every executor prompt"
          className={INPUT}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="harness-checkpoint" className="flex items-center gap-1.5 text-xs text-text-muted">
          <input
            id="harness-checkpoint" type="checkbox" className="focus-ring"
            checked={values.checkpoint} onChange={(e) => onChange({ checkpoint: e.target.checked })}
          />
          Git-checkpoint each area <span className="text-text-subtle">(forces one session at a time)</span>
        </label>
        <label htmlFor="harness-unlimited" className="flex items-center gap-1.5 text-xs text-text-muted">
          <input
            id="harness-unlimited" type="checkbox" className="focus-ring"
            checked={values.unlimited} onChange={(e) => onChange({ unlimited: e.target.checked })}
          />
          Uncapped spend <span className="text-text-subtle">(no budget ceiling at all)</span>
        </label>
      </div>
    </fieldset>
  );
}
