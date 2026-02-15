import type { MutationType, VariantStyle } from '@/types/prompt-evolution';

// ── Prompt mutation strategies ──────────────────────────────────────────────
// These are heuristic text transforms applied client-side for instant feedback.
// Complex mutations can also be refined through Claude CLI.

interface MutationResult {
  prompt: string;
  style: VariantStyle;
  label: string;
}

/** Apply a mutation to a prompt, returning the transformed text + metadata. */
export function applyMutation(prompt: string, mutation: MutationType): MutationResult {
  switch (mutation) {
    case 'imperative-rewrite':
      return {
        prompt: toImperative(prompt),
        style: 'imperative',
        label: 'Imperative rewrite',
      };
    case 'add-examples':
      return {
        prompt: addExampleHints(prompt),
        style: 'example-rich',
        label: 'With code examples',
      };
    case 'step-by-step':
      return {
        prompt: toStepByStep(prompt),
        style: 'step-by-step',
        label: 'Step-by-step breakdown',
      };
    case 'holistic':
      return {
        prompt: toHolistic(prompt),
        style: 'holistic',
        label: 'Holistic single-pass',
      };
    case 'add-context-hint':
      return {
        prompt: addContextHint(prompt),
        style: 'descriptive',
        label: 'With context hint',
      };
    case 'shorten':
      return {
        prompt: shorten(prompt),
        style: 'minimal',
        label: 'Shortened',
      };
    case 'add-verification':
      return {
        prompt: addVerification(prompt),
        style: 'imperative',
        label: 'With build verification',
      };
    case 'swap-ordering':
      return {
        prompt: swapOrdering(prompt),
        style: 'step-by-step',
        label: 'Reordered steps',
      };
  }
}

/** All available mutation types for UI display. */
export const MUTATION_OPTIONS: { type: MutationType; label: string; description: string }[] = [
  { type: 'imperative-rewrite', label: 'Imperative', description: 'Rewrite with direct commands ("You must create...")' },
  { type: 'add-examples', label: 'Add Examples', description: 'Inject inline code example hints' },
  { type: 'step-by-step', label: 'Step-by-Step', description: 'Break into numbered sequential steps' },
  { type: 'holistic', label: 'Holistic', description: 'Merge into a single comprehensive paragraph' },
  { type: 'add-context-hint', label: 'Context Hint', description: 'Prepend project context reminder' },
  { type: 'shorten', label: 'Shorten', description: 'Remove redundant detail and filler' },
  { type: 'add-verification', label: 'Add Verification', description: 'Append build/compile verification step' },
  { type: 'swap-ordering', label: 'Swap Order', description: 'Reorder numbered steps/files' },
];

// ── Individual mutation implementations ─────────────────────────────────────

function toImperative(prompt: string): string {
  // Prefix with strong directive if not already imperative
  const lines = prompt.split('\n');
  const first = lines[0];
  if (/^(create|implement|build|add|generate|write|set up)/i.test(first)) {
    // Already imperative — strengthen it
    return `You MUST complete this task fully. Do not ask for confirmation.\n\n${prompt}`;
  }
  return `You MUST complete the following task immediately without asking questions.\n\n${prompt}`;
}

function addExampleHints(prompt: string): string {
  const suffix = `\n\nFor each file you create, include a brief inline comment showing an example usage pattern. For example:
// Usage: auto component = NewObject<UMyComponent>(this); component->Initialize();`;
  return prompt + suffix;
}

function toStepByStep(prompt: string): string {
  // If prompt already has numbered steps, leave it
  if (/^\d+\.\s/m.test(prompt)) return prompt;

  // Split on double newlines and number the paragraphs
  const blocks = prompt.split(/\n\n+/).filter(Boolean);
  if (blocks.length <= 1) return prompt;

  const numbered = blocks.map((b, i) => `${i + 1}. ${b.trim()}`).join('\n\n');
  return `Complete the following steps in order:\n\n${numbered}`;
}

function toHolistic(prompt: string): string {
  // Remove numbered prefixes and merge into flowing text
  const cleaned = prompt
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
  return `In a single pass, accomplish the following:\n\n${cleaned}`;
}

function addContextHint(prompt: string): string {
  return `IMPORTANT: Use the project context (module name, API macro, build command, project path) provided in the header above. Do not hardcode paths or module names.\n\n${prompt}`;
}

function shorten(prompt: string): string {
  // Remove markdown formatting, redundant whitespace, and parenthetical asides
  return prompt
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // Remove bold
    .replace(/\(.*?\)/g, '')                   // Remove parentheticals
    .replace(/\s*—\s*[^.\n]*/g, '')           // Remove em-dash asides
    .replace(/\n{3,}/g, '\n\n')               // Collapse blank lines
    .replace(/^\s*[-*]\s+/gm, '- ')           // Normalize bullets
    .trim();
}

function addVerification(prompt: string): string {
  const verifyLine = '\n\nAfter creating all files, verify the build compiles successfully. Fix any errors before finishing.';
  if (prompt.toLowerCase().includes('verify') && prompt.toLowerCase().includes('build')) {
    return prompt; // Already has verification
  }
  return prompt + verifyLine;
}

function swapOrdering(prompt: string): string {
  // Find numbered sections and reverse their order
  const numbered = prompt.match(/^\d+\.\s+[\s\S]*?(?=^\d+\.\s|$)/gm);
  if (!numbered || numbered.length <= 1) return prompt;

  const reversed = [...numbered].reverse().map((block, i) => {
    return block.replace(/^\d+\./, `${i + 1}.`);
  });

  let result = prompt;
  for (let i = 0; i < numbered.length; i++) {
    result = result.replace(numbered[i], `__SWAP_${i}__`);
  }
  for (let i = 0; i < reversed.length; i++) {
    result = result.replace(`__SWAP_${i}__`, reversed[i]);
  }
  return result;
}

// ── Style classifier ────────────────────────────────────────────────────────

/** Classify an existing prompt's style. */
export function classifyStyle(prompt: string): VariantStyle {
  const lower = prompt.toLowerCase();
  const hasNumberedSteps = /^\d+\.\s/m.test(prompt);
  const hasExamples = /example|usage:|e\.g\.|for instance/i.test(prompt);
  const hasImperative = /^(you must|create|implement|build|add|generate|write)/im.test(prompt);
  const isShort = prompt.length < 300;

  if (hasNumberedSteps) return 'step-by-step';
  if (hasExamples) return 'example-rich';
  if (isShort && !hasImperative) return 'minimal';
  if (hasImperative) return 'imperative';
  if (lower.includes('in a single pass') || lower.includes('holistic')) return 'holistic';
  return 'descriptive';
}
