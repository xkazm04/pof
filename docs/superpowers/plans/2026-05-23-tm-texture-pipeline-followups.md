# 06-TM Texture-Pipeline Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four open PoF-app items from `docs/improvements/06-textures-materials/` — prompt-length harmonization, normal-from-albedo derivation, a biome→texture map, and a two-tile advanced texture UI.

**Architecture:** PoF-app only (no UE/C++/Python). Backend-first: a `leonardo.ts` constant change, a new `sharp`-based `texture-maps` lib + route, a new `biome-textures` lib over the existing CC0 `asset-sources` layer, then a `MaterialLab` "Advanced" tab wiring the existing `/api/scenario` + `/api/leonardo` routes. Each task is TDD with its own narrow, local-only commit (shared tree — operator reconciles branches; do not switch branches).

**Tech Stack:** TypeScript, Next.js 16 route handlers, `sharp@0.34.5`, vitest (jsdom default; `node` env for sharp), `@testing-library/react` (no jest-dom — assert with `.toBeTruthy()`/`.textContent`).

**Spec:** `docs/superpowers/specs/2026-05-23-tm-texture-pipeline-followups-design.md`

**Execution grouping (user gate between deliverables):**
- Deliverable 0 = Task 1 · Deliverable 1 (#3) = Tasks 2–3 · Deliverable 2 (#7) = Task 4 · Deliverable 3 (#1) = Tasks 5–6.

**Per-commit note:** after each commit run `git branch --show-current` and report the landing branch.

---

## Status — ✅ COMPLETE (2026-05-23)

All four deliverables implemented TDD (RED→GREEN), full validate green at each
step. Originally committed across three branches due to shared-tree HEAD churn,
then **consolidated onto `master` by cherry-pick** (zero conflicts). Final master
state validated green: **959/959 tests, typecheck + lint clean**.

| Deliverable | What shipped | master commit |
|---|---|---|
| Audit fix (pre-req) | `generateTextureOn3DModel` S3-failure leak fixed (try wraps steps 2–4) + regression test | `623fa9b` |
| Spec | design doc | `641d6db` |
| Plan | this document | `d0a6802` |
| **D0** prompt-length | `MAX_PROMPT_LENGTH` single source of truth; lib throws (no silent slice); route reuses it; route-mock updated | `5d7f8da` |
| **D1 (#3)** normal-from-albedo | `src/lib/texture-maps.ts` `deriveNormalFromAlbedo` (wrap-around Sobel, tiling-safe); `sharp` added as direct dep | `a2280b4` |
| **D1 (#3)** route | `POST /api/texture-maps` `{albedoBase64,strength?}→{normalBase64}` | `023c524` |
| **D2 (#7)** biome→texture | `src/lib/visual-gen/biome-textures.ts` `BIOME_TEXTURES` + `pickBiomeTexture` (ambientCG search, PolyHaven fallback); anti-asphalt guard test | `f94a385` |
| **D3 (#1)** panel | `AdvancedTexturePanel` (Scenario PBR + Universal Upscaler tiles, key-gated hint) | `fc1d6cc` |
| **D3 (#1)** mount | Advanced tab wired into `MaterialLabView` | `a3a39b6` |
| Findings | run-log round-2 note | `2f58450` |

**Tests added:** prompt-length rejection (leonardo-client); `deriveNormalFromAlbedo`
flat/edge (real sharp); texture-maps route; biome-textures guard + pick/fallback;
`AdvancedTexturePanel` Scenario/upscale/configure-hint.

**Not pushed** — `master` is local-ahead of `origin/master`; the user pushes manually.

**Deviations from the as-written plan:** (1) D0 also required adding
`MAX_PROMPT_LENGTH` to the strict `vi.mock` in `leonardo-route.test.ts`. (2) The
per-commit "landing branch" varied (shared-tree HEAD churn) rather than a single
branch; resolved by the cherry-pick consolidation above.

---

## Task 1: Deliverable 0 — prompt-length harmonization

**Files:**
- Modify: `src/lib/leonardo.ts` (add `MAX_PROMPT_LENGTH`; replace silent slice with a throw)
- Modify: `src/app/api/leonardo/route.ts` (reference the shared constant)
- Test: `src/__tests__/leonardo/leonardo-client.test.ts` (add one case)

- [x] **Step 1: Write the failing test**

Add this `describe` block to the end of `src/__tests__/leonardo/leonardo-client.test.ts` (it reuses the file's existing `installGenFetch` helper):

```ts
describe('generateImage prompt length', () => {
  it('rejects a prompt longer than the limit instead of silently truncating', async () => {
    installGenFetch(); // would otherwise resolve successfully
    await expect(
      generateImage('x'.repeat(1501), { pollIntervalMs: 1 }),
    ).rejects.toThrow(/1500|limit/i);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts -t "silently truncating"`
Expected: FAIL — current code `slice(0,1500)`s and resolves, so the promise does not reject.

- [x] **Step 3: Add the constant and the guard**

In `src/lib/leonardo.ts`, add the export near the other module constants (after `const MAX_POLL_ATTEMPTS = 30;`):

```ts
export const MAX_PROMPT_LENGTH = 1500;
```

In the same file, in `generateImage`, replace:

```ts
  const trimmedPrompt = prompt.slice(0, 1500);
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
```

with:

```ts
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`);
  }
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
```

Then in the request `body`, replace `prompt: trimmedPrompt,` with `prompt,`.

- [x] **Step 4: Point the route at the shared constant**

In `src/app/api/leonardo/route.ts`, change the import:

```ts
import { generateImage, upscaleImage, generateTextureOn3DModel, MAX_PROMPT_LENGTH, type GenerateImageOptions } from '@/lib/leonardo';
```

and the guard in the `image` branch:

```ts
      if (prompt.length > MAX_PROMPT_LENGTH) return apiError(`Prompt exceeds ${MAX_PROMPT_LENGTH} character limit`, 400);
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/leonardo`
Expected: PASS — all leonardo client + route tests green (the new case rejects).

- [x] **Step 6: Full validate + commit**

Run: `npm run validate`
Expected: typecheck clean, lint warnings-only, tests pass.

```bash
git add src/lib/leonardo.ts src/app/api/leonardo/route.ts src/__tests__/leonardo/leonardo-client.test.ts
git commit -m "$(cat <<'EOF'
fix(leonardo): single prompt-length limit, throw instead of silent truncation

generateImage silently sliced prompts to 1500 chars while the route rejected
>1500 with 400 — direct lib callers were truncated without notice. Extract
MAX_PROMPT_LENGTH; the lib now throws past the limit and the route reuses the
same constant for its 400.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

---

## Task 2: Deliverable 1 (#3) — `deriveNormalFromAlbedo` lib + `sharp` dep

**Files:**
- Modify: `package.json` (add `sharp` to `dependencies`)
- Create: `src/lib/texture-maps.ts`
- Test: `src/__tests__/texture-maps/derive-normal.test.ts`

- [x] **Step 1: Declare sharp as a direct dependency**

`sharp@0.34.5` is already installed (transitively) and in the lockfile; declare it directly. In `package.json`, add to the `dependencies` object (keep alphabetical order):

```json
    "sharp": "^0.34.5",
```

Run: `npm install`
Expected: completes with no version change to sharp (records it as a direct dep). If `npm install` races with another session's package.json edit, re-read `package.json`, re-apply the one-line add, and re-run.

- [x] **Step 2: Write the failing test**

Create `src/__tests__/texture-maps/derive-normal.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { deriveNormalFromAlbedo } from '@/lib/texture-maps';

async function rawRGB(png: Uint8Array) {
  return sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
}

describe('deriveNormalFromAlbedo', () => {
  it('a flat albedo yields a flat normal (~128,128,255) and preserves dimensions', async () => {
    const flat = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const normal = await deriveNormalFromAlbedo(new Uint8Array(flat));
    const { data, info } = await rawRGB(normal);

    expect(info.width).toBe(8);
    expect(info.height).toBe(8);
    const i = (4 * 8 + 4) * info.channels; // center pixel
    expect(data[i]).toBe(128);
    expect(data[i + 1]).toBe(128);
    expect(data[i + 2]).toBe(255);
  });

  it('a left-dark/right-bright step bends the normal X channel below 128 at the rising edge', async () => {
    const w = 8, h = 8;
    const buf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < 4 ? 40 : 200;
        const i = (y * w + x) * 3;
        buf[i] = buf[i + 1] = buf[i + 2] = v;
      }
    }
    const albedo = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    const normal = await deriveNormalFromAlbedo(new Uint8Array(albedo), { strength: 4 });
    const { data, info } = await rawRGB(normal);

    const i = (4 * w + 3) * info.channels; // row 4, col 3 — the rising edge
    expect(data[i]).toBeLessThan(128);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/texture-maps/derive-normal.test.ts`
Expected: FAIL — `deriveNormalFromAlbedo` is not defined / module not found.

- [x] **Step 4: Implement the lib**

Create `src/lib/texture-maps.ts`:

```ts
/**
 * Texture-map derivation — server-side only.
 *
 * Derives a tangent-space normal map from an albedo by treating luminance as a
 * height field and running a wrap-around Sobel filter. Wrap-around sampling
 * keeps a tileable albedo's normal map tileable too.
 */
import sharp from 'sharp';

export interface DeriveNormalOptions {
  /** Bump intensity. Higher = stronger relief. Default 2. */
  strength?: number;
}

export async function deriveNormalFromAlbedo(
  albedo: Uint8Array,
  opts: DeriveNormalOptions = {},
): Promise<Uint8Array> {
  const strength = opts.strength ?? 2;

  const { data, info } = await sharp(Buffer.from(albedo))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels; // greyscale → 1

  // height at (x,y) in 0..1, with wrap-around sampling
  const at = (x: number, y: number): number => {
    const xx = ((x % w) + w) % w;
    const yy = ((y % h) + h) % h;
    return data[(yy * w + xx) * ch] / 255;
  };

  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;

      const i = (y * w + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  const png = await sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  return new Uint8Array(png);
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/texture-maps/derive-normal.test.ts`
Expected: PASS — flat → (128,128,255); rising edge → X < 128.

- [x] **Step 6: Commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add package.json package-lock.json src/lib/texture-maps.ts src/__tests__/texture-maps/derive-normal.test.ts
git commit -m "$(cat <<'EOF'
feat(texture-maps): derive tiling-safe normal map from albedo (sharp Sobel)

deriveNormalFromAlbedo treats albedo luminance as a height field and runs a
wrap-around Sobel filter, so a tileable albedo (Leonardo's tiling path) gets a
matched, seamless normal. Adds sharp as a direct dependency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

---

## Task 3: Deliverable 1 (#3) — `POST /api/texture-maps` route

**Files:**
- Create: `src/app/api/texture-maps/route.ts`
- Test: `src/__tests__/texture-maps/texture-maps-route.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/texture-maps/texture-maps-route.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/texture-maps', () => ({
  deriveNormalFromAlbedo: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

import { POST } from '@/app/api/texture-maps/route';
import { deriveNormalFromAlbedo } from '@/lib/texture-maps';

function req(body: unknown): Request {
  return new Request('http://localhost/api/texture-maps', { method: 'POST', body: JSON.stringify(body) });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/texture-maps', () => {
  it('returns normalBase64 for a valid albedo', async () => {
    const albedoBase64 = Buffer.from('fake-png').toString('base64');
    const res = await POST(req({ albedoBase64, strength: 3 }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.normalBase64).toBe(Buffer.from(new Uint8Array([1, 2, 3])).toString('base64'));
    expect(deriveNormalFromAlbedo).toHaveBeenCalledWith(expect.any(Uint8Array), { strength: 3 });
  });

  it('rejects a missing albedo with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/texture-maps/texture-maps-route.test.ts`
Expected: FAIL — route module not found.

- [x] **Step 3: Implement the route**

Create `src/app/api/texture-maps/route.ts`:

```ts
import { apiSuccess, apiError } from '@/lib/api-utils';
import { deriveNormalFromAlbedo } from '@/lib/texture-maps';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const albedoBase64 = body?.albedoBase64;
    if (!albedoBase64 || typeof albedoBase64 !== 'string') {
      return apiError('Missing or invalid "albedoBase64" field', 400);
    }
    const strength = typeof body?.strength === 'number' ? body.strength : undefined;
    const albedo = new Uint8Array(Buffer.from(albedoBase64, 'base64'));
    const normal = await deriveNormalFromAlbedo(albedo, { strength });
    return apiSuccess({ normalBase64: Buffer.from(normal).toString('base64') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/texture-maps] ${message}`);
    return apiError(message, 500);
  }
}
```

Note: the mock returns `deriveNormalFromAlbedo(..., { strength: 3 })`; when `strength` is absent the route passes `{ strength: undefined }` — that is intentional and matches the lib's `opts.strength ?? 2` default.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/texture-maps`
Expected: PASS — route + lib tests green.

- [x] **Step 5: Full validate + commit**

Run: `npm run validate`
Expected: green.

```bash
git add src/app/api/texture-maps/route.ts src/__tests__/texture-maps/texture-maps-route.test.ts
git commit -m "$(cat <<'EOF'
feat(api/texture-maps): POST albedo -> derived normal map (base64)

Exposes deriveNormalFromAlbedo via the standard envelope: { albedoBase64,
strength? } -> { normalBase64 }. 400 on missing albedo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

---

## Task 4: Deliverable 2 (#7) — biome→texture map + `pickBiomeTexture`

**Files:**
- Create: `src/lib/visual-gen/biome-textures.ts`
- Test: `src/__tests__/visual-gen/biome-textures.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/visual-gen/biome-textures.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/visual-gen/asset-sources', () => ({ searchAmbientCG: vi.fn() }));

import { BIOME_TEXTURES, pickBiomeTexture, type Biome } from '@/lib/visual-gen/biome-textures';
import { searchAmbientCG } from '@/lib/visual-gen/asset-sources';

const BIOMES = Object.keys(BIOME_TEXTURES) as Biome[];
const CATEGORIES = ['hdris', 'textures', 'models', 'materials'];

afterEach(() => vi.restoreAllMocks());

describe('BIOME_TEXTURES', () => {
  it('every biome has a themed query, prompt, valid category, and fallback id', () => {
    for (const b of BIOMES) {
      const s = BIOME_TEXTURES[b];
      expect(s.searchQuery.trim().length).toBeGreaterThan(0);
      expect(s.leonardoPrompt.trim().length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(s.category);
      expect(s.fallbackAssetId.trim().length).toBeGreaterThan(0);
    }
  });

  it('no biome query is a bare category name (anti-asphalt guard)', () => {
    for (const b of BIOMES) {
      const q = BIOME_TEXTURES[b].searchQuery.trim().toLowerCase();
      expect(CATEGORIES).not.toContain(q);
      expect(q.split(/\s+/).length).toBeGreaterThan(1); // multi-word themed query
    }
  });
});

describe('pickBiomeTexture', () => {
  it('returns the first usable ambientCG result', async () => {
    vi.mocked(searchAmbientCG).mockResolvedValue([
      { id: 'X', name: 'X', source: 'ambientcg', category: 'materials', thumbnailUrl: 't', downloadUrl: 'd', license: 'CC0' },
    ]);
    const r = await pickBiomeTexture('dungeon');
    expect(r.id).toBe('X');
    expect(r.source).toBe('ambientcg');
  });

  it('falls back to the PolyHaven id when ambientCG returns nothing', async () => {
    vi.mocked(searchAmbientCG).mockResolvedValue([]);
    const r = await pickBiomeTexture('dungeon');
    expect(r.source).toBe('polyhaven');
    expect(r.id).toBe(BIOME_TEXTURES.dungeon.fallbackAssetId);
  });

  it('falls back when the ambientCG search throws', async () => {
    vi.mocked(searchAmbientCG).mockRejectedValue(new Error('network'));
    const r = await pickBiomeTexture('forest');
    expect(r.source).toBe('polyhaven');
    expect(r.id).toBe(BIOME_TEXTURES.forest.fallbackAssetId);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/visual-gen/biome-textures.test.ts`
Expected: FAIL — `biome-textures` module not found.

- [x] **Step 3: Implement the lib**

Create `src/lib/visual-gen/biome-textures.ts`:

```ts
/**
 * Biome → texture mapping. Gives the autonomous texture path a *themed* default
 * per biome so it stops picking industrial defaults (the PS-2 asphalt regression).
 * Prefers an ambientCG text search (PolyHaven's API has no text search), falling
 * back to a known-good PolyHaven asset id.
 */
import { searchAmbientCG, type AssetCategory, type AssetSearchResult } from './asset-sources';

export type Biome = 'dungeon' | 'cave' | 'forest' | 'desert' | 'snow' | 'industrial';

export interface BiomeTextureSpec {
  /** Themed text query for ambientCG (never a bare category). */
  searchQuery: string;
  category: AssetCategory;
  /** Known-good PolyHaven asset id used when the search returns nothing. */
  fallbackAssetId: string;
  /** Themed seamless-PBR prompt for the Leonardo tiling path. */
  leonardoPrompt: string;
}

export const BIOME_TEXTURES: Record<Biome, BiomeTextureSpec> = {
  dungeon: {
    searchQuery: 'stone floor dungeon medieval',
    category: 'materials',
    fallbackAssetId: 'cobblestone_floor_04',
    leonardoPrompt: 'dark fantasy dungeon stone floor, weathered cobblestone, seamless tileable PBR texture',
  },
  cave: {
    searchQuery: 'rock cave wall natural',
    category: 'materials',
    fallbackAssetId: 'rock_wall_10',
    leonardoPrompt: 'damp natural cave rock wall, seamless tileable PBR texture',
  },
  forest: {
    searchQuery: 'forest ground dirt leaves',
    category: 'materials',
    fallbackAssetId: 'forrest_ground_01',
    leonardoPrompt: 'forest floor with dirt, moss and fallen leaves, seamless tileable PBR texture',
  },
  desert: {
    searchQuery: 'sand desert dune fine',
    category: 'materials',
    fallbackAssetId: 'sand_dunes_02',
    leonardoPrompt: 'desert sand dunes, fine rippled grains, seamless tileable PBR texture',
  },
  snow: {
    searchQuery: 'snow ground frozen field',
    category: 'materials',
    fallbackAssetId: 'snow_field_01',
    leonardoPrompt: 'fresh snow ground, soft drifts, seamless tileable PBR texture',
  },
  industrial: {
    searchQuery: 'metal floor industrial plate',
    category: 'materials',
    fallbackAssetId: 'metal_plate_02',
    leonardoPrompt: 'industrial metal floor plate, scuffed steel, seamless tileable PBR texture',
  },
};

function polyHavenFallback(id: string, category: AssetCategory): AssetSearchResult {
  return {
    id,
    name: id,
    source: 'polyhaven',
    category,
    thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
    downloadUrl: `https://api.polyhaven.com/files/${id}`,
    license: 'CC0',
  };
}

/** Pick a themed CC0 texture for a biome: ambientCG text search first, PolyHaven id fallback. */
export async function pickBiomeTexture(biome: Biome): Promise<AssetSearchResult> {
  const spec = BIOME_TEXTURES[biome];
  try {
    const results = await searchAmbientCG(spec.searchQuery, 12);
    const usable = results.find((r) => r.downloadUrl);
    if (usable) return usable;
  } catch {
    // fall through to the PolyHaven fallback
  }
  return polyHavenFallback(spec.fallbackAssetId, spec.category);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/visual-gen/biome-textures.test.ts`
Expected: PASS — guard checks + pick/fallback paths green.

- [x] **Step 5: Full validate + commit**

Run: `npm run validate`
Expected: green.

```bash
git add src/lib/visual-gen/biome-textures.ts src/__tests__/visual-gen/biome-textures.test.ts
git commit -m "$(cat <<'EOF'
feat(visual-gen): biome -> texture map + pickBiomeTexture (anti-asphalt default)

Each biome maps to a themed ambientCG query, a Leonardo seamless-PBR prompt, and
a known-good PolyHaven fallback id. pickBiomeTexture prefers ambientCG text
search, falling back to PolyHaven so the autonomous path always gets a themed
texture instead of an industrial default.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

---

## Task 5: Deliverable 3 (#1) — `AdvancedTexturePanel` component

**Files:**
- Create: `src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx`
- Test: `src/__tests__/components/advanced-texture-panel.test.tsx`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/components/advanced-texture-panel.test.tsx` (mirrors `wiring-assets-panel.test.tsx`; no jest-dom — assert with `.toBeTruthy()`/`.textContent`):

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { AdvancedTexturePanel } from '@/components/modules/visual-gen/material-lab/AdvancedTexturePanel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AdvancedTexturePanel — Scenario PBR tile', () => {
  it('posts the prompt to /api/scenario and renders the PBR thumbnails', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { albedoUrl: 'a.png', normalUrl: 'n.png', roughnessUrl: 'r.png' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    fireEvent.click(screen.getByTestId('scenario-generate'));

    await waitFor(() => expect(screen.getByTestId('pbr-albedo')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scenario');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ prompt: 'dungeon stone' });
  });

  it('shows a configure hint when SCENARIO_API_KEY is not configured', async () => {
    mockFetch({ status: 500, body: { success: false, error: 'SCENARIO_API_KEY not configured' } });
    render(<AdvancedTexturePanel />);
    fireEvent.click(screen.getByTestId('scenario-generate'));
    await waitFor(() => expect(screen.getByTestId('scenario-error').textContent).toMatch(/configure/i));
  });
});

describe('AdvancedTexturePanel — Upscaler tile', () => {
  it('posts mode=upscale with the image id + style and shows the job id', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { upscaleJobId: 'up-1' } } });
    render(<AdvancedTexturePanel />);
    fireEvent.change(screen.getByTestId('upscale-image-id'), { target: { value: 'img-7' } });
    fireEvent.click(screen.getByTestId('upscale-run'));

    await waitFor(() => expect(screen.getByTestId('upscale-job').textContent).toContain('up-1'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/leonardo');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ mode: 'upscale', imageId: 'img-7', style: 'GENERAL' });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/advanced-texture-panel.test.tsx`
Expected: FAIL — component module not found.

- [x] **Step 3: Implement the component**

Create `src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

interface ScenarioResult { albedoUrl?: string; normalUrl?: string; roughnessUrl?: string }

const isNotConfigured = (e: string | null) => !!e && /not configured/i.test(e);

export function AdvancedTexturePanel() {
  // Scenario PBR tile
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('');
  const [pbr, setPbr] = useState<ScenarioResult | null>(null);
  const [pbrErr, setPbrErr] = useState<string | null>(null);
  const [pbrLoading, setPbrLoading] = useState(false);

  // Universal Upscaler tile
  const [imageId, setImageId] = useState('');
  const [style, setStyle] = useState('GENERAL');
  const [jobId, setJobId] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [upLoading, setUpLoading] = useState(false);

  const runScenario = async () => {
    setPbrLoading(true); setPbr(null); setPbrErr(null);
    const r = await tryApiFetch<ScenarioResult>('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId: modelId || undefined }),
    });
    if (r.ok) setPbr(r.data);
    else { setPbrErr(r.error); logger.warn(`[advanced-texture] scenario: ${r.error}`); }
    setPbrLoading(false);
  };

  const runUpscale = async () => {
    setUpLoading(true); setJobId(null); setUpErr(null);
    const r = await tryApiFetch<{ upscaleJobId: string }>('/api/leonardo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'upscale', imageId, style }),
    });
    if (r.ok) setJobId(r.data.upscaleJobId);
    else { setUpErr(r.error); logger.warn(`[advanced-texture] upscale: ${r.error}`); }
    setUpLoading(false);
  };

  const maps: Array<[string, string | undefined]> = [
    ['pbr-albedo', pbr?.albedoUrl],
    ['pbr-normal', pbr?.normalUrl],
    ['pbr-roughness', pbr?.roughnessUrl],
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Tile A — Scenario PBR set */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <Sparkles className="w-4 h-4" /> Scenario PBR set
        </header>
        <textarea
          data-testid="scenario-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="dark fantasy dungeon stone, seamless PBR"
          rows={2}
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <input
          data-testid="scenario-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="Scenario model id (optional)"
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <button
          data-testid="scenario-generate"
          onClick={runScenario}
          disabled={pbrLoading}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40"
        >
          {pbrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate PBR set
        </button>

        {pbrErr && (
          <div data-testid="scenario-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">
            {isNotConfigured(pbrErr)
              ? 'Configure SCENARIO_API_KEY + SCENARIO_API_SECRET in the app .env to use Scenario PBR generation.'
              : pbrErr}
          </div>
        )}

        {pbr && (
          <div className="grid grid-cols-3 gap-2">
            {maps.map(([id, url]) =>
              url ? (
                <img key={id} data-testid={id} src={url} alt={id} className="w-full aspect-square object-cover rounded border border-white/10" />
              ) : null,
            )}
          </div>
        )}
      </section>

      {/* Tile B — Universal Upscaler */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-[var(--visual-gen)]">
          <ArrowUpRight className="w-4 h-4" /> Universal Upscaler
        </header>
        <input
          data-testid="upscale-image-id"
          value={imageId}
          onChange={(e) => setImageId(e.target.value)}
          placeholder="Leonardo generated image id"
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        />
        <select
          data-testid="upscale-style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs"
        >
          <option value="GENERAL">General</option>
          <option value="ARTISTIC">Artistic</option>
          <option value="REALISTIC">Realistic</option>
        </select>
        <button
          data-testid="upscale-run"
          onClick={runUpscale}
          disabled={upLoading || !imageId}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40"
        >
          {upLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          Upscale
        </button>

        {upErr && (
          <div data-testid="upscale-error" className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{upErr}</div>
        )}
        {jobId && (
          <div data-testid="upscale-job" className="text-[11px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
            Upscale job started: {jobId}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/advanced-texture-panel.test.tsx`
Expected: PASS — Scenario tile posts + renders thumbnails; configure-hint path; upscale tile posts mode=upscale + shows job id.

- [x] **Step 5: Commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx src/__tests__/components/advanced-texture-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(material-lab): AdvancedTexturePanel — Scenario PBR + Universal Upscaler tiles

Two-tile panel wiring the existing /api/scenario and /api/leonardo (mode=upscale)
routes into the UI, with loading/error state and a graceful "configure
SCENARIO_API_KEY" hint when the key is unset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

---

## Task 6: Deliverable 3 (#1) — mount the panel in MaterialLab

**Files:**
- Modify: `src/components/modules/visual-gen/material-lab/MaterialLabView.tsx`

- [x] **Step 1: Add the import**

In `MaterialLabView.tsx`, add to the imports (near `import { PBREditor } from './PBREditor';`):

```ts
import { AdvancedTexturePanel } from './AdvancedTexturePanel';
```

and add `Sparkles` to the existing `lucide-react` import:

```ts
import { Paintbrush, Send, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
```

- [x] **Step 2: Add the tab**

In `MaterialLabView()`, extend the `extraTabs` array with a second entry:

```ts
  const extraTabs: ExtraTab[] = [
    {
      id: 'editor',
      label: 'Editor',
      icon: Paintbrush,
      render: () => <EditorTab />,
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: Sparkles,
      render: () => <AdvancedTexturePanel />,
    },
  ];
```

- [x] **Step 3: Verify typecheck + full validate**

Run: `npm run validate`
Expected: typecheck clean, lint warnings-only, all tests pass (936/946-class total, no failures from these files).

- [x] **Step 4: Commit**

```bash
git add src/components/modules/visual-gen/material-lab/MaterialLabView.tsx
git commit -m "$(cat <<'EOF'
feat(material-lab): mount the Advanced texture tab (Scenario PBR + upscaler)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git branch --show-current
```

- [x] **Step 5: Append a findings note**

Add a short entry to `docs/improvements/06-textures-materials/runs/2026-05-23-run.md` (a new `## Follow-ups (later same day)` section) recording: the four items closed, the commit hashes, and which branch each landed on. Commit it:

```bash
git add docs/improvements/06-textures-materials/runs/2026-05-23-run.md
git commit -m "docs(06-TM): record texture-pipeline follow-ups (prompt-length, normal-gen, biome map, advanced UI)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git branch --show-current
```

---

## Self-Review

**Spec coverage:**
- Deliverable 0 (prompt-length) → Task 1. ✓
- Deliverable 1 #3 (normal-from-albedo lib + route + sharp dep) → Tasks 2–3. ✓
- Deliverable 2 #7 (biome map + helper + anti-asphalt test) → Task 4. ✓
- Deliverable 3 #1 (2-tile panel + mount + key-gated hint) → Tasks 5–6. ✓
- Findings note (DoD §6) → Task 6 Step 5. ✓

**Type consistency:** `deriveNormalFromAlbedo(albedo, { strength })` signature identical in lib (Task 2), route (Task 3), and route test (Task 3). `tryApiFetch` unwrap uses `r.ok ? r.data : r.error` matching `Result<T> = {ok:true;data} | {ok:false;error}`. `BIOME_TEXTURES`/`Biome`/`pickBiomeTexture`/`BiomeTextureSpec` names consistent across Task 4 lib + test. `ExtraTab` shape `{ id, label, icon, render }` matches the existing array in Task 6.

**Placeholder scan:** no TBD/TODO; every code step has full code; every test step has full assertions; commands have expected output.

**Known caveat (carried from spec):** `pickBiomeTexture`'s PolyHaven `fallbackAssetId`s are plausible CC0 ids but not live-verified; they are exercised only as URL-construction in tests (network mocked), so tests are deterministic. Live id correctness is a runtime concern, not a test gap.
