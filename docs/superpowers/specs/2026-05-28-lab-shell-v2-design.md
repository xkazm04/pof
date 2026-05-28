# Lab Shell v2 — Flagship Design Spec

**Date:** 2026-05-28
**Status:** Design — all sections approved; awaiting user review of this written spec before planning.
**Goal:** Elevate the entire `/layout` lab shell to a flagship UI: a `--lab-*` CSS-variable design system with a typed primitive kit, two fully-realized theme identities (Blueprint title-block / Studio glass), and a keyboard-first, persisted, motion-aware shell — without rewriting the step-content components or changing the information architecture.

**Architecture:** A CSS custom-property token layer (set per theme via `[data-theme]` and per density via `[data-density]`) is the single source of visual truth. The existing `LabTheme` object is rebuilt as a compat shim whose fields emit `var(--lab-*)` references, so every step-content component (the ~13 Items step UIs, `ArchetypeStep`, one-shot panels) inherits the new theming with zero rewrites. The shell + framing surfaces are migrated to a small primitive kit (`Panel`, `Button`, `Stat`, `Rail`, `Chip`, `IconButton`, `Field`) that consumes the tokens. Theme/density/last-location persist to `localStorage`; navigation is keyboard-first; motion is tokenized and reduced-motion-aware.

**Tech Stack:** Next.js 16 (Turbopack dev) · React 19 · framer-motion (already a dependency) · CSS custom properties · Zustand (existing stores untouched) · Vitest + RTL. No new dependencies.

**Why now:** the shell's chrome is a hardcoded black bar over a light Blueprint canvas (split-brain identity), and the entire lab applies theming via threaded-`t` inline styles — the central code-quality + theming bottleneck. v2 fixes both at the root.

---

## Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Target = the whole `/layout` lab shell** (not a single feature). | Broadest visual + code-quality impact; both prior features live inside it. |
| 2 | **Flagship reimagining**, same IA (Catalogs/Matrix/Canon preserved). | New cohesive identity without breaking muscle memory or the existing test surface. |
| 3 | **CSS-variable token layer + typed primitive kit** as the styling foundation. | Collapses the inline-`t` sprawl, gives free theme transitions + a real spacing/radius/elevation/motion scale, no new deps. |
| 4 | **`LabTheme` becomes a compat shim** (fields → `var(--lab-*)`). | Step-content components keep rendering unchanged; theming lands everywhere for free; primitive migration is opportunistic. |
| 5 | **Blueprint = title-block chrome; Studio = glass command bar.** | Commits each theme to a metaphor; fixes the chrome/canvas split-brain. |
| 6 | **Equal investment** in both themes. | Proves the token system carries two distinct materialities. |
| 7 | **Functionality: keyboard-first nav + density/persisted prefs + animated view transitions.** **No command palette.** | The set the user chose — coherent, tighter scope. |
| 8 | **Build foundation-first, then migrate ring-by-ring.** | Every commit keeps tests green and is independently reviewable/shippable. |
| 9 | **Blast radius:** shell + framing surfaces fully migrated; step-content via the shim. | Keeps the diff reviewable; tests stay green. |

---

## Section 1 — Architecture & token system

**Token layer (`lab-tokens.css`).** Defines the `--lab-*` taxonomy on `:root`, overridden under `[data-theme="blueprint"]` / `[data-theme="studio"]`. One scale per concern:

```
color:      --lab-bg --lab-panel --lab-ink --lab-ink-deep --lab-text --lab-muted
            --lab-line --lab-accent --lab-accent-bg --lab-on-accent
status:     --lab-ok --lab-warn --lab-bad --lab-deferred
space:      --lab-s1..s8       (4·8·12·16·20·28·36·48)
radius:     --lab-r-sm --lab-r-md --lab-r-lg   (0 in blueprint; 6/8/12 in studio)
elevation:  --lab-elev-1..3    (none in blueprint; layered shadow in studio)
motion:     --lab-dur-fast --lab-dur --lab-ease   (→ 0ms under reduced-motion)
texture:    --lab-grid (blueprint schematic grid) / --lab-glass-blur (studio)
typography: --lab-font-body --lab-font-mono + --lab-fs-* step scale
```

**Theme switching** = `document.documentElement.dataset.theme = id`; one attribute flip, every token-consuming surface transitions in CSS. No prop threading, no re-render storm.

**Density** = `[data-density="compact"]` tightening the `--lab-s*` paddings/row-heights to ≈0.75× — purely tokens, no per-component logic.

**Compat shim (`theme.ts`).** `LabTheme`'s color fields return the matching `var(--lab-*)` string. **Fields that JS reads as values, not CSS, stay real:** `glass` (boolean), `id`/`label` (strings), `fontBody`/`fontMono` (Next-font classNames applied via `className={t.fontMono}`), and `gridLine` (used as a truthiness branch — see below). The exact key set is preserved so TypeScript guarantees no step-content component breaks. Where a color field is also consumed by JS *color math*, the shim exposes a `raw` companion for that field — see §5 error handling.

**Primitive kit (`layout-lab/ui/`).** `Panel`, `Button` (variants: solid / ghost / accent), `Stat`, `Field`/`Input`/`Textarea`, `Rail`, `Chip`, `IconButton`, `VisuallyHidden`. Each ≤ ~80 LOC, reads tokens, ships a focus ring. Plus hooks: `useLabPrefs()` (theme/density/last-location) and `useRovingFocus()` (shared rail keyboard nav).

---

## Section 2 — Visual identity

Two skins of one instrument: same IA, same tokens, same primitives, different materiality. The status-glyph language (`✓ ! ⋯`) and the 3-view IA are preserved, re-skinned through tokens. Typography gains a real `--lab-fs-*` step scale, replacing the scattered `fontSize: 14/16/26/30`.

**Blueprint — an engineering drawing.** Chrome is a **title-block stamp**: hairline-ruled cells, `sheet 03/13 · items`, catalog as drawing name, mono coordinates. Crisp hairlines, zero radius, no blur — flatness *is* the identity. Major/minor graph grid. Cobalt ink hierarchy. Mono for all coordinates/labels/step numbers. Motion is mechanical (linear ease, no bounce). Selected step = filled cobalt square + checkmark (existing language, sharpened).

**Studio — a lit-glass instrument.** Chrome is a **glass command bar** (backdrop-blur + 1px lit top-edge highlight). Graphite background with a faint ambient radial (not flat black). Glass panels: blur, layered elevation, lit top edge. Cyan accent with a controlled glow on active/current/focus. Rounded (md/lg). Smooth eased motion with glow transitions. Fail dot keeps the existing pulse.

**Both** fix the chrome/canvas split-brain (no more hardcoded black bar) and read as one cohesive instrument in either skin.

---

## Section 3 — Shell layout & components

IA unchanged: Catalogs / Matrix / Canon; 3-column Catalogs body.

**Chrome (one component, two materialities).** Replaces the hardcoded `#0c0c0c` bar; fully token-driven so Blueprint renders the title-block and Studio the glass command bar. Contents: brand, view switcher, theme toggle, **density toggle (new)**, `+ One-shot`, Jobs chip, Legacy escape, BridgeStrip — all rebuilt on `Button`/`Chip`/`IconButton` with real focus rings.

**Body `[ Nav rail │ Pipeline rail │ Work canvas ]`:**
- **Nav rail** (was the 260px catalog tree): collapsible category groups, roving-tabindex keyboard nav (`↑↓` move, `→`/Enter open, `←` collapse), token-driven selected/hover, focus-visible rings. Built on `Rail` + tree-row primitives.
- **Pipeline rail** (was 320px): keeps the status-glyph dots, connecting spine, current-step ring, live-prototype dot, and the framer-motion status stamp — re-expressed through tokens; adds `j/k` stepping; demo/reset as `Button`s.
- **Work canvas**: structurally unchanged (`NextStepCoach` → `PipelineRollup` → step component). Re-skins via the shim; `NextStepCoach` + `PipelineRollup` migrate to primitives.

**Responsive:** keep the single `<1100px` collapse-to-drawers behavior (`useViewportWidth` SSR wide-fallback); drawers move to the primitive kit + new motion system (existing focus-trap + Escape retained). No new breakpoints.

**Primitive coverage after v2:** chrome, both rails, drawers, stat strip, coach, rollup, jobs chip, bridge strip. Step-content stays on the shim.

---

## Section 4 — Interaction & motion

**Keyboard model — three focus zones + chrome.** Tab cycles landmarks: chrome → nav rail → pipeline rail → canvas, with a "skip to canvas" link first in DOM. Roving tabindex per rail (one tab-stop each): nav rail `↑↓`/`→`/Enter/`←`; pipeline rail `↑↓` or `j/k` + Enter. Escape closes drawers/panels. Rings via the app's unified `.focus-ring` token, with `--focus-accent` → `--lab-accent` so the ring is theme-correct. One shared `useRovingFocus()` hook serves both rails.

**Motion system — framer-motion, tokenized.** Reads `--lab-dur*`/`--lab-ease`. Three roles: view swap (Catalogs/Matrix/Canon `AnimatePresence` crossfade-with-slight-slide — not the View Transitions API; framer-motion is SSR-safe and already used), step selection (ring + canvas-header entrance, existing dot stamp kept), list entrance (staggered fade-up for tree rows + timeline dots).

**Reduced motion — belt and suspenders.** `@media (prefers-reduced-motion: reduce)` collapses `--lab-dur*` to `0ms`; framer components also gate on `useReducedMotion()`.

**Persisted prefs.** `useLabPrefs()` over `localStorage['pof-lab-prefs'] = { theme, density, lastCatalogId, lastEntityId }`. Hydration uses the codebase's required SSR-safe trio `useSyncExternalStore(()=>()=>{}, ()=>true, ()=>false)` (the naive `useEffect(setMounted)` mount-guard is an ESLint error here). No `Date.now()`/`Math.random()` in render. SSR snapshot stays Blueprint/comfortable; on hydrate it applies the stored `[data-theme]`/`[data-density]` and restores last catalog/entity. `LayoutLab`'s `useState` for theme/catalog/entity sources from this hook.

---

## Section 5 — File structure, error handling, testing & verification

**File manifest.**

*New:*
- `layout-lab/lab-tokens.css` — token taxonomy + `[data-theme]` + `[data-density]` + reduced-motion override.
- `layout-lab/ui/{Panel,Button,Stat,Rail,Chip,IconButton,Field,VisuallyHidden}.tsx` + `ui/index.ts`.
- `layout-lab/hooks/{useLabPrefs,useRovingFocus}.ts`.
- Tests for all of the above.

*Modified:*
- `theme.ts` — compat shim (fields → `var(--lab-*)`; `glass`/`id` real; `raw` companion where JS needs it).
- `LayoutLab.tsx` — chrome on primitives (title-block / glass); theme+density+location from `useLabPrefs`; sets `[data-theme]`/`[data-density]`.
- `Baseline.tsx` (474 LOC — split: extract pipeline rail + drawers into sibling files during migration), `CatalogTree.tsx`, `PipelineRollup.tsx`, `NextStepCoach.tsx`, `LabBridgeStrip.tsx`, `LabJobsChip.tsx` → primitives.
- `globals.css` — import `lab-tokens.css`; point `--focus-accent` → `--lab-accent`.

**Error handling.** `useLabPrefs` wraps `JSON.parse` in try/catch → defaults on corrupt storage. The shim preserves the exact `LabTheme` key set (TypeScript-enforced). **Two known shim risks, both audited before migrating:**
- *Color math on a theme field* — e.g. `withOpacity(t.ink, …)` breaks once `t.ink` is `'var(--lab-ink)'`. Mitigation: grep the lab for color manipulation of `t.*`; replace with CSS `color-mix(in srgb, var(--lab-ink) 25%, transparent)` (theme-reactive — an upgrade over hex math); expose a `raw` companion only where JS genuinely needs a parseable value.
- *Truthiness branches on a theme field* — e.g. `Baseline.tsx:278` does `t.gridLine ? {backgroundImage…} : {}` to draw the schematic grid only in Blueprint. If `gridLine` became a constant `var()` string it would be truthy in Studio too, wrongly drawing the grid on dark. Mitigation: move the schematic grid to **CSS** — a `--lab-grid-image` token (the layered-gradient in Blueprint, `none` in Studio) applied on the canvas element — and delete the JS branch. `t.gridLine` then keeps its real color-or-null value for any remaining reader, but the grid no longer depends on it.

**Testing.** Existing lab tests query by role/text/testid (`harness-lab-ready`, `step-dot-stamp-*`, drawer testids) — migration preserves structure + testids, so they stay green. New unit tests: `useLabPrefs` (persist/restore + corrupt fallback), `useRovingFocus` (arrow/Enter via `userEvent`), each primitive (render + variant + focus-ring class), shim wiring (`LabTheme` fields resolve to `var(--lab-*)`; attribute flip is structurally inert). Pre-existing reds not owned here: `CliProduce.test.tsx` tsc errors and `LayoutLab.test.tsx` "Attributes"/"13-13" failures.

**Verification (no screenshots in this environment).** Per ring: `npm run test` + `tsc` + `eslint` clean, then the live Turbopack dev probe (curl the running server → assert HTTP 200 + `harness-lab-ready` + a fresh `Compiled` marker + zero error strings). Pixel-level taste needs the user's eyes, so the diff lands **one reviewable ring per commit**.

---

## Build sequencing (rings — each green + shippable)

1. **Foundation:** `lab-tokens.css` + compat shim in `theme.ts` + the color-math audit/`color-mix` migration. (Everything re-skins; nothing structural changes.)
2. **Primitive kit + hooks:** `ui/*` + `useLabPrefs` + `useRovingFocus`, with their tests.
3. **Chrome:** rebuild `LayoutLab` header as title-block / glass on primitives; wire density + prefs.
4. **Nav rail:** `CatalogTree` → primitives + roving focus + collapsible groups.
5. **Pipeline rail + drawers:** extract from `Baseline`, migrate to primitives + motion.
6. **Framing surfaces:** `PipelineRollup`, `NextStepCoach`, `LabBridgeStrip`, `LabJobsChip`.
7. **Motion + transitions:** view-swap `AnimatePresence`, list-entrance stagger, reduced-motion pass.

---

## Out of scope (explicit)

- Command palette (⌘K) — deliberately cut.
- Rewriting the ~13 Items step components / `ArchetypeStep` / one-shot panels — they inherit theming via the shim; opportunistic primitive migration only.
- The legacy shell (`AppShell`) — untouched; remains the escape hatch.
- Changing the IA (Catalogs/Matrix/Canon) or adding new views.
- The View Transitions API (possible later enhancement; framer-motion is the v2 choice).
- Any non-lab app surface (modules, evaluator, etc.).
- New runtime dependencies.
