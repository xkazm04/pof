/**
 * Derives the single "do this next" action for the Project Setup module from
 * the live scan state. One calm, derived step removes the decision paralysis a
 * non-technical user faces when shown four equally-weighted panels at once.
 *
 * Priority: missing tools must be installed before anything else → a project
 * must exist before it can be built → otherwise the steady-state step is to
 * compile and verify the toolchain.
 */

export type NextStepId = 'install-tools' | 'create-project' | 'build-verify';

export interface NextStep {
  id: NextStepId;
  /** Short, plain heading for the suggested action. */
  title: string;
  /** One-line, jargon-light explanation of why this is next. */
  explanation: string;
  /** Label for the single primary call-to-action button. */
  ctaLabel: string;
}

export interface NextStepInput {
  /** Count of required tools (engine + SDK) still missing from the scan. */
  missingToolCount: number;
  /** Whether a `.uproject` was found at the configured path. */
  hasProject: boolean;
}

export function deriveNextStep({ missingToolCount, hasProject }: NextStepInput): NextStep {
  if (missingToolCount > 0) {
    const isSingular = missingToolCount === 1;
    return {
      id: 'install-tools',
      title: 'Install required tools',
      explanation: `${missingToolCount} required build tool${isSingular ? ' is' : 's are'} missing — let Claude install ${isSingular ? 'it' : 'them'} automatically before you continue.`,
      ctaLabel: 'Install Tools',
    };
  }

  if (!hasProject) {
    return {
      id: 'create-project',
      title: 'Create your project',
      explanation: 'No Unreal project exists at this path yet — scaffold a fresh C++ project to get started.',
      ctaLabel: 'Create Project',
    };
  }

  return {
    id: 'build-verify',
    title: 'Build & verify',
    explanation: 'Everything is in place — compile the project once to confirm the toolchain is wired correctly.',
    ctaLabel: 'Build & Verify',
  };
}
