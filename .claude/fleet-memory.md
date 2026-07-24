# Fleet Shared Memory

One line per entry, append-only, newest last. This file is the cross-session
memory for parallel Claude sessions working in this repo: **key decisions,
deliveries, and reusable conventions only** — never logs, never file dumps.
Cap: keep the file under ~200 lines; when it grows past that, the oldest
DELIVERED lines are the ones to prune (decisions and conventions outlive them).

Format (one line, no wrapping):

```
- [YYYY-MM-DD] [area] KIND: one sentence
```

KIND is one of:
- `CONVENTION` — a reusable pattern or primitive future sessions should follow
- `DECISION` — a choice with a reason that others must not silently contradict
- `DELIVERED` — a completed piece of work worth knowing about

## Entries

- [2026-07-24] [shared] CONVENTION: use the shared Tooltip primitive (src/components/ui / shared) instead of title= attributes for hover help.
- [2026-07-24] [a11y] CONVENTION: loading/error/empty states use live regions (aria-live=polite) and honest copy — no silent spinners, no fake-empty on fetch failure.
- [2026-07-24] [a11y] CONVENTION: interactive lists/filmstrips get listbox/option roles with keyboard navigation; visible focus rings are required.
- [2026-07-24] [catalog+pipelines] DELIVERED: 30-session fleet sweep polished status/*, catalog/*, all *Pipeline* views (retry-able failures, truthful counts, ARIA roles, keyboard operability).
- [2026-07-24] [components] DELIVERED: 13-session fleet sweep improved catalog, cli, harness, status, modules, animations, experiment-lab, studio-3d, blender-mcp, bridge-doctor, layout, shared, ui areas (merged to master 7e4f4bce).
