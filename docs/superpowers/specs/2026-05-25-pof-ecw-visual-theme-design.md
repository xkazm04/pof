# ECW Visual Theme Pass — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Sub-project A of the ECW Shell UX upgrade (B = Overview surface, C = rich per-catalog Logic — separate specs). ECW-only; the legacy shell keeps its own look.

## Goal

Fix ECW readability. Root causes (from the design-system analysis): surface tokens are nearly identical (`--background #0a0a1a` / `--surface #111128` / `--surface-deep #0d0d22` differ by 3-7 of 255 → cards never separate from the page); `--text-muted` is too dim; and ECW renders *content* in tiny muted monospace (62× `text-2xs`, 61× `font-mono`, 89× `text-text-muted`, 32× uppercase) where legacy used larger sans + accent for hierarchy and reserved mono for code.

## 1. Token ladder (`src/app/globals.css`)

A real 3-step dark elevation + brighter muted text. The biggest win for ~6 lines — every surface that reads these vars lifts automatically.

| Token | Current | New | Role |
|---|---|---|---|
| `--background` | `#0a0a1a` | `#0a0a16` | page floor (darkest) |
| `--surface-deep` | `#0d0d22` | `#14142c` | insets / wells |
| `--surface` | `#111128` | `#1e1e3a` | raised cards — clearly above the page |
| `--surface-hover` | `#1a1a3a` | `#2a2a4e` | obvious hover |
| `--border` | `#1e1e3a` | `#30305a` | visible separators |
| `--text-muted` | `#7d82a8` | `#9aa0c4` | secondary text stops disappearing |

`--text #e0e4f0` and the accent (`--setup #00ff88`) stay. If any token name above doesn't exist verbatim in globals.css, map to the closest existing one (the plan verifies exact names first).

## 2. Typography convention

Documented as a comment block in globals.css (one rule future components follow), then a targeted className pass over `src/components/ecw/**`:

- **Content** (entity names, stat values, descriptions, card bodies): `text-sm` or `text-xs` **sans**, `text-text`. This is the core fix — replace `text-2xs font-mono text-text-muted` used for readable content.
- **`font-mono` reserved** for IDs, asset/content paths, code, raw JSON, keybindings only.
- **Section eyebrow labels** ("Production Pipeline", "Cross-links", card section headers): may stay small/uppercase/tracking, but use the (now brighter) `text-text-muted`; do not shrink content to match them.
- **Card titles**: `text-sm font-semibold text-text` (contrast, not muted).
- **Accent for hierarchy**: active states + a subtle per-card accent (e.g. a left-border in `MODULE_COLORS` / `var(--setup)`) so domains read at a glance. No hardcoded hex — use `chart-colors` / CSS vars (repo lint rule).

## 3. Scope & order

1. `globals.css` tokens + the convention comment (instant, app-wide lift).
2. className pass on the highest-traffic ECW surfaces, in this order: catalog sidebar (`EntityTree`, `CatalogRow`), Mission Control cards (`mission/*`), inspector (`EntityHeader`, `EntityLifecyclePanel`, `EntityCrossLinksPanel`, `TrackTabStrip`, workspaces), CLI rail (`CliRail`, `SessionRow`). ~40-60 mechanical edits, committed in small batches.

Legacy (`src/components/modules/**`, `src/components/layout/**`) untouched.

## 4. Architecture / data flow

Pure presentation — no state, store, API, or behavior changes. CSS variables already flow through Tailwind's theme mapping (`bg-surface`, `text-text-muted`, etc.), so token edits propagate without touching components. The className pass only swaps Tailwind utility classes.

## 5. Error handling / testing

No runtime behavior changes. Token edits are CSS-only. className edits are mechanical; existing tests assert text **content** (not classes or font sizes), so the ECW test suite must stay green at every step — that is the regression gate. No new tests are required (pure visual); a brief manual smoke (`npm run dev`) confirms cards separate from the page and content is legible.

## 6. Out of scope

Layout restructuring; the Overview surface (B); rich Logic editors (C); legacy-shell theming; the 3 pre-existing `AssetInspector` tsc errors.

## Invariants

Branch-local commits; `@/` imports; no hardcoded hex (chart-colors / CSS vars); co-author every commit `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`; each batch ends with the ECW vitest suite green + eslint clean on touched files.
