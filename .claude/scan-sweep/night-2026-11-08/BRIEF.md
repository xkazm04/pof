# scan-sweep night 2026-11-08 — round-agent brief (read fully before starting)

You are a ROUND AGENT in a director-run `/scan-sweep --optimize` loop over the PoF repo
(`C:\Users\kazda\kiro\pof`, branch `master`, a SHARED checkout: up to 3 sibling agents
work in it at the same time on other contexts). The director owns every shared file and
integrates after the wave. You own ONE round: your assigned context(s), nothing else.

The method is `C:\Users\kazda\.claude\skills\scan-sweep\SKILL.md`. Read §4 (Survey, then
judge), §5 (Routing: lanes A/B/C, size, vetoes) and §7 items 1-8 before you read code.
Strategy is **optimize**: QUALITY of what exists — hardening, debt, coverage, measured
performance, docs-vs-code, observability. Every claim carries a count (SKILL.md "--optimize").
"Cleaner" with no figure is `not-better`, never built.

## Your scope
- Your context(s) and their `file_paths` are in the task message. Take the file list from
  `context-map.json` (`contexts[].name` / `file_paths`), stay inside it. A coupled test, doc
  or the one caller a fix REQUIRES may be touched (name it in the commit body) — §5 veto 1.
- Over ~60 files: read the deep tier's surface fully, sample the rest, and say
  `DEGRADED: sampled N of M files` in your reply.
- Prior awareness: `.ai/registry-map.json` row for your context (subjects + recorded
  `deviation`s — do not rediscover those), `.ai/applied.jsonl`, and the never-re-propose
  titles in `.claude/scan-history/bakeoff-2026-10-13/open-backlog.jsonl`.
- Registry: use the `ai-registry` MCP (`registry_query`, then `registry_read` on ONE path)
  for the governing subject; lenses judge against its techniques (SKILL.md §3, §6).

## Budget and yield
Up to 16 findings (§4.4). A context of >=10 files should yield ~8-16; under 8, do the §4.8
extra pass. Hunt PAIRS (two implementations of one rule, one fixed) and hand-maintained
lists (§4.6-4.7). "Unused/dead" needs its zero-consumer grep in evidence.

## Build: Lane A only
Lane A = `better` by gate or probe, Gate none (or policy-tighten / in-tree contract with a
verifier), XS/S or M with risk <=3, inside your paths. For each: write the failing test
FIRST and watch it fail, fix, watch it pass, commit — one commit per finding. Everything
else (Lane B, Lane C) is a CARD, not code.

## Gates — assert exit codes; never pipe a gate into tail/grep before `&&`
Run each on its own. NEVER chain a commit after a gate with `;` — only `&&`, or check the exit code explicitly before committing (a `;` chain committed over a red typecheck in wave 10).
1. Targeted tests: `npx vitest run <your test files and the existing tests for the files you touched>`
2. `npx eslint <files you touched>`
3. `npm run typecheck > "$TEMP/tc-<slug>.txt" 2>&1; echo TC=$?` then compare failing PATHS
   against your files. **The whole-tree typecheck is currently red for foreign reasons**:
   untracked `src/components/modules/visual-gen/asset-viewer/AssetInspector.tsx` and
   `src/lib/dzin/advisor/**` (another session's WIP) — and a sibling agent mid-edit can add
   more. A red gate whose failing paths are none of yours is not yours; one that names your
   file IS yours and blocks the commit.
Known foreign test red: `src/__tests__/app/shell-surface-map.test.tsx` fails on the
gitignored local `src/app/orrery-harness/page.tsx` — not yours, do not "fix" it.
Do NOT run the full vitest suite, e2e, `npm run dev`, builds, or anything hitting the network
or a paid API. The director runs the combined gate after the wave.
Hash-pin tests exist (e.g. `src/__tests__/lib/audio-scene-audition.test.ts`): if your fix
changes pinned output, re-pin ONLY the files your fix changes and say so in the commit body.

## Git — shared checkout, these are bans
- Never `git stash`, `git reset`, `git checkout -- <others' files>`, `git add -A/./-u`,
  `git commit -a`, never push, never `--no-verify`.
- Commit by pathspec: `git add <your NEW files>` then
  `git commit -m "<msg>" -- <every path of this fix>`. Then confirm `git log --oneline -1` is
  yours and `git show --stat HEAD` lists only your files. A sibling may commit between your
  calls — that is fine; **NEVER use `git commit --amend` at all** (HEAD may be a sibling's commit by the time you amend — this happened in wave 4). A wrong commit is fixed by a NEW commit (or `git revert <your sha>`).
- Never touch untracked files you did not create (the list in `git status` at start is
  foreign WIP). Do not edit a file a sibling has dirty (`git status --porcelain` shows it
  modified and it is not yours) — wait or skip.
- Commit message: `fix(<context>): <title>`; body: `Lens: <key>`, `Before: … After: …`
  (re-measured), any coupled path, and end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Many sources are CRLF. Prefer the Edit tool; after a scripted edit, check
  `git diff --stat` equals `git diff --stat --ignore-all-space`.
- Python `open()` on Windows defaults to cp1252 and corrupts non-ASCII (·, —, →) in scripted
  edits — always `encoding='utf-8'`, or use the Edit tool.
- Never author regex through a shell heredoc (§7.6); source-scanning tests strip comments
  first (§7.8). No caches inside the repo (§7.7).
- Repo conventions: `@/` imports, `logger` not console, no hex colors (`@/lib/chart-colors`),
  `UI_TIMEOUTS`, `apiSuccess/apiError`, tests in `src/__tests__/`, no jest-dom matchers,
  add your own `afterEach(cleanup)` in component tests.

## Files you must NOT write (director-owned)
`.claude/scan-history/**`, `.personas/**`, `.ai/consults.jsonl`, `.ai/registry-leads.jsonl`,
`.ai/registry-map.json`, `.claude/fleet-memory.md`, `context-map.json`, `docs/` unless the
fix itself requires a doc change in your area.

## Your one shared-file write: your findings file
Write every NOT-built finding (Lane B and C) to
`.claude/scan-sweep/night-2026-11-08/<slug>.jsonl` (slug = your context name, or the
first name for a pair), one JSON object per line, in the SKILL.md §9 finding shape:
`{"type":"finding","skill":"scan-sweep","lens":…,"context":…,"title":…,"body":"## Summary\n…\n\n## Description\n…\n\n## Flow\n- …\n\n## Expected impact\n…\n\n## Evaluation\nClaim: …\nBefore: …\nAfter: …\nMethod: …\nResult: …\nGate: …","evidence":…,"size":…,"effort":n,"impact":n,"risk":n,"result":…,"method":…,"gate":…,"disposition":"backlog","lane":"B|C","instrument":"<what would decide it — REQUIRED for lane B>"}`
Write it BEFORE you reply. Do not write `not-better` findings (they go in the reply only).

## Reply (final message) — exactly this shape, nothing long
```
CONTEXT: <name(s)>
METHOD: full | DEGRADED: <why>
REGISTRY: <domain/subject> | none
BUILT: <sha> <title> — <Before -> After>   (one line each)
REJECTED: <title> — <Before vs After>      (one line each)
CARDS: <n> lane B, <n> lane C -> <findings file path>
SNAPSHOT: {"at":"<ISO>","scope":"<context>","mode":"resolve","strategy":"optimize","lens_keys":[…pointed-at lenses…],"lens_no_surface":[…],"lenses":n,"findings":n,"fixed":n,"auto":"a/r/e","lanes":"A:n/B:n/C:n","ab":"0/0/0/0/0","fp":n,"carried":0,"escalations":0,"leads":0,"degraded":bool,"note":"<<=80 chars>"}
CONSULT: {"ts":"<ISO>","bundle":…,"subjects":[…],"techniques":[…],"deviations":n} | none
LEADS: <registry-lead JSON lines per SKILL.md §6, or none>
GATE NOTES: <anything the director must know: foreign red paths, a gate that was wrong, files skipped as sibling-dirty>
```
One SNAPSHOT line per context (a pair gives two lines).
`lens_keys` / `lens_no_surface` use ONLY the lens keys defined as headings in
`C:\Users\kazda\.claude\skills\scan-sweep\references\lenses.md` (e.g. accessibility-checker,
not "accessibility"); the coverage picker counts those keys, so an invented name earns nothing.

## Scratch scripts
The session scratchpad is shared by siblings: keep any helper script in your OWN subfolder named after your slug (wave 21 had a landing script overwritten by a sibling).

## Adding a guard or changing a route's entry
After adding `requireOperator` (or anything reading request headers/shape) to a route, run EVERY test that imports that route — `grep -rl "api/<route>/route" src/__tests__` — including older suites with hand-built stub requests (wave 22: a stub without `headers` broke 14 cases that only the combined gate caught).
