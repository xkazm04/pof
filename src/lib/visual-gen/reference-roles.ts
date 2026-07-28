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
  {
    summary: 'For image→3D, isolate the subject on a plain (white/neutral) background',
    detail:
      'Before feeding a concept image to an image-to-3D generator (Hunyuan3D / TripoSR / Tripo / Meshy), put the subject alone on a plain white or neutral background. Busy or textured backgrounds bleed into the mesh — the generator reconstructs background geometry as floaters, fused blobs, or surface artifacts. Generate (or re-generate) the concept clean, single-subject, evenly lit; this is upstream of, and complements, the runner background-removal step.',
  },
  {
    summary: 'For image→3D, use a simple canonical pose — not a complex or stylized one',
    detail:
      'Give the mesher a straightforward, near-canonical pose (roughly A-pose, limbs uncrossed, no heavy self-occlusion) and a not-overly-stylized silhouette. Complex poses, crossed/overlapping limbs, and flowing accessories self-occlude and produce fused limbs, missing faces, and warped geometry in single-image→3D — characters are already the hard case. If the desired concept is complex, simplify the reference (canonical pose, isolated subject) for the mesh, then re-pose/retarget in-engine afterward.',
  },
  {
    summary: 'Split the color map from the PBR material set — AI for color, layered materials for properties',
    detail:
      'AI-generated COLOR (albedo/base-color) textures are production-usable — pro teams ship them with at most light post-processing fine-tunes. Material PROPERTIES (roughness/metalness/height) are not: layer them on top of the AI color base procedurally or from material presets (Substance-class tooling), where the achievable quality stays far above AI output. When an AI PBR-on-top tool derives property maps from an existing texture, feed it the 3D model as an input alongside the texture — texture-only input mis-derives the maps.',
  },
  {
    summary: 'Rebuild eyes as UV-unwrapped sphere primitives — never ship the generated ones',
    detail:
      'Image-to-3D reconstructs eyes as part of the face surface: sunken, asymmetric, and impossible to texture or animate. Delete them and drop in a sphere per eye (halved if the socket is shallow), unwrap it, and apply a generated square eye texture (iris centred, one texture mirrored across both eyes). It is a one-minute finishing step that fixes the single most read-on-sight character defect, and it is what makes an eye-look/blink rig possible later.',
  },
  {
    summary: 'For a symmetric subject, finish one half and mirror it',
    detail:
      'Mirror at the mesh-finish stage (Blender mirror modifier, clipped + seam-welded) rather than generating, retopologising, unwrapping and texturing both sides. One half carries the work and the other is free: half the retopo cleanup, half the UV islands, and a mirrored pair only needs texturing once. Skip it for deliberately asymmetric designs (one-sided armour, a single pauldron, an over-one-shoulder braid) — mirroring those destroys the design.',
  },
  {
    summary: 'Texture by reference-view projection, then inpaint the seams — it is never one pass',
    detail:
      'Project a reference image onto the model from the matching camera view, add it as a LAYER (so passes stack instead of overwriting), then generate the missing views (back, sides) from the same reference set and project those too. Projection alone always leaves seams, stretched grazing-angle areas and unreachable pockets: repair those by masking the bad region and inpainting it in place rather than re-projecting the whole object. Requires a real UV unwrap on the low-poly first.',
  },
  {
    summary: 'For part segmentation, feed a grid-combined multi-view and review the part list',
    detail:
      'When splitting a concept into parts (for modular assembly or per-part meshing), first combine the generated multi-view into a single grid image and segment THAT — part extraction works one object per image, so a grid of views gives it context on occluded and rear parts it would otherwise hallucinate. And never accept the auto-analyzed part list blind: review or hand-supply it against your assembly logic (which garments/accessories must be separate swap-slot parts), because the splitter cannot know how you intend to assemble or modularize the result.',
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
