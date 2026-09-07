# Grounding generated engine calls in retrieved tool docs — spec

> Sources: **AutoUE** (arXiv 2603.07106, ACL Findings 2026) and **BlenderRAG** (arXiv
> 2605.00632). Written by `/research` 2026-09-07. Status: **spec, not built.** L.

## The claim, with numbers

Both papers attack the same failure — an LLM writing engine API calls from memory invents
parameter names, node types and function signatures — and both fix it the same way: retrieve
the relevant chunk of the *tool's own documentation* and inject it into the prompt at the point
of generation.

- **AutoUE** segments UE tool documentation into chunks, retrieves the top-*c* by cosine
  similarity **per node being generated** (not once per task), and generates that node's
  attributes and pin connections against the retrieved chunks. Its PCG-graph ablation reports
  **100% node creation, 100% parameter filling, 100% pin connections**, graph quality 8.42/10.
  Removing the grounding (or the templates/constraints) produced "consistent fail to compile".
- **BlenderRAG** indexes only **500 curated examples** (50 object categories × 10 variations,
  each a description + validated `bpy` code + a render) in Qdrant with Nomic embeddings, and
  injects the **k=3** nearest as context. Measured lift: **compilation success 40.8% → 70.0%**,
  CLIP semantic alignment **0.409 → 0.774**, across four different LLM backends.

The BlenderRAG number is the load-bearing one for PoF: **500 hand-validated examples**, not a
scraped corpus, produced a 29-point compile-rate lift. That is a tractable amount of curation.

## Where this attaches in PoF

PoF's `python-api-introspect-first` gotcha already tells a session to introspect the API before
guessing names — that is the *runtime* version of this idea and it works, but it costs a probe
round-trip per unknown symbol and only helps a session that remembers to do it. Retrieval is
the *prompt-time* version and composes with it.

The three surfaces that emit engine API calls, in priority order:

1. **`tools/pof-mcp/src/tools/`** — the Node MCP adapter. Highest value and the only one with a
   backend-free Layer-0 gate (`cd tools/pof-mcp && npm run build && npm test` — note
   `npm run validate` does NOT reach `tools/`).
2. **`src/lib/prompts/` + `module-registry.ts`** — checklist and task prompts that ask for UE
   Python. Retrieval would append a `## Verified API Excerpts` block alongside the existing
   `## Known UE Pitfalls`.
3. **mcp-unreal / the bridge**, where generated Python is executed — the place a wrong symbol
   actually costs a round trip.

## What NOT to build

- **Not a bpy-code RAG.** PoF's Blender path is a fixed authored script (`pof_mesh_finish.py`,
  `pof_triposr.py`, …) driven by argv, not LLM-written `bpy`. BlenderRAG's *technique* transfers;
  its *target* does not. Do not add LLM-generated Blender code in order to have something to
  ground.
- **Not a scraped corpus.** Both papers' quality comes from curation — AutoUE from real tool
  docs, BlenderRAG from 500 expert-validated examples. A scrape of forum posts would inject
  confident wrong answers into every prompt, which is strictly worse than the current
  introspect-first rule.
- **Not runtime code generation into the ensemble.** See
  [weak-verifier-ensemble-spec.md](./weak-verifier-ensemble-spec.md).

## Build order

1. **Corpus first, retrieval second.** Build the example set from what PoF has already PROVEN:
   the probe series (`conform`, `cloth_probe2d`, `rig_transfer_probe`, the physics-settle probe)
   plus every committed `Content/Python/*` script that has actually run headless. Each entry:
   task description → the exact call that worked → the observed result. Target ~200-500 entries;
   BlenderRAG got its lift at 500.
2. **Prove the lift before wiring.** Hold out a set of UE Python tasks, run them with and
   without retrieval, and measure the same thing the papers measured: **does the generated call
   execute**. A/B against a control — a passing unit test cannot see this.
3. **Wire into the prompt builder** as a section beside the gotchas block, retrieved per-task,
   with the retrieved excerpts named in the prompt so a reader can see what grounded it.
4. **Per-node retrieval, not per-task**, if PoF ever generates graph-shaped output (PCG,
   Dataflow, AnimBP). That is AutoUE's actual contribution and the reason its node-level
   numbers are 100% — a single task-level retrieval would not have reached it.

## The part PoF should NOT copy from AutoUE

AutoUE's "automated play-testing" generates runtime commands, executes them through MCP,
captures screenshots and logs — and then **grades with an LLM judge on a 1-10 scale** (Scene
9.90, Gameplay 8.25, Visual 7.78). There is no ground-truth pass/fail anywhere in the loop.
PoF's Tiers of Truth and its L3/L4 gates are strictly stronger than this, and the whole
`statusModel` doctrine exists to refuse exactly that substitution. Take AutoUE's **grounding**
and its **per-node retrieval**; leave its evaluation.
