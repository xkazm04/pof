# 09 · Core Engine Generator — Studio-grade UI/UX

Dimension 1 of the polish pass: make the catalog/authoring surface feel like a
**AAA studio's internal tooling** — dense but breathable, asset-forward, fast,
and visually coherent. The bar is Linear/Raycast/Unreal-Editor polish, applied
to game-asset authoring. This is a Round-1 foundational deliverable (the design
system + chart primitives) plus a craft standard every section honors.

Grounded in what's already installed: `framer-motion` (motion), `react-window`
(virtualization), **`@react-three/fiber` + `@react-three/drei` + `three`** (real
3D previews), `shiki` (code preview), `lucide-react` (icons), `sonner` (toasts),
`markdown-to-jsx`, and the `src/lib/chart-colors.ts` palette + `src/components/ui/`
primitives. **No charting/node-graph lib is installed** — a deliberate decision
point below.

## 1. A real design-token system (extend `chart-colors`)

`chart-colors.ts` already centralizes color (status, rarity, module accents,
heatmap). Promote it to a full **token layer** (`src/lib/design-tokens.ts`) so
every surface is consistent and themeable:

- **Color** — keep `chart-colors` as the source; add semantic *roles*
  (surface/raised/overlay, text/muted/faint, line/divider) as CSS variables so
  components never hardcode.
- **Space** — a single scale (4·n: 4/8/12/16/24/32…); no ad-hoc paddings.
- **Type** — a type ramp (display/title/body/caption/mono) with line-heights;
  mono (for IDs/paths/code) is first-class in a dev tool.
- **Elevation** — 3–4 shadow/border tiers for the multi-pane + drawer stack.
- **Radii & borders** — one radius scale; hairline borders for density.
- **Motion** — durations/easings as tokens (consume the existing `motion.ts`
  presets) so every transition feels of one hand.

A small **component gallery** route (`/dev/gallery`, dev-only) renders every
primitive + token so drift is visible and reviewable — the cheap enforcement of
"studio-grade consistency."

## 2. The catalog as a visual experience

The catalog is the product's face; it must read like an asset library, not a
spreadsheet:

- **Asset cards (gallery mode)** for visual catalogs (Spellbook, Bestiary,
  Items): icon/thumbnail, name, a **rarity frame** (reuse `chart-colors` rarity:
  common→legendary border/glow), lifecycle chip, a 1-line stat strip. Hover →
  quick-preview popover (bigger art + key stats) without opening the drawer.
- **Table/row mode** for data-dense catalogs (Loot Tables, Combat Map) with the
  same tokens.
- **Rarity & lifecycle as visual language**, not just text: legendary items get
  an amber frame + subtle glow; `failed` lifecycle gets an error hairline + icon;
  `verified` a quiet green check. Color does the scanning work.
- **3D asset preview (leverage `@react-three/fiber` + `drei`).** For meshes /
  characters / props, the detail drawer renders a **live 3D viewport** (orbit,
  default-lit) of the actual UE-exported/preview mesh — studio-grade asset
  inspection in-app. Lazy-loaded (see [`code-standards.md`](code-standards.md))
  so it never bloats the catalog list bundle.
- **Material swatches** (sphere preview) and **code preview** (generated C++/
  Python via `shiki`) in the drawer's "what was generated" tab.

## 3. Visual charts & viz — per section

The operator explicitly wants strong **visual charts**. Each section's "section
view" is a purpose-built visualization over its catalog; build a small shared
**viz primitive layer** (`src/components/viz/`) so they're consistent and reused:

| Section | Signature visualization | Primitive |
|---|---|---|
| Spellbook | ability **stat bars / radar** (damage, cost, cooldown) + grid codex | `StatBars`, `Radar` |
| Loot Tables | **weighted drop-rate** bar / treemap (entry → % chance) | `WeightedBar`, `Treemap` |
| Combat Map | **relationship graph** (attacker→ability→reaction) + **damage heatmap matrix** | `NodeGraph`, `Heatmap` |
| Bestiary | monster cards + **stat charts** + tier/level distribution | `StatBars`, `Histogram` |
| Items | inventory grid + **affix bars** + rarity distribution | `StatBars`, `Donut` |
| Screen Flow | **screen-transition graph** (push/pop/replace) | `NodeGraph` |
| Zone Map | **zone hierarchy / spatial map** (region▸zone▸encounter) + spawn density | `NodeGraph`/`TreeMapSpatial` |
| State Graph | **animation state machine** (states + transitions) | `NodeGraph` |

**Build vs. buy decision (deliberate):**
- **Simple charts** (`StatBars`, `Radar`, `WeightedBar`, `Heatmap`, `Donut`,
  `Histogram`, `Treemap`): build as **custom SVG** consuming `chart-colors` —
  consistent with the existing hand-rolled `ScoreRing`/`ProgressRing`/sparklines,
  zero new deps, fully on-brand, each well under 200 LOC.
- **Node graphs** (Combat Map, Screen Flow, Zone Map, State Graph): these are
  genuinely hard to hand-roll well (pan/zoom/layout/edge routing). Add **one**
  lightweight lib — recommend **`@xyflow/react`** (React Flow) — and **lazy-load
  it only in graph sections** so it never touches the initial bundle. Wrap it in
  a `NodeGraph` primitive themed with our tokens so the studio look holds and the
  lib stays swappable.

All viz primitives: tokenized colors, motion-aware (animate-in on data load),
legible at scale, and **virtualization-friendly** (heatmaps/matrices for 100×100
must render the visible window).

## 4. Motion & micro-interactions (purposeful, bounded)

Studio polish is mostly motion done with restraint (via `framer-motion` +
`motion.ts` tokens):

- **Layered nav transitions** — moving L3→L4→L5 (section → tree → entity) slides
  with shared-layout continuity, so the operator never loses place.
- **Detail drawer** — spring slide-in; content stays interactive immediately
  (no blocking spinner).
- **Skeletons, not spinners** — catalog list, cards, charts, and the 3D viewport
  all show shaped skeleton placeholders while loading.
- **Optimistic lifecycle** — when a generation step is dispatched, the entity's
  lifecycle chip animates to the next state immediately (pending shimmer), then
  confirms/reverts on the callback — the tool feels instant.
- **Staggered reveal** — reuse `Stagger`, but **capped** (stagger only the
  visible window; never stagger 1000 rows — see code-standards). Motion serves
  legibility, not spectacle.

## 5. Studio layout & interaction model

- **Multi-pane** within a section: `CatalogTree` (L4) │ `VirtualCatalog*` (list/
  gallery) │ `EntityDetailDrawer` (L5) — resizable, like the existing
  resizable SidebarL2. Density is the default; panes collapse for focus.
- **Command palette** (extend `GlobalSearchPanel`) — `Cmd-K` to jump to any
  entity, run a generation, or switch section. Keyboard-first throughout (the
  app already has `Ctrl-B/J/1-5`).
- **Breadcrumb** (`CatalogBreadcrumb`) always shows L1▸…▸entity and is the spine
  of orientation across hundreds of assets.
- **Bulk affordances** feel native: marquee/checkbox select → a floating
  `BulkActionBar` with the batch generate/regenerate actions.

## 6. Premium states

- **Empty** — meaningful, action-oriented (reuse `EmptyState`): "No abilities
  yet — generate your first" with a CTA, never a blank pane.
- **Loading** — skeletons matched to the eventual layout.
- **Error / `failed`** — the entity's drawer shows the captured generation error
  + the functional-test output inline (with `shiki` for logs), plus a one-click
  retry. Failure is legible and recoverable, not a dead end.
- **Toasts** (`sonner`) for batch completion / async results, respecting the
  `UI_TIMEOUTS` constants.

## What this dimension adds to the build

- A `src/lib/design-tokens.ts` layer (over `chart-colors`) + a dev component
  gallery — **Round-1 foundational**, alongside the `CatalogView` framework.
- A `src/components/viz/` primitive set (custom-SVG charts + a lazy `NodeGraph`
  wrapper) — **Round-1**, then each section composes them.
- 3D preview + code/material preview in the detail drawer (leveraging the
  already-installed `@react-three/*` + `shiki`).
- Motion, skeleton, and command-palette conventions every section inherits.

The craft rule: **color and motion do the scanning work; the operator never
faces a wall of undifferentiated rows.** All of it stays inside the
[`code-standards.md`](code-standards.md) budgets (200 LOC/file, lazy-loaded heavy
viz, virtualized everything).
