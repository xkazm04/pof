/**
 * The server-owned check prompts — the QUESTION each visual mode asks.
 *
 * Extracted from `api/verify/visual` so the prompt is a versioned artifact of the use case
 * rather than a literal inside one route. Two consumers depend on that: the route sends it,
 * and `scripts/vision-arena/` grades every provider ON IT. The arena's first rule is "one
 * prompt, every candidate" — an arm handed a friendlier question measures prompt luck — and
 * that is only enforceable if both sides import the same string.
 *
 * The wording is load-bearing (see e2e hud-check.txt); change it and the arena results
 * recorded against the old wording become evidence about a different question.
 */

export type CheckMode = 'hud' | 'texture' | 'lighting' | 'character';

/* ── HUD ── */

const HUD_CHECK_PROMPT = `You are inspecting a screenshot of a video game taken right after a HUD/UI change.
List every on-screen HUD/UI element (health/mana bars, text labels, ability slots, numbers) and its screen position.
Critically determine whether ANY element reads as empty, blank, or zero-width — e.g. a progress bar with no visible fill, or an element that failed to render.
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "visibleElements": string[],
  "anyEmptyOrZeroWidth": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if anyEmptyOrZeroWidth is true or if no HUD is visible at all.`;

/* ── Server-owned texture-quality prompt (folder-06 §6) ── */

const TEXTURE_CHECK_PROMPT = `You are inspecting a single texture image intended to tile seamlessly across a 3D surface.
Determine whether it is a genuinely SEAMLESS, TILEABLE texture: imagine it repeated edge-to-edge in a grid.
List any obvious defects — a visible SEAM at the edges, BAKED-IN lighting or shadow/highlight, a dominant feature that would visibly repeat, or anything that breaks the tile.
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "tileable": boolean,
  "issues": string[],
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if tileable is false or any seam / baked-in lighting is present.`;

/* ── Server-owned lighting-smoke prompt (folder-05 §5) ── */

const LIGHTING_CHECK_PROMPT = `You are inspecting a screenshot of a 3D game environment (an arena or level) taken right after an environment/lighting change.
Determine whether the scene is actually LIT and rendering — not a black / un-lit failure (the class of bug where static-mesh geometry renders black because lighting was never baked).
- Is the scene lit (surfaces and colour visible), or is it black / un-lit?
- Do surfaces show shading and shadows (graded lighting, depth), or are they flat-shaded / uniformly bright?
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "lit": boolean,
  "shadowed": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if the scene reads as black / un-lit (lit is false).`;

/* ── Server-owned character-check prompt (folder-02 §6) ── */

const CHARACTER_CHECK_PROMPT = `You are inspecting a screenshot of a 3D game taken right after a character setup change.
Determine whether the on-screen character(s) render correctly:
- Is a HUMANOID character visible at all (not missing / invisible / a bare capsule)?
- Is it in a NATURAL pose (idle / standing / walking), or stuck in a default T-POSE / A-POSE (arms straight out to the sides = the Animation Blueprint never drove the mesh)?
- If two characters are present (player + enemy), are they clearly VISUALLY DISTINCT from each other (e.g. obviously different colours), or too similar to tell apart?
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "humanoidVisible": boolean,
  "tPosed": boolean,
  "distinct": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if humanoidVisible is false or tPosed is true.`;


/** The prompt for a mode. One place, so route and arena cannot diverge. */
export const CHECK_PROMPTS: Record<CheckMode, string> = {
  hud: HUD_CHECK_PROMPT,
  texture: TEXTURE_CHECK_PROMPT,
  lighting: LIGHTING_CHECK_PROMPT,
  character: CHARACTER_CHECK_PROMPT,
};
