# ECW Visual Theme Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Make the ECW shell readable — real surface elevation + brighter muted text (tokens), and content in legible sans with mono reserved for code/IDs (className pass).

**Architecture:** Pure presentation. Token edits in `globals.css` propagate through Tailwind theme vars (`bg-surface`, `text-text-muted`, …) to every ECW surface automatically; the className pass swaps Tailwind utilities on the highest-traffic ECW components. No state/behavior changes — the regression gate is the existing ECW vitest suite staying green (tests assert text content, not classes/sizes).

**Tech Stack:** Tailwind 4 (CSS-var theme), React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-visual-theme-design.md`. **Invariants:** branch-local commits; no hardcoded hex outside `globals.css` token defs (use `chart-colors`/CSS vars elsewhere); `@/` imports; co-author tag; each task ends ECW suite green + eslint clean on touched files. ECW-only — never touch `src/components/layout/**` or `src/components/modules/**`.

**The typography convention (apply consistently in every className task):**
- Readable **content** (entity/session names, stat values, descriptions, body copy) → `text-sm` (primary) or `text-xs` (dense) **sans**, color `text-text`. Replace `text-2xs`/`font-mono`/`text-text-muted` when used for such content.
- `font-mono` kept **only** for IDs, asset/content paths, code, raw JSON, keybindings.
- **Section eyebrow labels** ("Production Pipeline", "Cross-links", card section headers) may stay `text-2xs uppercase tracking` but keep `text-text-muted` (now brighter) — don't shrink content down to them.
- **Card/section titles** → `text-sm font-semibold text-text` (not muted).

---

## Task 1: Token ladder + convention comment (`globals.css`)

**Files:** Modify `src/app/globals.css` (the `:root` block, ~lines 16-24).

- [ ] **Step 1: Edit the six tokens** (exact replacements):

```css
  --background: #0a0a16;   /* was #0a0a1a — page floor */
  --surface: #1e1e3a;      /* was #111128 — raised cards, clearly above the page */
  --surface-hover: #2a2a4e;/* was #1a1a3a — obvious hover */
  --border: #30305a;       /* was #1e1e3a — visible separators */
  --surface-deep: #14142c; /* was #0d0d22 — insets/wells */
  --text-muted: #7d82a8 → #9aa0c4;  /* brighter secondary text */
```

Apply each as a value swap (keep the var names). Leave `--text`, `--text-muted-hover`, `--setup`, and all other tokens unchanged.

- [ ] **Step 2: Add the convention comment** above the `:root` block:

```css
/* ECW typography convention (sub-project A): content = text-sm/text-xs sans + text-text;
   font-mono only for IDs/paths/code/keybindings; eyebrow labels stay small + text-text-muted;
   titles = text-sm font-semibold text-text. Surfaces: background < surface-deep < surface (cards). */
```

- [ ] **Step 3: Verify the ECW suite stays green** (CSS-only change must not affect tests):

Run: `npx vitest run src/__tests__/components/ecw src/__tests__/app`
Expected: all green (unchanged count).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ecw-theme): elevate surface ladder + brighten muted text + convention (theme A.1)"
```

---

## Task 2: Catalog sidebar typography (`EntityTree`, `CatalogRow`)

**Files:** Modify `src/components/ecw/catalogs/EntityTree.tsx`, `src/components/ecw/catalogs/CatalogRow.tsx`.

- [ ] **Step 1: Apply the convention.** In each file, change readable content classes per the convention: entity/catalog names and counts that are `text-2xs font-mono` → `text-xs`/`text-sm` sans `text-text` (names) / `text-text-muted` (counts). Keep `font-mono` only if the string is an id/path. Group eyebrow labels stay as-is (now brighter). Example (EntityTree entity row): the `<span className="flex-1 truncate">{row.label}</span>` parent button keeps `text-xs` (already sans) — ensure it is `text-text` when active, `text-text-muted` otherwise (already the case); the group header `text-2xs font-mono uppercase` stays. CatalogRow: a row's primary label → `text-sm text-text`; its stats line `text-2xs font-mono` → `text-xs` sans `text-text-muted` unless it shows an id.

- [ ] **Step 2: Verify** — Run: `npx vitest run src/__tests__/components/ecw/catalogs` — Expected: green. Run: `npx eslint src/components/ecw/catalogs/EntityTree.tsx src/components/ecw/catalogs/CatalogRow.tsx` — clean.

- [ ] **Step 3: Commit** — `git commit -m "feat(ecw-theme): readable catalog sidebar typography (theme A.2)"`

---

## Task 3: Mission Control cards (`mission/*`)

**Files:** Modify `src/components/ecw/mission/{CatalogRollupCard,QualityRollupCard,FeatureCoverageCard,SessionActivityCard,PlaytestsCard,RoadmapCard,NextBestActionsCard,ActivityFeedCard,ForecastCard}.tsx`.

- [ ] **Step 1: Apply the convention per card.** Card `<h2>` titles → ensure `text-sm font-semibold text-text` (most already are). Body rows that show readable data in `text-2xs font-mono` (module ids are fine as mono; human counts/percentages/labels) → `text-xs` sans `text-text` for values, `text-text-muted` for labels. Keep module-id strings + numeric `g`/`%` mono only where they read as data tokens. Optional accent: add a left accent border to each card section using a `chart-colors` token (e.g. `style={{ borderLeftColor: ... }}` with `border-l-2`) — only if it reads cleanly; skip if noisy.

- [ ] **Step 2: Verify** — Run: `npx vitest run src/__tests__/components/ecw/mission` — Expected: green. `npx eslint src/components/ecw/mission` — clean (no hardcoded hex).

- [ ] **Step 3: Commit** — `git commit -m "feat(ecw-theme): readable Mission Control card typography (theme A.3)"`

---

## Task 4: Inspector + track tabs (`inspector/*`, `pipeline/TrackTabStrip`, workspaces)

**Files:** Modify `src/components/ecw/inspector/{EntityHeader,EntityLifecyclePanel,EntityCrossLinksPanel,EntitySpecPanel}.tsx`, `src/components/ecw/pipeline/TrackTabStrip.tsx`, `src/components/ecw/pipeline/PipelineTrackDetail.tsx`, `src/components/ecw/pipeline/workspaces/*.tsx`.

- [ ] **Step 1: Apply the convention.** Entity name in `EntityHeader` → already a heading; ensure `text-text` + adequate size (`text-base`/`text-lg font-semibold`). Breadcrumb `text-2xs` → `text-xs text-text-muted` (sans). Track tab labels in `TrackTabStrip` stay compact (`text-2xs`) but ensure active = `text-text`, inactive = `text-text-muted`. PipelineTrackDetail hint/labels: descriptions → `text-xs` sans `text-text-muted`; the track label/title → `text-sm font-semibold text-text` (already). Cross-links / lifecycle values that are readable content → `text-xs`/`text-sm` sans; keep UE asset paths + entity ids as `font-mono`.

- [ ] **Step 2: Verify** — Run: `npx vitest run src/__tests__/components/ecw/inspector src/__tests__/components/ecw/pipeline` — Expected: green. `npx eslint <touched files>` — clean.

- [ ] **Step 3: Commit** — `git commit -m "feat(ecw-theme): readable inspector + track-tab typography (theme A.4)"`

---

## Task 5: CLI rail (`cli/*`, `CliRail`)

**Files:** Modify `src/components/ecw/CliRail.tsx`, `src/components/ecw/cli/{SessionRow,SessionList}.tsx`.

- [ ] **Step 1: Apply the convention.** Session names (readable content) currently `font-mono` → `text-xs`/`text-sm` sans `text-text`. Keep session **keys/ids**, status codes, and any command text as `font-mono`. Rail header "CLI" eyebrow stays small/muted.

- [ ] **Step 2: Verify** — Run: `npx vitest run src/__tests__/components/ecw/cli` (if present) and `npx vitest run src/__tests__/components/ecw` — Expected: green. `npx eslint <touched files>` — clean.

- [ ] **Step 3: Commit** — `git commit -m "feat(ecw-theme): readable CLI rail typography (theme A.5)"`

---

## Final verification

- [ ] `npx vitest run src/__tests__/components/ecw src/__tests__/app` — all green (same count as before the pass).
- [ ] `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v AssetInspector || echo CLEAN` — CLEAN (no new errors).
- [ ] Manual smoke (`npm run dev`, `/`): cards visibly separate from the page (surface ladder), secondary text legible, entity/session names in readable sans, mono only on ids/paths.

## Out of scope
Layout restructuring; Overview surface (B); rich Logic editors (C); legacy theming.
