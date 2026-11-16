/**
 * PromptBuilder — composable builder with enforced section architecture.
 *
 * Every prompt in the system has up to 6 sections assembled in a fixed order:
 *   1. Project Context — engine version, paths, build command, project state
 *   2. Domain Context — module-specific role description
 *   3. Task Instructions — what the user/system is asking Claude to do
 *   4. UE5 Best Practices — domain-specific tips and gotchas
 *   5. Output Schema — expected output format (callback markers, JSON shape)
 *   6. Success Criteria — what "done" looks like
 *
 * Sections 1 and 3 are required; build() throws if they're missing.
 * The builder concatenates sections with consistent `## Section` headers.
 */

import {
  buildProjectContextHeader,
  type ProjectContext,
} from '@/lib/prompt-context';
import type { ErrorContextEntry } from '@/types/error-memory';
import type { PromptKind } from '@/lib/knowledge/types';
import { formatWiringRequirements, type WiringRequirement } from '@/lib/knowledge/wiring-requirements';

export type { WiringRequirement };

// ── Section types ───────────────────────────────────────────────────────────

export interface PromptSections {
  /** Section 1 — always required. Built from ProjectContext. */
  projectContext: string;
  /** Section 2 — module-specific role context. */
  domainContext: string | null;
  /** Section 3 — always required. The actual task. */
  taskInstructions: string;
  /** Section 3.25 — the catalog entity's serialized spec (rendered by build() right after the task). */
  assetSpec: string | null;
  /** Section 3.5 — how each generated artifact must be wired to run. */
  wiringRequirements: string | null;
  /** Section 4 — UE5 best practices, tips, gotchas. */
  bestPractices: string | null;
  /** Section 5 — expected output format (callback, JSON array, etc.). */
  outputSchema: string | null;
  /** Section 6 — what "done" looks like. */
  successCriteria: string | null;
}

// ── Builder ─────────────────────────────────────────────────────────────────

export class PromptBuilder {
  private _projectContext: string | null = null;
  private _qualityPack: string | null = null;
  private _domainContext: string | null = null;
  private _taskInstructions: string | null = null;
  private _assetSpec: string | null = null;
  private _wiringRequirements: string | null = null;
  private _bestPractices: string | null = null;
  private _outputSchema: string | null = null;
  private _successCriteria: string | null = null;
  /** The criteria `_successCriteria` was rendered from, so an append never re-parses it. */
  private _successCriteriaItems: string[] = [];

  /**
   * Set the project context section using the shared header builder.
   * This is the standard path — uses `buildProjectContextHeader()`.
   */
  withProjectContext(
    ctx: ProjectContext,
    opts?: {
      includeBuildCommand?: boolean;
      includeRules?: boolean;
      extraRules?: string[];
      errorMemory?: ErrorContextEntry[];
      /** The kind of prompt — routes UE gotchas + tripwire (default 'ue-cpp' in the UE branch). */
      promptKind?: PromptKind;
      /** Module id, so gotchas + knowledge tips are scoped to this module's domains. */
      module?: string;
      /** Known-asset domains to inject (e.g. ['character','animation']). */
      knownAssetDomains?: string[];
    },
  ): this {
    this._projectContext = buildProjectContextHeader(ctx, opts);
    return this;
  }

  /**
   * Set a raw project context string (for pre-built headers).
   */
  withRawProjectContext(header: string): this {
    this._projectContext = header;
    return this;
  }

  /**
   * Set the quality-pack framing (WS1) — senior-discipline role + the judge's own
   * craft dimensions + hard constraints. Rendered once, immediately after the
   * project context, so production aims at the bar the judge enforces. Pass the
   * pre-built pack string (from `qualityPack()`); an empty string is a no-op so
   * callers can gate it per step without branching.
   */
  withQualityPack(pack: string): this {
    if (pack) this._qualityPack = pack;
    return this;
  }

  /**
   * Set the domain context section — the module-specific role description.
   */
  withDomainContext(context: string): this {
    this._domainContext = context;
    return this;
  }

  /**
   * Set the task instructions section — the core task.
   * Can be a simple string or a multi-part task with title + body.
   */
  withTask(title: string, body: string): this {
    this._taskInstructions = `## Task: ${title}\n\n${body}`;
    return this;
  }

  /**
   * Set a raw task instructions string (for complex pre-formatted tasks).
   */
  withRawTask(instructions: string): this {
    this._taskInstructions = instructions;
    return this;
  }

  /**
   * Set the Asset Specification section — serializes a catalog entity's identity
   * and typed `data` payload so a generation recipe can turn it into UE. Rendered
   * immediately after Task Instructions.
   */
  withAssetSpec(entity: {
    id: string; name: string; categoryPath: string[]; tags: string[];
    data?: unknown;
  }): this {
    const lines = [
      '## Asset Specification',
      '',
      `- **id**: \`${entity.id}\``,
      `- **name**: ${entity.name}`,
      `- **category**: ${entity.categoryPath.join(' ▸ ')}`,
      `- **tags**: ${entity.tags.length ? entity.tags.join(', ') : '(none)'}`,
    ];
    if (entity.data && typeof entity.data === 'object' && Object.keys(entity.data).length > 0) {
      lines.push('', '```json', JSON.stringify(entity.data, null, 2), '```');
    }
    this._assetSpec = lines.join('\n');
    return this;
  }

  /**
   * Set the Wiring Requirements section. Always emits the four wiring sub-prompts
   * (granting, activation, dependencies, verification) plus the `wiring` output
   * field instruction — even with an empty array. When `reqs` is non-empty, the
   * known hints are rendered as a table.
   */
  withWiringRequirements(reqs: WiringRequirement[] = []): this {
    this._wiringRequirements = formatWiringRequirements({ reqs });
    return this;
  }

  /**
   * Set the UE5 best practices section.
   * Accepts an array of practice strings (rendered as bullet list).
   */
  withBestPractices(practices: string[]): this {
    if (practices.length === 0) return this;
    this._bestPractices =
      '## UE5 Best Practices\n' + practices.map((p) => `- ${p}`).join('\n');
    return this;
  }

  /**
   * Set a raw best practices section (for pre-formatted content).
   */
  withRawBestPractices(section: string): this {
    this._bestPractices = section;
    return this;
  }

  /**
   * Set the output schema section — describes expected output format.
   */
  withOutputSchema(schema: string): this {
    this._outputSchema = `## Output Format\n\n${schema}`;
    return this;
  }

  /**
   * Set a raw output schema string (e.g. callback section).
   */
  withRawOutputSchema(section: string): this {
    this._outputSchema = section;
    return this;
  }

  /**
   * Set the success criteria section — what "done" looks like.
   * Accepts an array of criteria (rendered as numbered list).
   */
  withSuccessCriteria(criteria: string[]): this {
    if (criteria.length === 0) return this;
    this._successCriteriaItems = [...criteria];
    this._successCriteria =
      '## Success Criteria\n' +
      criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    return this;
  }

  /**
   * APPEND success criteria, keeping anything already set.
   *
   * `withSuccessCriteria` REPLACES the section, which silently dropped criteria a
   * shared builder had already seeded (the catalog recipes seed each step with the
   * pipeline's authored acceptance criteria, then the `verify` phase adds its own
   * functional-test line). Use this whenever you are adding to, not defining, the
   * section.
   */
  addSuccessCriteria(criteria: string[]): this {
    if (criteria.length === 0) return this;
    // Append to the held ITEMS. Re-parsing the rendered section split a multi-line
    // criterion into several numbered ones. A raw/foreign section (none set through
    // withSuccessCriteria) has no items, so appending starts the list.
    return this.withSuccessCriteria([...this._successCriteriaItems, ...criteria]);
  }

  /**
   * Assemble the final prompt. Throws if required sections are missing.
   * Returns the sections object for inspection or the formatted string.
   */
  build(): string {
    if (!this._projectContext) {
      throw new Error('PromptBuilder: projectContext is required. Call withProjectContext() or withRawProjectContext().');
    }
    if (!this._taskInstructions) {
      throw new Error('PromptBuilder: taskInstructions is required. Call withTask() or withRawTask().');
    }

    const parts: string[] = [this._projectContext];

    if (this._qualityPack) {
      parts.push(this._qualityPack);
    }

    if (this._domainContext) {
      parts.push(`## Domain Context\n${this._domainContext}`);
    }

    parts.push(this._taskInstructions);

    if (this._assetSpec) {
      parts.push(this._assetSpec);
    }

    if (this._wiringRequirements) {
      parts.push(this._wiringRequirements);
    }

    if (this._bestPractices) {
      parts.push(this._bestPractices);
    }

    if (this._outputSchema) {
      parts.push(this._outputSchema);
    }

    if (this._successCriteria) {
      parts.push(this._successCriteria);
    }

    return parts.join('\n\n');
  }

  /**
   * Returns which sections are populated — useful for auditing prompt completeness.
   */
  audit(): { section: string; present: boolean }[] {
    const held: Record<PromptSectionKey, boolean> = {
      projectContext: !!this._projectContext,
      qualityPack: !!this._qualityPack,
      domainContext: !!this._domainContext,
      taskInstructions: !!this._taskInstructions,
      assetSpec: !!this._assetSpec,
      wiringRequirements: !!this._wiringRequirements,
      bestPractices: !!this._bestPractices,
      outputSchema: !!this._outputSchema,
      successCriteria: !!this._successCriteria,
    };
    return PROMPT_SECTIONS.map(({ section }) => ({ section, present: held[section] }));
  }
}

// ── Audit by string scan (for prompts not built through PromptBuilder) ──────

export type PromptSectionKey =
  | 'projectContext' | 'qualityPack' | 'domainContext' | 'taskInstructions' | 'assetSpec'
  | 'wiringRequirements' | 'bestPractices' | 'outputSchema' | 'successCriteria';

/**
 * The ONE list of sections `build()` can emit, in render order. `audit()` and
 * `auditPromptString` both derive from it, so a section added to `build()` cannot be
 * missing from one audit. `cue` is the heading/content marker the string scan uses;
 * hand-rolled prompts use varied phrasing, so cues are not exact section names.
 */
export const PROMPT_SECTIONS: ReadonlyArray<{
  section: PromptSectionKey; label: string; required: boolean; cue: RegExp;
}> = [
  { section: 'projectContext', label: 'Project Context', required: true,
    cue: /##\s*Project Context|UE Project|Engine Version|## Existing Project Context/i },
  { section: 'qualityPack', label: 'Quality Pack', required: false,
    cue: /professional bar is:|exact craft dimensions/i },
  { section: 'domainContext', label: 'Domain', required: false,
    cue: /##\s*Domain Context|You are an expert|You are a UE5/i },
  { section: 'taskInstructions', label: 'Task', required: true,
    cue: /##\s*Task:|##\s*Task /i },
  { section: 'assetSpec', label: 'Asset Spec', required: false,
    cue: /##\s*Asset Specification/i },
  { section: 'wiringRequirements', label: 'Wiring', required: false,
    cue: /##\s*Wiring Requirements|wiring sub-prompt/i },
  { section: 'bestPractices', label: 'Best Practices', required: false,
    cue: /##\s*UE5 Best Practices|##\s*Best Practices/i },
  { section: 'outputSchema', label: 'Output Schema', required: false,
    cue: /##\s*Output Format|##\s*Output Schema|Return ONLY a JSON|@@CALLBACK:/i },
  // Tied to the heading: a bare numbered list is just as likely to be the Instructions.
  { section: 'successCriteria', label: 'Success Criteria', required: false,
    cue: /##\s*Success Criteria|##\s*Rules\b/i },
];

/** A row in the audit table; `required` drives the "missing required" amber state. */
export interface PromptAuditRow {
  section: string;
  /** Friendly label for chip display, e.g. "Project Context". */
  label: string;
  present: boolean;
  /** Required sections (projectContext + taskInstructions) show amber when missing. */
  required: boolean;
}

/**
 * Detect which of the canonical sections a hand-rolled prompt covers, so the
 * Prompt Inspector can render the same audit-chip strip for prompts that don't
 * go through `PromptBuilder` (e.g. the raw section strings the cli-task-handlers
 * assemble). Matched by characteristic markers — heading text, header keys, or
 * content cues — not by exact section names, because hand-rolled prompts use
 * varied phrasing.
 */
export function auditPromptString(prompt: string): PromptAuditRow[] {
  return PROMPT_SECTIONS.map(({ section, label, required, cue }) => ({
    section, label, required, present: cue.test(prompt),
  }));
}

/** One-line plain-English summary of an audit, e.g. "5 of 7 sections populated · all required ✓". */
export function summarizeAudit(rows: PromptAuditRow[]): string {
  const total = rows.length;
  const present = rows.filter((r) => r.present).length;
  const missingRequired = rows.filter((r) => r.required && !r.present);
  const reqStatus = missingRequired.length === 0
    ? 'all required ✓'
    : `missing required: ${missingRequired.map((r) => r.label).join(', ')}`;
  return `${present} of ${total} sections populated · ${reqStatus}`;
}
