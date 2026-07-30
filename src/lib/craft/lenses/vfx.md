---
lensId: vfx
lensVersion: 1
ceiling: A4
appliesTo: vfx-particles deliverables (effect specs / Niagara graphs)
---

# Real-time game VFX — craft lens

Gauges authored effect specs and Niagara-style particle graphs against shipped AAA VFX practice: gameplay
readability first, disciplined timing phases, deliberate element layering, and declared performance budgets.
In PoF the deliverable is the spec/graph itself (text/config), so every criterion below is checkable against
stored numbers — timings, layer counts, budgets, parameter tables — not against a rendered frame.

## Benchmark anchors

- **A4 AAA-PARITY** — *Diablo III* (Blizzard: effects stay readable with dozens of simultaneous casters because
  every effect is built to a gameplay-information hierarchy); *Overwatch* (Blizzard: strict per-priority
  readability rules so combat clarity survives 12-player chaos); *League of Legends* (Riot: a codified,
  published clarity ruleset — value/saturation bands, hitbox-accurate AoE, timing stages — enforced at
  esports scale); *God of War* 2018 (Santa Monica: effects fully integrated with lighting, camera and hit
  timing rather than pasted on top).
- **A3 AA** — *Darksiders III*, *Remnant II* (Gunfire Games): professional, performant effect work that reads
  well, but without a codified readability system — priority conflicts and thematic drift appear under load.
- **A2 INDIE** — *Last Epoch*, *Chronicon*: shippable ARPG effects with honest timing and theming, but stock
  textures, flat layering, and no declared budgets; clarity degrades in dense endgame scenes.
- **A1 HOBBY** — single-emitter "fireball = orange sprite burst" work: no phase structure, no hierarchy between
  gameplay info and decoration, unbounded particle counts, effects that would not survive a professional
  review pass.

## Criteria

### gameplay-first-hierarchy — Gameplay-first element hierarchy
The spec must divide the effect into a primary element that communicates gameplay (danger area, damage type,
team/source, active window) and secondary elements that carry theme — and the primary must dominate. Telegraph
and AoE geometry declared in the spec must match the ability's actual hitbox/gameplay data exactly, not
approximately. A spec whose decorative layers outweigh or obscure its gameplay layer fails here regardless of
beauty.
Source: League of Legends VFX Style Guide — Riot Games, public edition, 2017

### readability-value-discipline — Value, saturation and clutter discipline
AAA teams reserve the brightest values and highest saturation for the most gameplay-important moments and
explicitly cap ambient/idle effects below them. The spec should declare value/brightness intent per layer
(e.g. core vs glow vs ambience) and show restraint rules: idle loops dimmer than casts, casts dimmer than
impacts. Checkable as declared color/alpha/emissive ranges and layer intensity ordering in the graph.
Source: League of Legends VFX Style Guide — Riot Games, public edition, 2017

### timing-phase-structure — Anticipation / climax / dissipation timing
Every effect must declare its three phases with concrete durations: a short anticipation that telegraphs, a
sharp climax frame-range where the gameplay event lands, and a dissipation that gets out of the way. Impact
effects front-load energy (fast attack on scale/alpha curves); lingering tails must not outlive the gameplay
relevance of the event. Gaugeable from spawn-rate, lifetime and curve keys stored in the spec.
Source: League of Legends VFX Style Guide — Riot Games, public edition, 2017

### element-layering-economy — Layer economy and motion reuse
Professional effects get richness from a small number of layers that each do one named job (core, glow,
debris, trail, distortion), and from cheap procedural motion — Blizzard's canonical two-texture trick
(tex1.a × tex2.a × 2) yields non-repeating motion from two static masks. The spec must enumerate its layers
with a purpose each; redundant layers doing the same job, or brute-force texture flipbooks where combined
masks would do, are the tell of non-professional work.
Source: "Technical Artist Bootcamp: The VFX of Diablo" — Julian Love, Blizzard Entertainment, GDC 2013

### niagara-graph-craft — Graph structure as maintainable code
Niagara's premise is a fully programmable pipeline: effects built from named, reusable modules with
user-exposed parameters, not opaque one-off emitter blobs. The graph/spec must expose its tunable surface
(scale, color, intensity, target sockets) as named user parameters, factor repeated logic into shared
modules, and declare deterministic seeds where reproducibility matters. A graph that cannot be re-skinned by
editing parameters fails this criterion.
Source: "Programmable VFX with Unreal Engine's Niagara" — Wyeth Johnson, Epic Games, GDC 2018

### performance-budget-declaration — Declared performance budget
Diablo-class ARPG VFX is engineered against fill-rate and particle-count budgets from the first sketch,
because the worst case is always "the whole screen is effects". The spec must declare max live particles per
emitter, expected overdraw strategy (particle size vs count trade), material cost class, and scalability/LOD
tiers for the many-enemies worst case. Absent numbers means ungoverned cost — an automatic gap versus
professional practice.
Source: "Technical Artist Bootcamp: The VFX of Diablo" — Julian Love, Blizzard Entertainment, GDC 2013

### environmental-integration — Integration with world and lighting
Shipped AAA effects are anchored in the scene: they attach to sockets, collide or project against surfaces,
respect scene lighting (lit vs emissive intent declared), and inherit velocity from their owner. The spec
must state attachment points, collision/projection behavior, and lighting mode rather than leaving effects
floating in screen space by default — the techniques Naughty Dog used (self-shadowed smoke, screen-space
projected particles) exist precisely to seat effects in the world.
Source: "The Tricks Up Our Sleeves: A Walkthrough of the Latest Techniques Behind FX of Uncharted 3: Drake's Deception" — Keith Guerrette, Naughty Dog, GDC 2012

### shape-language-theming — Shape language and thematic consistency
An effect kit must share a declared shape language (e.g. jagged/ember/ash for PoF's dark-fantasy canon) so
every ability of a character or damage school reads as one family, while staying inside the readability rules
above. The spec should name its shape/silhouette vocabulary and color family per element type and reuse it
across the kit; one-off effects that ignore the kit's language mark sub-professional art direction.
Source: League of Legends VFX Style Guide — Riot Games, public edition, 2017

## Scoring guidance

- **A1 → A2**: effect has real phase structure (declared anticipation/climax/dissipation) and at least a
  primary/secondary layer split; particle counts are bounded somewhere.
- **A2 → A3**: full layer enumeration with per-layer purpose, hitbox-accurate telegraphs, named exposed
  parameters, and an explicit particle/overdraw budget with numbers.
- **A3 → A4**: a codified system — value/saturation discipline stated as rules, kit-wide shape language,
  scalability tiers for the worst case, and motion economy (procedural masks over flipbook brute force)
  applied throughout; indistinguishable in rigor from the Riot/Blizzard practice above.

DISQUALIFIERS (caps the score regardless of other strengths):
1. Telegraph/AoE visuals that do not match the declared gameplay hitbox — caps at A1.
2. No declared particle-count or cost bound anywhere in the spec — caps at A2.
3. Decorative layers declared brighter/larger than the gameplay-primary layer — caps at A2.
4. Monolithic graph with zero exposed user parameters (not re-skinnable) — caps at A2.
5. No timing numbers (lifetimes/curves all defaults) — caps at A1.

## Ceiling statement

Uncapped at A4: the deliverable here is spec-and-graph authorship — code-like artifacts — and the recorded
LLM-market bet is that effect authorship-as-code reaches parity with AAA VFX practice; capped mesh/texture
inputs are gauged under other lenses.
