# DevInspector — click-to-source overlay for PoF

## Purpose

Port ascent's `npm run dev:inspect` feature into PoF: a dev-only overlay that lets a developer hover a rendered UI element and copy its source `file:line` to the clipboard, for faster navigation from the running app back into the codebase (and for handing precise locations to Claude Code).

## Non-goals

- No production impact — must be fully absent from prod builds and from plain `npm run dev`.
- No new runtime dependency beyond a dev-only, lazily-required `@babel/core` and `cross-env` for the npm script.
- No attempt to read React Fiber internals (React 19 removed `_debugSource`/`jsxDEV` source args) — source location is stamped onto the DOM at build time instead.

## Architecture

Two halves, gated purely by the `DEV_INSPECT=1` env var:

1. **Build-time (Turbopack loader + Babel plugin):** a `turbopack.rules` entry for `*.tsx`/`*.jsx`, registered in `next.config.ts` only when `DEV_INSPECT === "1"`, runs a custom loader ahead of Turbopack's own SWC compile. The loader lazily requires `@babel/core` and runs a parser-only transform (`parserOpts: { plugins: ["jsx", "typescript"] }`, no lowering) with one custom plugin that visits every `JSXOpeningElement`, and — for **host elements only** (lowercase tags: `div`, `button`, etc., since components don't reliably forward a prop to their root DOM node) — injects a `data-loc="<repo-relative-path>:<line>:<col>"` attribute, idempotently. The still-JSX code is handed back to Turbopack for normal compilation, so `data-loc` attributes land in the real DOM.

2. **Runtime (React overlay):** `<DevInspector />`, mounted in `src/app/layout.tsx` whenever `NODE_ENV === "development"` (independent of `DEV_INSPECT`, so it can self-report when mapping is off). State machine `"off" | "nav" | "armed"`, driven by a capture-phase `keydown` listener: `;` → `"nav"` (auto-reverts after 2s), `i`/`I` → `"armed"`, `Esc` → `"off"` from any state. While armed, `mousemove` walks up the DOM via `closest("[data-loc]")` to build a breadcrumb chain (`devLocate.ts`), and `pickDefaultIndex` skips PoF's shared/library folders to land on the call-site (the feature/page file that used the component) rather than a shared primitive's internal markup. Right-click copies the call-site path to the clipboard (`Alt`+right-click copies the innermost element instead); left-click is untouched so the app stays usable. Visual chrome (`devInspectorUi.tsx`) portals into `document.body`: highlight boxes + a `File.tsx:line` chip + a bottom-left HUD breadcrumb panel, each row clickable to copy. If no `[data-loc]` element exists on the page (i.e. launched via plain `npm run dev`), the HUD shows a hint to relaunch with `npm run dev:inspect` instead of silently doing nothing.

Gating is triple-layered for zero prod/normal-dev cost: `next.config.ts` only registers the loader when `DEV_INSPECT === "1"`; the loader itself rechecks the env var before requiring `@babel/core`; the overlay component only renders when `NODE_ENV === "development"`.

## Files

```
pof/
├── next.config.ts                            # + turbopack.rules registration when DEV_INSPECT=1
├── package.json                              # + "dev:inspect" script, + cross-env, @babel/core devDeps
├── scripts/dev-inspector/
│   ├── source-loc-loader.cjs                 # Turbopack loader
│   └── inject-source-loc.cjs                 # Babel plugin (data-loc injection)
└── src/app/
    ├── layout.tsx                            # + <DevInspector /> when NODE_ENV=development
    └── _dev-inspector/
        ├── DevInspector.tsx                  # keyboard state machine, hover/copy handlers
        ├── devInspectorUi.tsx                # portal-rendered HUD + highlight chrome
        └── devLocate.ts                      # pure DOM/string helpers
```

## PoF-specific adaptations (vs. ascent original)

- **Library-path skip list** (used by `pickDefaultIndex` to prefer the call site over a shared primitive's internals) reflects PoF's actual layout: `/lib/`, `/hooks/`, `/stores/`, `/components/ui/`, `/components/shared/`, `/_dev-inspector/`. Ascent's `/i18n/` and top-level `/utils/` don't apply to PoF's tree.
- **HUD chrome colors** use PoF's existing dark palette (`#0a0a1a` background, `#e0e4f0` text, existing accent tokens from `@/lib/chart-colors` where a semantic color is needed) instead of ascent's own palette, so the ESLint no-hardcoded-hex rule is respected for anything beyond the fixed dark-overlay chrome itself (the overlay's own base panel background/border, like ascent's, may keep small fixed hex values since it's a dev-only debug surface outside the app's chart/status color system — but any *status-like* color, e.g. the "mapping OFF" warning, should use existing status tokens).
- No `i18n` or `utils` folder concepts exist in PoF, so those two entries are simply dropped rather than mapped to something else.

## Data flow

```
npm run dev:inspect → DEV_INSPECT=1
  → next.config.ts registers turbopack.rules for *.tsx/*.jsx → source-loc-loader.cjs
    → (per file) @babel/core parser-only transform + inject-source-loc.cjs plugin
      → data-loc="path:line:col" added to host JSX elements
        → Turbopack/SWC compiles normally → attrs land in real DOM
          → <DevInspector/> (mounted whenever NODE_ENV=development)
            → ";" then "i" arms it → mousemove builds breadcrumb chain via closest("[data-loc]")
              → right-click → pickDefaultIndex (skips lib/hooks/stores/ui/shared) → clipboard
```

## Testing

- No new automated test suite is warranted — this is a dev-tooling feature invisible to production and to `npm run dev`, matching ascent's approach (no tests there either).
- Manual verification: `npm run dev:inspect`, confirm `data-loc` attributes appear in the DOM inspector, confirm `;` → `i` arms the overlay, hover highlights the call-site element, right-click copies `path:line` to clipboard, `Esc` disarms. Then confirm plain `npm run dev` shows no `data-loc` attributes and the HUD (if you manually trigger it) shows the "mapping OFF" hint instead of erroring.
- Confirm `npm run build` / `npm run typecheck` / `npm run lint` are unaffected (no new files reachable from the production bundle; `next.config.ts`'s conditional keeps the loader rule out of the graph without `DEV_INSPECT`).
