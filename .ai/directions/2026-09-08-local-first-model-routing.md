---
subject: software-engineering/model-routing + game-production/generative-provider-auditing
project: pof
raised_by: consult 2026-09-08 (operator directive: minimise Gemini, prefer local qwen/ollama, research before buying)
source: ai-registry @ eb014a00 — model-routing, generative-provider-auditing, generative-provider-routing
stage: the vision/judge seam (src/lib/anim-critique/, src/lib/visual-gen/, src/app/api/verify/*, src/app/api/agents/*)
size: 1 new chokepoint module + ~8 call-site edits / M
status: proposed
---

## The operator directive is a PERMISSION, not a calibration — and that matters

The registry's `model-routing` golden path separates two tables that look alike and are
not: the **calibrated** class→tier→effort mapping, where every entry must cite the
measurement that set it, and the **operator policy** over which providers an installation
may use at all. *"That table is not a measurement, it is a permission, and asking it to
cite evidence is a category error… Where the two disagree the permission wins, and the
record says a permission decided."*

"Use Gemini as little as possible" is the second table. It does not need a benchmark to
be legitimate and it must not be argued with by one. "Always research and try before
choosing a commercial service" is a demand on the *first* table, and the registry's
instrument for it is `arena-benchmark-protocol` + `extraction-model-bake-off`.

So the two halves of the directive land in two different places, and the code should keep
them apart: a policy table that says which vendors are admissible, and a measured plan
order within what policy admits.

## What the registry says supports the instinct

- `extraction-model-bake-off`: *"Extraction is also the capability where the local tier
  competes hardest. A generation model may be years behind its hosted equivalent; an
  extraction model only has to read what is already in front of it, and at bulk volumes
  the metered tier is the one that has to justify itself."* Nearly all of PoF's Gemini
  usage is extraction (judging a rendered frame), not generation.
- Measured in that technique: a **frontier reasoning model scored 75%** against
  hand-labelled truth where a **small local vision model scored 94%** — *"the proposed
  judge was worse than the model it was judging… Reasoning depth does not substitute for
  a purpose-built perceptual encoder."* The assumption that the paid tier judges better
  is exactly the assumption the registry says to measure.
- Sibling precedent in this fleet: `gravitone-gcloud/lib/imaging/router.ts` already runs
  `recognize: ["ollama", "google"]` local-first, and removed the Qwen **cloud** rung
  entirely on 2026-09-01 with the reason recorded in place — *"a cloud rung nobody wants
  billed is not a fallback, it is a surprise."*

## What the registry says guards against over-localising

- `capability-floors`: below a floor a capability is **not cheaper, it is broken, while
  still returning plausible-looking output**. Floors are set by observed breakage with a
  date and a recomputation trigger — *"Floored because it matters" is a budget hostage.*
- `quality-axis-separation`: a clean response proves the **transport** worked, not that
  the answer is good. On a local swap this is the whole risk surface.
- `arena-benchmark-protocol`: *"When quality and systems constraints disagree, the systems
  constraint usually wins."* Specifically **coexistence** — the local eye must share the
  box with the generator it grades. This is live for PoF, not hypothetical: on 2026-09-08
  installing `torchvision` for the local Qwen3-VL gate bumped a sibling project's venv
  from torch 2.13→2.14, and ollama's resident vision model competes for the same GPU that
  Tripo/TRELLIS local generation wants.

## Deviations found (findings, not a plan to lower the standard)

**D1 — There is no chokepoint. Call sites name the vendor.** The standard: *"No surface
outside the routing layer may name a vendor and get it."* PoF has at least seven that do —
`visual-gen/{input-gate,view-critique,style-dna,footage-gate,reference-conformance,
generators/scene-decompose}.ts` each default to `makeQwenVision()`, and
`api/verify/animation/route.ts:84` picks between Qwen and Gemini with an inline ternary.
This is the load-bearing deviation: it is why the local-first swap the operator wants is
a seven-file edit rather than a one-line table edit, and why no elimination is currently
recorded anywhere.

**D2 — There is no local tier in the app at all.** The ollama daemon is listening on
:11434 on this machine; `grep -ri ollama src scripts` returns nothing. The only local
model PoF actually uses is `scripts/visual-gen/pof_vlm_batch.py` (Qwen3-VL-4B via
transformers), invoked by gap-loop scripts *outside* the app's routing and acceptance.

**D3 — The app's "Qwen" is CLOUD, not local.** `src/lib/anim-critique/qwen.ts` is Alibaba
DashScope over an OpenAI-compatible endpoint. It reads as the local option and is a second
metered vendor. Any plan that says "we already moved off Gemini to Qwen" is describing a
vendor swap, not sovereignty.

**D4 — The one excellent benchmark cannot answer this question.** `qwen.ts` carries a
model-ranking record that is close to exemplary under `record-negative-benchmarks-in-place`:
dated 2026-08-22, two independent blocks, ground-truthed by eye rather than by the
generating prompt, and ranked on **false-PASS count** rather than raw accuracy because the
gate can only be too lax. But every arm is a DashScope model. There is no Gemini arm and no
local arm, so it ranks within one vendor and is silent on the operator's question.

**D5 — No capability floors are recorded.** Nothing states where judging stops working.

**D6 — Plan order has no cost-per-usable basis.** Spend is metered (`/api/cli-spend`,
`recordSpend`), which is the neighbouring discipline; what is missing is the routing-grade
number — price per output that clears the gate's own bar.

## The capability map (what would actually move)

| Capability | Today | Local candidate | Registry note |
|---|---|---|---|
| recognize — single UE frame (`verify/visual`, `ue-visual-gate`, `visualExecutor`, `ue-experiment`) | Gemini | **strong** — ollama vision, $0, pixels never leave the box | the bake-off's home ground |
| recognize — multi-frame filmstrip (`verify/animation`) | Gemini or DashScope Qwen | **needs measurement** — multi-image-in-one-call support varies per ollama vision model; that is a request-level constraint, not a preference | `non-silent-elimination`: a model that accepts N images and reads one is the worst failure this layer makes |
| recognize — gen-asset gates (`input-gate`, `view-critique`, …) | DashScope Qwen | **strong** — already has a truth set and a `passAt: 7` grader | grade every arm with the acceptance that already ships |
| forge structured JSON (`agents/forge-ability`) | Gemini | **plausible** — ollama enforces `format: <schema>` natively | `extraction-model-bake-off`: schema enforcement is a property of the ENDPOINT, verify per endpoint |
| live audio advisor (`agents/live-token`) | Gemini Live | **none** — bidirectional realtime audio has no local equivalent | register as a member WITH its reason; this is the pre-approved unique case |

## Proposed order of work

1. **Build the chokepoint first** (transplant the `gravitone-gcloud/lib/imaging/router.ts`
   shape: capability in, plan table, `prefer` reorders / `avoid` removes, every elimination
   in a trail that reaches the caller). Without it, every step below is a multi-file edit
   and no rejection has anywhere to live.
2. **Run the arena per capability**, using PoF's own acceptance as the grader — never a
   judgement invented for the occasion. The truth set already exists: the block A/B corpus
   described in `qwen.ts` plus `generated/icons/`. Arms: current Gemini, current DashScope
   Qwen, local ollama. Report per capability, never pooled; measure seconds/item and
   resident memory alongside quality; declare spend before running.
3. **Record both verdicts** — winner as the pin, losers in place beside it with numbers,
   date, harness, and the condition that would reopen them.
4. **Set floors only where breakage was observed**, each with its measurement and a
   re-test trigger on roster change.
5. **Leave `live-token` on Gemini** with the reason written at the membership declaration.

## What this proposal deliberately does NOT do

It does not pre-judge the arena. The registry's own warning applies to this document:
*"When you cannot express the reason as a measurement, the rejection is weak and should be
labelled as a preference rather than dressed as evidence."* Nothing here has measured
ollama against Gemini on PoF's frames. The claim being made is that PoF currently **cannot
run that comparison cheaply**, and that fixing the chokepoint is what makes the operator's
policy executable rather than aspirational.

---

## Amendment (operator, 2026-09-08): prompt engineering is an ARM of the arena, not a preamble

The operator's point: **image-recognition results often depend on the prompt more than on
the model's recognition capability.** For a new recognition use case, consult a current
Gemini Flash to author the prompt itself — hand it the image and the goal, and let it
propose the method — because that frequently closes the gap a naive arena would attribute
to the local model's ability.

This is not a softening of the standard; the registry already contains its strongest form.
`extraction-model-bake-off` measured it directly (2026-08-25): corrective text placed in
JSON-schema **field descriptions** was ignored outright, output byte-identical, while *the
same words in the main prompt* moved the field sharply and cut definitional contradictions
by **68%**. Its rule reads: *"Instruction channel is not a detail — it decides whether
steering lands at all. Before concluding a model cannot do something, confirm it was
actually asked in the channel it reads."* The operator's amendment extends that from
channel to authorship: before concluding a local eye **cannot** do something, confirm the
prompt was engineered rather than inherited.

It also *reduces* Gemini dependence rather than increasing it, by separating two roles that
get conflated: Gemini Flash as a **design-time prompt author** (a handful of calls, once
per use case) versus Gemini as the **runtime judge** (a call per asset, forever). Buying the
first to eliminate the second is the trade this whole direction is trying to make.

### What it changes in the protocol

`arena-benchmark-protocol` step 1 is *"one schema, one prompt, every candidate… If one
candidate is asked a friendlier question than another, the bake-off measures prompt luck."*
That constraint survives intact, so the amendment slots in as a stage BEFORE the arena, not
inside it:

1. **Author** — give Gemini Flash the representative image(s), the goal, and the acceptance
   the gate applies. Ask for the prompt, not the answer.
2. **Freeze** — the authored prompt becomes a versioned artifact of the use case.
3. **Arena** — run every arm (ollama local, qwen-cloud, gemini) on that ONE frozen prompt.
   An arm handed a different prompt is measuring prompt luck, which is the step people skip
   and the step whose omission invalidates everything after it.
4. **Re-run on re-engineering** — the prompt is an axis, so a new prompt version means a new
   arena run; results across prompt versions are not comparable and must not be pooled.

### The bias this introduces, stated so it is not discovered later

A prompt authored by Gemini may encode what Gemini finds easy to read, which would flatter
the Gemini arm. Two cheap mitigations, both already registry-endorsed:

- Keep the authored prompt as ONE arm and a local-authored (or hand-authored) prompt as a
  second, so prompt-authorship is itself a measured axis rather than an assumption.
- The verdict comes from PoF's own acceptance, never from the prompt's author — *"the
  grader is the external acceptance step"* — so a prompt that flatters an arm still has to
  survive a grader neither arm wrote.

## Progress

**Step 1 (the chokepoint) is BUILT** — `src/lib/vision/` (`types.ts`, `router.ts`,
`seam.ts`, `providers/{index,ollama}.ts`), 17 tests, TDD, every test watched failing first.
Six gates migrated from naming a vendor to naming a capability: `input-gate`,
`view-critique`, `style-dna`, `footage-gate`, `reference-conformance`, `scene-decompose`.

Deliberately NOT migrated yet, and each is a use case for step 2 in its own right:
`api/verify/animation` (the inline Gemini/Qwen ternary — multi-frame filmstrip, the
capability flagged as needing measurement), `api/verify/visual`, `ue-visual-gate`,
`test-gate-runner/visualExecutor`, `ue-experiment/runner`.

**The local rung is opt-in by construction.** `ollamaProvider.isConfigured()` is false
unless `OLLAMA_HOST` is set, so on a machine that has not opted in the plan skips it, the
skip lands in the trail, and behaviour is byte-identical to today. That is what makes the
policy safe to land before the arena has run: setting the env var is the experiment, and
nothing silently changes underneath a gate that has not been measured.

---

## Step 2, use case 1: `api/verify/visual` — MIGRATED, and the effort axis MEASURED

### Vendor facts (probed live, 2026-09-08, project key)

- The account can see **`gemini-3.8-flash`** (1M in / 65k out, thinking supported). The app's
  standing pin was **`gemini-2.5-flash`**, several generations behind — a stale pin is the
  registry's named failure mode ("a pin has a lifetime… so 'this pin is three years old' is a
  visible state rather than a discovery made when the endpoint starts returning errors").
  The RUNTIME pin is deliberately NOT bumped here: moving it is an arena decision, not a probe
  decision. The **authoring** role does use the newest Flash, per the operator's method.
- `thinkingLevel` accepts exactly `low` | `medium` | `high`. `none`, `minimal`, `max` and
  `unspecified` are all rejected by the endpoint. **The SDK's `ThinkingLevel` enum is BROADER
  than the endpoint** — it also declares `MINIMAL` and `THINKING_LEVEL_UNSPECIFIED`, neither of
  which the API accepts. A textbook instance of the registry's rule that enforcement is a
  property of the ENDPOINT and must never be inherited from a type or a model name.
- `thinkingBudget` (an integer cap) is also accepted but produced **zero** thought tokens where
  `thinkingLevel` produced 77 on the same probe. A cap is not an instruction; we send the level.

### The measurement, and it splits cleanly in two

**Verdict tasks: effort is INERT.** 18 calls (2 modes x 3 levels x 3 repeats), temperature 0,
on a real dark-arena frame chosen because "dim but lit" vs "black, unlit failure" is genuinely
ambiguous. Every level produced an IDENTICAL verdict, every arm was deterministic across its
repeats, and latency did not rise monotonically — while high burned 4.4–6.2x the thought tokens.
Paying for thinking on a four-boolean verdict buys nothing measurable.

**Authoring tasks: effort PAYS.** Same frame, one goal, one run per level. Low spent 0 thought
tokens and produced a generic 342-char prompt. High spent 1106 and produced one that names the
concrete discriminator (flat `#000000`), tests it RELATIVE to adjacent surfaces instead of
against an absolute darkness threshold, adds a location field so a FAIL is actionable, states
both branches of the decision rule inside the prompt, and carves out black materials that still
hold specular highlights. Low found none of that. **Sample: 3 calls — indicative, not settled,
and labelled so in the code.**

This is the registry's `effort-calibration` reproduced in the field ("more reasoning effort is
not automatically better… under a hard output cap, effort buys nothing at all") — a verdict of
four booleans IS output-capped; authoring a prompt is not.

**The operational rule, and it happens to be the cheap direction:** think HARD once at design
time (a few calls per use case, authoring the prompt), think LOW at runtime (a call per asset,
forever). Buying the rare call to avoid the frequent one is exactly the trade this whole
direction exists to make.

### What shipped

- `api/verify/visual` goes through the chokepoint; it names no vendor. `effort` is a validated
  request parameter (an unknown level is a 400, never a silent default), and the response now
  carries `provenance` — which eye answered, at which effort, whether that effort was
  downgraded, and the elimination trail.
- The no-eye case is now a 503 naming **every** eye that dropped out, instead of one env var
  that may not even belong to the eye the plan wanted.
- Effort is a routed, first-class field: providers DECLARE the levels they can serve
  (`gemini` all three; `ollama` only `low`/`high`, because its knob is a boolean `think`), and a
  request the provider cannot honour is reported as `effortDowngraded`, never quietly ignored.
- The check prompts moved to `src/lib/vision/check-prompts.ts` so the route and the arena
  import the SAME string — "one prompt, every candidate" is only enforceable if both sides read
  one artifact.
- Two arena harnesses, both declaring spend, both writing nothing production reads and pinning
  nothing: `scripts/vision-arena/effort-probe.ts` (grade arms on the frozen prompt) and
  `scripts/vision-arena/author-prompt.ts` (stage 0 — have Flash author the prompt).

### Still open on this use case

The eyes have NOT yet been raced against each other on these frames — only the effort axis was
measured, all arms Gemini. Racing `ollama` (once `OLLAMA_HOST` is set) against `qwen-cloud` and
`gemini` on the frozen prompt is the next run, and it is what would justify moving the plan's
first entry from a permission to a measurement.

---

## gravitone-gcloud sync (2026-09-08) — config adopted, lessons harvested, one blocker found

### Adopted as-is (nothing new pulled, nothing new configured)

`OLLAMA_HOST=http://127.0.0.1:11434` and `OLLAMA_VISION_MODEL=qwen3.8:27b`, copied verbatim
from `gravitone-gcloud/.env.local` into PoF's gitignored `.env`. The model was **already
downloaded** (`ollama list`: qwen3.8:27b, 17.7 GB) — no pull. Env var NAMES already matched on
both sides, so there was nothing to reconcile: `OLLAMA_HOST` doubles as the provider's "key",
which is the design PoF had already copied.

**Verified live end to end.** PoF's chokepoint served a real UE frame from the local eye —
`provider: ollama, model: qwen3.8:27b, trail: []` — and its answer was CORRECT against my own
reading of the frame (two humanoids, natural poses, distinct by colour).

### THE BLOCKER: the local eye and the game engine cannot share this card

| | gravitone (film frames, no engine) | PoF (this session, UE editor open) |
|---|---|---|
| s/frame, qwen3.8:27b | **7.0** | **42–118** |

The model is fully resident (22.3 GB in VRAM, nothing spilled), but the card reads
**24108 / 24564 MiB — 98% full**, and `UnrealEditor.exe` is running. Generation crawls at
**1.27 s/token** (73.6 s of eval for 58 output tokens), which is not GPU speed.

This is the registry's coexistence rule landing exactly where it warned it would: *"the
decisive property is often that it can COEXIST with the generator it grades… A benchmark that
measures only quality will confidently pick the model you cannot run."* Gravitone never meets
this because it has no engine; **PoF's entire purpose is driving UE**, and the editor must be
OPEN for python drains. So local-first for PoF is conditional on the editor's state in a way it
is not for the sibling repo, and that condition belongs in the plan, not in a footnote.

Not yet measured: the same call with the editor CLOSED. That is the next number to get, and it
decides whether the local eye is a first-class rung or an editor-closed-only one.

### Fixed in PoF as a direct result

- **A bug this session introduced.** PoF sent `think` on every ollama call. Gravitone's
  `probe.py` splices it onto the FIRST attempt only and retries WITHOUT it on HTTP 400,
  because *"models without a thinking mode reject the key outright"*. PoF now does the same,
  and deliberately does not retry any other status (a 5xx is the transport's problem; a 401
  fails identically forever).
- **`options: { temperature: 0, num_ctx: 8192 }`** — PoF set neither. Temperature 0 is the
  whole determinism mechanism in gravitone (no seed anywhere), measured at 100% enum stability.
- **`format` (JSON Schema) threaded through `VisionRequest.schema`** and forwarded by the
  ollama adapter, which enforces it natively. Ranked the single highest-value transplant.

### The measured result that most supports the operator's direction

Gravitone's own bake-off, 5 models x 2 ground-truth frames x 3 repeats: **`qwen3.8:27b` scored
94% against known truth where `gemini-3.7-flash` scored 81%, at the same seconds per frame** —
and qwen had the LOWEST agreement with the frontier yardstick of any model that scored well.
Their methodological punchline: *"Truth and agreement stay in separate columns — the yardstick
scored 81%, not 100%, so ranking by agreement would have mis-ranked the winner."*

Two cautions that come with it, both recorded by them: the n is **2 truth frames**, and the
local eye has a measured ceiling — *"prompt adjustments do help the local eye, but it cannot
carry fidelity grouping; keep the cloud eye for extraction, use qwen at most as a free
pre-filter."*

### Queued from the harvest, not yet done (ranked)

1. HTTP timeout + bounded retry. **PoF's vision path has no timeout anywhere** — and calls now
   measured at 118 s, so a hung daemon hangs a route handler indefinitely and the re-route
   never fires because the call never settles.
2. An error taxonomy with `dispatched`, so a 401 (fix your key), a dead daemon (start it) and a
   refusal (try another eye) stop being one `call-failed` string — and so `reroutable` can be
   narrowed to `refused | rate-limited | no-key` instead of re-routing everything.
3. `CHECK_SCHEMAS` beside `CHECK_PROMPTS` + one parse door, deleting the three hand-rolled
   fence-strippers (`verify/visual`, `anim-critique/parse.ts`, and each visual-gen gate).
4. Spend gate **denominated in metered calls, not dollars** — gravitone's own router disables
   its dollar estimate for `recognize` because both cloud eyes bill per token; copying the
   dollar gate would reproduce the bug the comment exists to prevent. PoF already has the
   durable half (`cli-spend-db.ts`); it needs a `vision` task type, not a new ledger.
5. `unreachedPlanTops()` — sharper here than in gravitone, because PoF's plan-top is the FREE
   local eye: it silently going uncalled means every judgement that window left the box.
6. Two-eye disagreement for anything that gates. Gravitone measured the two eyes disagreeing on
   the same plate with identical colour readings: *"a single vision model is an opinion, not a
   measurement."* PoF's `/status` treats single-VLM verdicts as ground truth.
7. `api/verify/animation` still names vendors in an inline ternary — the last hole in the
   chokepoint, and it is the route that runs the aesthetic gate.

---

## The eye race, editor CLOSED (2026-09-08) — the local eye is a first-class rung

### First: the editor was the whole problem

| | UE editor OPEN | UE editor CLOSED |
|---|---|---|
| eval speed | **1270 ms/token** | **67–191 ms/token** |
| a 58-token verdict | 42–118 s | 4.4–7.2 s warm (30.8 s cold; 22.1 s of that is model load) |

GPU with the editor closed: 1051 / 24564 MiB before the model loads, 22.3 GB resident after.
With the editor open the card sat at 24108 / 24564 — 98% — and generation ran ~7–19x slower.
Nothing was spilled to CPU in either case; the contention alone did it.

**So the coexistence constraint is real but conditional, not fatal.** Local-first is viable for
PoF; it is simply not viable *while the editor is open*, which matters because `/drain-python`
requires the editor open and `/drain` requires it closed. Those two are already mutually
exclusive, so the honest statement is: the local eye belongs to the editor-CLOSED half of PoF's
work, and the plan should say so rather than implying it is unconditionally first.

### The race — one frozen prompt, three arms, scored against hand-labelled truth

Truth set: 3 cases, labelled by eye, **including a negative control** (a pure `#000000` frame —
the unlit-geometry failure in unambiguous form). A truth set of only passes cannot tell a
working eye from one that always says pass, which is the error this class of gate exists to
prevent and the only one that is silent.

| arm | model | truth | falsePASS | falseFAIL | structural | determinism | ms/frame |
|---|---|---|---|---|---|---|---|
| **ollama (local)** | qwen3.8:27b | **6/6** | **0** | 0 | 0 | **3/3** | ~5–20 (variable) |
| qwen-cloud | qwen3.7-flash | 5/6 | 0 | 1 | 0 | **2/3** | ~32–50 s |
| gemini | gemini-2.5-flash | **6/6** | **0** | 0 | 0 | **3/3** | **~3.1 s** |

**The local eye matched the best cloud eye exactly** — same truth score, zero false passes, zero
structural faults, fully deterministic — at $0, with no pixel leaving the machine. On this
evidence the plan's local-first ordering stops being only a permission and becomes a
measurement, for THIS use case, with the editor closed.

**qwen-cloud is the arm to reconsider.** It scored 5/6 with a false FAIL (called a natural
standing pose T-posed and failed the frame), and it was the only **non-deterministic** arm —
2/3 stable, and it disagreed with itself between two runs of the identical request at
temperature 0. That is expected once you read `anim-critique/qwen.ts`: it walks a five-model
fallback chain on quota signals, so "qwen-cloud" is not one model and repeat calls are not
guaranteed to reach the same weights. It is a metered rung that is both slower and less
reproducible than the free local one. Gravitone reached the same conclusion independently and
removed its Qwen cloud rung on 2026-09-01: *"a cloud rung nobody wants billed is not a
fallback, it is a surprise."*

### Open question, recorded rather than guessed

Local latency is VARIABLE in a way Gemini's is not: 67, 69, 119, 120, 160, 191 ms/token across
runs with the model resident and the editor closed — a ~3x spread on identical requests. Schema
enforcement is not the cause (`format` on vs off: 19.9 s vs 15.5 s, both 96 output tokens), and
neither is model load (measured separately at 22.1 s, and these runs were warm). Not chased
further this session. It matters because a p50 of ~5 s and a p95 of ~20 s are different products
when a gap-loop batch judges hundreds of frames, so the next measurement worth taking is a
distribution rather than another mean.

### What this does NOT license

One truth set of three cases, two of them from one capture session, on two of the four check
modes. It says the local eye is not disqualified and is worth routing first with the editor
closed. It does not say it equals Gemini in general — gravitone measured a real ceiling on a
harder task (*"it cannot carry fidelity grouping; keep the cloud eye for extraction, use qwen
at most as a free pre-filter"*), and `hud` and `texture` modes have not been raced at all.
