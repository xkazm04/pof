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

// ── Section types ───────────────────────────────────────────────────────────

export interface PromptSections {
  /** Section 1 — always required. Built from ProjectContext. */
  projectContext: string;
  /** Section 2 — module-specific role context. */
  domainContext: string | null;
  /** Section 3 — always required. The actual task. */
  taskInstructions: string;
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
  private _domainContext: string | null = null;
  private _taskInstructions: string | null = null;
  private _bestPractices: string | null = null;
  private _outputSchema: string | null = null;
  private _successCriteria: string | null = null;

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
    this._successCriteria =
      '## Success Criteria\n' +
      criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    return this;
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

    if (this._domainContext) {
      parts.push(`## Domain Context\n${this._domainContext}`);
    }

    parts.push(this._taskInstructions);

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
    return [
      { section: 'projectContext', present: !!this._projectContext },
      { section: 'domainContext', present: !!this._domainContext },
      { section: 'taskInstructions', present: !!this._taskInstructions },
      { section: 'bestPractices', present: !!this._bestPractices },
      { section: 'outputSchema', present: !!this._outputSchema },
      { section: 'successCriteria', present: !!this._successCriteria },
    ];
  }
}
