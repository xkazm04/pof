import type { WiringAsset } from '@/lib/feature-definitions';

/**
 * A known per-artifact wiring hint, rendered as a row in the
 * "Known wiring for this task" table.
 */
export interface WiringRequirement {
  artifact: string;
  grantedBy?: string;
  activatedBy?: string;
  dependencies?: string[];
  verification?: string;
}

export interface WiringRequirementsOptions {
  /** Known per-artifact wiring hints (rendered as a table when non-empty). */
  reqs?: WiringRequirement[];
  /** The module's editor-authored dependencies (from MODULE_WIRING_ASSETS). */
  moduleAssets?: WiringAsset[];
}

/**
 * Build the "## Wiring Requirements" markdown block. Always emits the four
 * wiring sub-prompts (granting / activation / dependencies / verification) plus
 * the `wiring` output-field instruction. When `moduleAssets` is non-empty, lists
 * the module's known editor-authored dependencies; when `reqs` is non-empty,
 * renders them as a table. Single source of truth for both the dispatch path
 * (buildTaskPrompt) and PromptBuilder.withWiringRequirements().
 */
export function formatWiringRequirements(opts: WiringRequirementsOptions = {}): string {
  const { reqs = [], moduleAssets = [] } = opts;
  const lines: string[] = ['## Wiring Requirements'];
  lines.push('For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":');
  lines.push('- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).');
  lines.push('- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).');
  lines.push('- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.');
  lines.push('- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).');
  lines.push('In your output, include a `wiring` field for each generated artifact summarizing the four points above.');

  if (moduleAssets.length > 0) {
    lines.push('');
    lines.push('Known editor-authored dependencies for this module (cannot be created from code — declare how each is provided):');
    for (const a of moduleAssets) {
      lines.push(`- ${a.name} (${a.kind}): ${a.note}`);
    }
  }

  if (reqs.length > 0) {
    lines.push('');
    lines.push('Known wiring for this task:');
    lines.push('| Artifact | Granted by | Activated by | Dependencies | Verify |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const r of reqs) {
      const deps = (r.dependencies ?? []).join(', ') || '—';
      lines.push(`| ${r.artifact} | ${r.grantedBy ?? '—'} | ${r.activatedBy ?? '—'} | ${deps} | ${r.verification ?? '—'} |`);
    }
  }

  return lines.join('\n');
}
