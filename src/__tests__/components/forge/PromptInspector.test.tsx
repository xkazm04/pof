import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PromptInspector } from '@/components/modules/core-engine/sub_ability/forge/PromptInspector';
import { auditPromptString, summarizeAudit } from '@/lib/prompts/prompt-builder';

afterEach(cleanup);

const FULL_PROMPT = `You are an expert UE5 C++ developer.

## Task: Generate a GameplayAbility Class

Do the thing.

## Existing Project Context

UE Project at C:/foo

## UE5 Best Practices
- one
- two

## Output Format

Return ONLY a JSON object.

## Success Criteria
1. compiles
2. works
`;

const MINIMAL_PROMPT = `## Task: Generate a thing
Description.
`;

describe('auditPromptString', () => {
  it('detects every canonical section in a fully-populated prompt', () => {
    const rows = auditPromptString(FULL_PROMPT);
    const present = rows.filter((r) => r.present).map((r) => r.section).sort();
    expect(present).toContain('projectContext');
    expect(present).toContain('taskInstructions');
    expect(present).toContain('domainContext'); // "You are an expert"
    expect(present).toContain('bestPractices');
    expect(present).toContain('outputSchema');
    expect(present).toContain('successCriteria');
  });

  it('flags taskInstructions as required and present, projectContext as required and missing in a minimal prompt', () => {
    const rows = auditPromptString(MINIMAL_PROMPT);
    const proj = rows.find((r) => r.section === 'projectContext')!;
    const task = rows.find((r) => r.section === 'taskInstructions')!;
    expect(proj.required).toBe(true);
    expect(proj.present).toBe(false);
    expect(task.required).toBe(true);
    expect(task.present).toBe(true);
  });
});

describe('summarizeAudit', () => {
  it('reports the count + "all required" when nothing required is missing', () => {
    const summary = summarizeAudit(auditPromptString(FULL_PROMPT));
    expect(summary).toMatch(/\d+ of 7 sections populated/);
    expect(summary).toContain('all required');
  });

  it('names missing required sections', () => {
    const summary = summarizeAudit(auditPromptString(MINIMAL_PROMPT));
    expect(summary).toContain('missing required');
    expect(summary).toContain('Project Context');
  });
});

describe('PromptInspector', () => {
  it('returns nothing when no prompt is provided', () => {
    const { container } = render(<PromptInspector prompt={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one chip per canonical section with a state attribute reflecting presence', () => {
    const { container } = render(<PromptInspector prompt={FULL_PROMPT} />);
    const chips = Array.from(container.querySelectorAll('[data-section]'));
    // 7 sections total — every chip should appear once.
    expect(chips).toHaveLength(7);
    const taskChip = chips.find((c) => c.getAttribute('data-section') === 'taskInstructions')!;
    expect(taskChip.getAttribute('data-state')).toBe('present');
  });

  it('marks missing-required sections with the dedicated state so amber can be applied', () => {
    const { container } = render(<PromptInspector prompt={MINIMAL_PROMPT} />);
    const projChip = container.querySelector('[data-section="projectContext"]')!;
    expect(projChip.getAttribute('data-state')).toBe('missing-required');
    const wiringChip = container.querySelector('[data-section="wiringRequirements"]')!;
    expect(wiringChip.getAttribute('data-state')).toBe('missing-optional');
  });

  it('toggles the composed prompt body open and closed', () => {
    const { getByRole, container } = render(<PromptInspector prompt={MINIMAL_PROMPT} />);
    const button = getByRole('button', { name: /prompt inspector/i });
    // Initially collapsed — the controlled body either is absent or has no children.
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    // The composed prompt text appears verbatim once expanded.
    expect(container.textContent).toContain('## Task: Generate a thing');
  });
});
