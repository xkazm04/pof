# One-click Design Story — shareable stakeholder pitch

**Date:** 2026-05-28
**Backlog item:** `idea-04c80616-one-click-design-story-shareab`
**Status:** Design approved — ready for implementation plan

## Problem

`exportGDDAsMarkdown` already assembles the full project narrative, but a `.md` file
is an engineer artifact. There is no way to hand a publisher, investor, or new teammate
something they can read with zero context. The GDD view only offers Export .md / Copy.

## Goal

Add a one-click **Export Pitch** beside Export .md that turns the synthesized
`GDDDocument` into a polished, self-contained single-page HTML a non-technical
stakeholder can read cold: a hero band with the key stats, a plain-language status
line, the roadmap, the section narrative, and rendered system diagrams. The file is
print-friendly so the recipient gets a PDF for free via the browser's Print dialog.

Non-goals (YAGNI): server-side PDF generation (no puppeteer/headless-chrome dependency
this sprint — `@media print` covers it); editing the GDD synthesis; new data sources.

## Decisions (from brainstorming)

- **Diagrams:** embed `mermaid@11` from a CDN with `startOnLoad`. The `.mermaid` divs
  are styled monospace boxes, so when the CDN is blocked/offline the diagram **source
  stays readable** (graceful fallback); online, mermaid replaces it with SVG.
- **Delivery:** download a self-contained `<project>-pitch.html` (mirrors the Export .md
  flow). Includes `@media print` styles → browser Print → PDF.

## Architecture

A new pure module renders the HTML; the route/hook/view wire it in mirroring the
existing markdown export path. No change to `gdd-synthesizer.ts`'s synthesis or types.

### 1. `src/lib/gdd-pitch.ts` (new) — `exportGDDAsPitchHTML(gdd: GDDDocument): string`

Returns a complete `<!DOCTYPE html>` document:

- `<head>`: `<meta charset>` + `<meta viewport>`, `<title>`, and an inline `<style>`
  (no external stylesheet) — hero band, stat-card grid, section cards, styled tables,
  `.mermaid` fallback box, and `@media print` rules (hide nothing essential, avoid page
  breaks inside cards, black-on-white friendly).
- **Hero band:** `gdd.title`, generated date, a tagline ("Action RPG · Unreal Engine 5"),
  and a stat-card band from `gdd.stats`:
  - Feature Implementation — `implemented/total` with a `%` progress bar
  - Development Checklist — `checklistDone/checklistTotal` with a `%` bar
  - Levels (`levelCount`), Audio Scenes (`audioSceneCount`), Builds (`buildCount`),
    Eval Findings (`evalFindingCount`) — number + label cards.
- **Plain-language status line** derived purely from the two percentages, e.g.:
  - both 0% → "Concept stage"
  - feature% < 40 → "Early production — core systems underway"
  - feature% < 80 → "Mid production — systems coming together"
  - else → "Feature-complete — polishing"
- **Sections:** for each `gdd.sections[]`, render `title` + `mdToHtml(content)` and, when
  `section.mermaid`, a `<div class="mermaid">` containing the escaped source. Recurse
  into `subsections` (rendered as nested cards/headings).
- **Diagram script:** before `</body>`,
  `<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'; mermaid.initialize({ startOnLoad: true });</script>`.

#### `mdToHtml(md: string): string` (private, pure)

A minimal markdown→HTML converter mirroring the view's `MarkdownBlock` logic but
emitting HTML strings: GitHub-style tables (`| … |` + `---` separator), `#`/`##`/`###`
headings, `- ` lists, `**bold**`/`*italic*`, and paragraphs. **All text is HTML-escaped**
(`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`) before insertion, so GDD content cannot inject
markup. Mermaid source is escaped the same way — the browser decodes the entities back
into `textContent`, which mermaid parses correctly.

### 2. `src/app/api/game-design-doc/route.ts`

Add a branch in `POST`:

```ts
if (action === 'export-pitch') {
  const gdd = synthesizeGDD(projectName ?? 'Untitled Project', checklist ?? {});
  return apiSuccess({ html: exportGDDAsPitchHTML(gdd), title: gdd.title });
}
```

### 3. `src/hooks/useGameDesignDoc.ts`

Add `exportPitch(): Promise<string | null>` mirroring `exportMarkdown` (POST
`export-pitch`, returns `data.html`); add it to `UseGameDesignDocResult`.

### 4. `src/components/modules/evaluator/GameDesignDocView.tsx`

Add an "Export Pitch" button beside "Export .md" (lucide `Presentation` icon,
`exportingPitch` state). Its handler calls `exportPitch()` and downloads
`${projectName}-pitch.html` as a `text/html` blob — mirroring `handleExport`.

## File-by-file impact

| File | Change |
|------|--------|
| `src/lib/gdd-pitch.ts` | **new** — `exportGDDAsPitchHTML` + private `mdToHtml` |
| `src/app/api/game-design-doc/route.ts` | **modify** — add `export-pitch` action |
| `src/hooks/useGameDesignDoc.ts` | **modify** — add `exportPitch` |
| `src/components/modules/evaluator/GameDesignDocView.tsx` | **modify** — Export Pitch button + download handler |
| `src/__tests__/lib/gdd-pitch.test.ts` | **new** — pure HTML-generation tests |

## Test plan (TDD)

`gdd-pitch.test.ts` with a small `GDDDocument` fixture (title, stats, one section with a
markdown table + a `mermaid` string, plus a section whose content contains a literal
`<script>` to prove escaping):

1. Returns a full HTML doc — contains `<!DOCTYPE html>`, `<html`, and `gdd.title`.
2. Hero stats present — e.g. the `3/10` feature count and a checklist figure render.
3. A markdown table in content becomes an HTML `<table>` with `<th>`/`<td>`.
4. `<div class="mermaid">` is emitted carrying the section's mermaid source.
5. The mermaid CDN `<script ...mermaid@11...>` tag is present.
6. **Escaping:** a `<script>alert(1)</script>` in content appears escaped
   (`&lt;script&gt;`), not as a raw tag.

Run `npm run validate` before completion (expect pre-existing foreign failures in the
shared tree; my files must be clean — typecheck + lint + the new test green).

## Risks

- **Self-contained vs. rendered tension:** resolved by mermaid-CDN + readable source
  fallback — works offline (source) and online (SVG).
- **Shared tree:** all four target files (`gdd-pitch.ts` is new; route/hook/view) are
  currently clean (not foreign-modified) — verified before starting.
