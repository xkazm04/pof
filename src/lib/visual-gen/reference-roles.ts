/**
 * Reference-role scaffold + generation-prompting best practices for PoF's
 * asset/animation generation prompts.
 *
 * Encodes the "pro" workflow for consistent, controllable AI generation:
 * direct the shot/motion in 3D first (a grayscale "blocking" / play blast), then
 * drive the generator with REFERENCES TAGGED BY ROLE (motion source / visual
 * style / identity / multi-view master) so output stays on-model instead of
 * random. Consumed by visual-gen prompt builders; pairs with `prompt-chips.ts`.
 *
 * Sourced from "AI Is the New Render Engine — How PROs Actually Use It"
 * (Stefan 3D AI). The principle transfers from promo-render to any reference-
 * driven asset/character generation.
 */

/** The role a supplied reference plays when assembling a generation prompt. */
export type ReferenceRoleId = 'blocking' | 'style' | 'identity' | 'multiview-master';

export interface ReferenceRole {
  id: ReferenceRoleId;
  /** Plain label. */
  label: string;
  description: string;
  /** Phrasing template injected into the prompt; `{ref}` is replaced by the reference name. */
  promptCue: string;
  /** Assembly order (lower first) — blocking anchors the shot, identity must-match last. */
  order: number;
}

export const REFERENCE_ROLES: ReferenceRole[] = [
  {
    id: 'blocking',
    label: 'Blocking / motion source',
    description:
      'The 3D play blast (grayscale shape animation) that fixes camera path, composition, motion and timing. The control anchor.',
    promptCue: 'Use {ref} as the main blocking reference — keep its camera path, composition and timing exactly.',
    order: 1,
  },
  {
    id: 'style',
    label: 'Visual style / lighting+material',
    description: 'Reference for the look: lighting, mood and material properties.',
    promptCue: 'Use {ref} as the visual-style reference for lighting, mood and material properties.',
    order: 2,
  },
  {
    id: 'multiview-master',
    label: 'Multi-view master set',
    description:
      'A multi-angle reference SET (all sides; face close-up for characters) so the generator keeps identity consistent on un-shown angles.',
    promptCue: 'Use {ref} as the multi-view master set — keep the subject consistent from every angle, including sides and back.',
    order: 3,
  },
  {
    id: 'identity',
    label: 'Identity / master design',
    description: "The subject's exact design that must be matched (the 'master' reference).",
    promptCue: 'Use {ref} as the master identity reference — the subject must match it exactly (shape, proportions, key details).',
    order: 4,
  },
];

export const ROLE_IDS: ReferenceRoleId[] = REFERENCE_ROLES.map((r) => r.id);

export function getReferenceRole(id: string): ReferenceRole | undefined {
  return REFERENCE_ROLES.find((r) => r.id === id);
}

export interface GenPromptingPractice {
  summary: string;
  detail: string;
}

export const GEN_PROMPTING_PRACTICES: GenPromptingPractice[] = [
  {
    summary: 'Block the shot in 3D first, then render on top',
    detail:
      'Direct camera, motion and timing in 3D as a grayscale play blast, then let the generator render photoreal on top. The 3D keeps it precise + controllable and is far less random than image-only prompts (which burn ~5× the credits and drift more).',
  },
  {
    summary: 'Provide a multi-view master reference set',
    detail:
      'Give references from all sides (plus a face close-up for characters) so the model holds identity/design consistent — single-view references drift on the angles they never saw.',
  },
  {
    summary: 'Tag every reference with its role, explicitly, in the prompt',
    detail:
      'State what each reference is FOR: video = motion/blocking source, one image = visual style, one image = identity/master. Then describe the task and the must-keep material/lighting details.',
  },
  {
    summary: 'Match the generated timing to the play blast',
    detail: 'Keep the clip length/timing equal to the blocking (normal mode) or the motion desyncs and reads awkward.',
  },
];

/**
 * Assemble an ordered, role-tagged reference directive from supplied references
 * + a task line — the structured prompt scaffold the pro workflow uses. Unknown
 * roles are skipped.
 */
export function assembleReferenceDirective(
  refs: Array<{ role: string; label: string }>,
  task: string,
): string {
  const lines = refs
    .map((r) => ({ ref: r, role: getReferenceRole(r.role) }))
    .filter((x): x is { ref: { role: string; label: string }; role: ReferenceRole } => x.role !== undefined)
    .sort((a, b) => a.role.order - b.role.order)
    .map((x) => x.role.promptCue.replace('{ref}', x.ref.label));
  return [...lines, `Task: ${task}`].join('\n');
}
