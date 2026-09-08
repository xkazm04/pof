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
