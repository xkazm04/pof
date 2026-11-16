# GTAI: can Godot 4.x carry a GTA 2-scale city? (research, 2026-11-02)

Convention: **[S]** = found in a cited source. **[E]** = my estimate or inference, not found in a source. **[L]** = from the local spike files. Web search was thin for this niche; "not found" means my search did not surface it, not that it does not exist.

## Verdict

Feasible, but not for free, and nobody has shipped it on Godot. The spike's number (about 51 fps average, 26 fps 1% low at 201 actors, 10-15 ms GDScript sim [L]) measures a naive worst case: every actor simulated and drawn every frame, one canvas command batch per actor, in GDScript, on a machine shared with other lanes. It does not measure what GTA 2 actually needs, which is a few hundred active actors near the camera plus a cheap or absent simulation elsewhere [E]. With streamed chunks, an activity bubble, and one native (GDExtension) per-frame sim-and-draw-list call over packed arrays, a 300-400 actor bubble inside a 6-7 ms CPU budget is plausible [E: roughly 15-20 us per actor against the spike's 50-75 us]. No commercial Godot GTA-like or open-city game turned up, and the closest large-swarm shipper (Lumencraft) had to modify the engine in C++ [S]. So the honest position is "feasible with a 1-2 week go/no-go prototype first", not "proven". Do not descope the city on the strength of the spike alone; descope to "districts loaded one at a time" only if the prototype misses its gate (section 4). What descoping would lose: seamless cross-district driving and chases, and a persistent city that feels continuous; it would gain loading screens, a smaller memory footprint and a much simpler streaming layer.

## 1. Precedent on Steam

| Title | Godot | Genre / scale | Signal | Source |
|---|---|---|---|---|
| Brotato | version not found | top-down arena shooter, horde waves | over 10M copies by 2025 (Wikipedia); Metacritic 76; a third-party tracker estimates about 3M Steam copies, so treat the 10M as the upper bound | Wikipedia, raijin.gg |
| Halls of Torment | version not found | top-down horde survivor, "denser hordes" (no count published) | over 1M units Oct 2024, 70k in first EA week; Metacritic 88; PS5/Xbox released Oct 2025 | Wikipedia; GodotFest 2025 talk (abstract only, covers profiling and a custom-compiled editor, no numbers) |
| Lumencraft | Godot 3 plus custom C++ engine changes | top-down shooter, base building, "thousands of swarm monsters" | 20,000 copies in week one (headline); Linux build works "almost out of the box" on Steam Deck | godotengine.org showcase; GamingOnLinux |
| Backpack Battles | version not found | not relevant by genre | 500k copies in two weeks (Mar 2024); native Linux and Steam Deck | GamingOnLinux |
| Slay the Spire 2 | Godot (reported C#) | card game; proves studio-scale commitment to Godot, not worlds | peak 427,900 concurrent at EA launch (Mar 2026); moved from Unity after about two years | gamesmarket.global, 80.lv |
| Dome Keeper | migrated to Godot 4 in Jul 2024 | small top-down mining | upgrade broke mods; fixes worked on with the Godot Foundation | GamingOnLinux |
| Lawfare: El Huevon (WIP, solo) | 4.6 | 2D top-down open-world crime game | not released; lane-node traffic with lights, queueing, ped avoidance, no global traffic manager; no counts or timings given | Godot forum |
| 2D Crime City (WIP) | 4.4.1 | pixel top-down crime city | not released | Godot forum |
| Naval RTS "5019" (WIP) | 4 | about 1,000 units, 2D canvas | 400 units in view: 29 to 15 ms/frame; draw pass 8.7 to 2.2 ms; canvas commands per unit about 10 to 2 | Godot forum |

Reading: Godot demonstrably ships very large commercial top-down action hits (Brotato, Halls of Torment, Lumencraft), and the hit horde games are actor-count evidence, but their enemy counts are not published. I found no shipped Godot GTA-like, open-city or traffic sim, and no public post-mortem that gives Godot performance limits with numbers. Fragments only: an indie devlog about hitting GDScript limits, a Godot 3-era devlog at 7 FPS with 120 enemies, and a Reddit survivor-clone benchmark where GDScript, C# and Rust all dropped below 50 FPS at roughly 250 `CharacterBody2D` enemies (single informal test; it says that when most time is Godot API calls, language matters little). That last item supports the spike's choice to avoid physics bodies.

## 2. Scaling techniques and expected gain

- **World streaming.** Godot has no world partition; I found no streaming addon. Primitives exist: `ResourceLoader.load_threaded_request` (merged 2020, reduz measured 4-6x faster loading; blocking `load_threaded_get` on the main thread can deadlock) [S]. Forum reports: `TileMapLayer.set_cell` is not thread-safe, per-cell loops freeze the game, off-tree building plus `call_deferred` works until it crashes, autotiling blocks chunking [S]. Implication [E]: do not stream scenes. Stream plain data (PackedArrays: tile ids, static props, lane and sidewalk graph, spawn-density map) prepared on a worker thread, and have the main thread create a couple of canvas items per chunk through `RenderingServer`. About 300-500 lines of in-house code; gain is eliminating load hitches, which the spike already saw (100 ms to 2.5 s frames, cause unknown [L]).
- **Simulation LOD / activity bubble.** Pure design, no Godot dependency. GTA 2 itself populated only the area around the player [E, from general knowledge of the game, not sourced]. Gain [E]: the largest lever, 3-5x fewer simulated actors than "everything in the district".
- **Rendering.** Official docs: servers directly for thousands of per-frame instances; MultiMesh "up to millions in one go" but no per-instance culling, so use several per area; `multimesh_set_buffer()` takes the whole state from linear memory and can be built on threads; GDExtension C++ "should be extremely efficient" [S]. 2D batching reached the Forward+/Mobile renderers in 4.4 dev 3, most visible with repeated sprites sharing a texture, tilemaps, bullet hell [S]. A forum test on 4.2.1 showed `RenderingServer` canvas items only 5-8% faster than `Sprite2D` at 4,096 items (about 250-270 fps), so skipping nodes alone buys little; a commenter reported about 30,000 MultiMesh meshes at 80 fps (anecdote) [S]. The naval RTS devlog got a 4x draw-pass cut by culling, baked frames per heading lookup and fewer commands per unit [S]. Constraint: MultiMesh has no unique texture per instance, so use one atlas plus per-instance custom data (frame, heading) in the shader [S/E]. Estimate [E]: 3-4x on draw cost; the spike's 1024x9472 per-character atlases must become a few shared atlases.
- **CPU language.** Godot FAQ: C# and GDScript "within the same order of magnitude", C++ GDExtension "almost always faster", C# can lose when making many API calls (marshalling) [S]. Godot 4.0 developer remark: C# about 4x GDScript in naive cases [S, informal, 2022]. A GDNative-era Mandelbrot test: C++ 20-45x GDScript [S, informal, dated]. Typed GDScript uses optimized opcodes (no numbers in docs; a blog claims up to 59%, unverified) [S]. Takeaway [E]: pure-compute loops over packed arrays gain 10-30x natively; API-heavy code gains almost nothing, so the native module must take whole arrays per frame, never call per actor.
- **Data-oriented / ECS.** The Godot FAQ says data-oriented design pays off only with "dozens of thousands" of objects processed per frame [S]. GECS (GDScript ECS addon) exists, no benchmarks found; I could not confirm godot-flecs [S]. Inference [E]: at 300-600 actors the cost is per-actor API and draw overhead, not cache misses, so skip ECS addons; use struct-of-arrays inside the native module.
- **Navigation and traffic.** `NavigationServer2D` uses a thread pool for avoidance, and docs warn that avoidance with many agents is expensive; I found no agent-count benchmark [S]. The spike's `AStarGrid2D` worked first time [L], and a hobby crime game uses lane nodes for traffic [S]. Recommended [E]: authored lane graph for cars with intersection reservation (spike lesson: lanes and nav must be authored, jams needed a breaker [L]); pedestrians random-walk a sidewalk graph with spatial-hash separation, no RVO; one shared flow field toward the player for police chasers (flow fields suit one goal, per a gamedev.net expert comment [S]).
- **Steam / Deck / consoles.** GodotSteam ships a Godot 4 GDExtension (Steamworks SDK 1.62+); overlay works in exports, not in the editor; a 4.17 note says Windows projects are meant to work under Proton on Deck [S]. Godot docs: the only officially supported console is Steam Deck via Linux templates; W4 Games and others offer console ports [S]. Halls of Torment reached PS5/Xbox in Oct 2025 [S] (who ported it: not verified). Native Linux builds of Lumencraft and Backpack Battles run on Deck [S]. GodotSteam on this project is untested [L].

## 3. Proposed architecture [E throughout]

- **World:** 128 m x 128 m chunks (about one to two city blocks), city of roughly 8 x 8 to 12 x 12 chunks. Keep a 3 x 3 ring resident plus 1-ring prefetch; hard cap one chunk activation per frame. Static ground and building roofs baked to one or two textures per chunk; the riso halftone stays a single full-screen shader.
- **Bubble (around camera, not player):** Tier A, in view plus margin (about 80 m): full sim, max 80 pedestrians, 20 cars, 12 police/enemies. Tier B, out to about 160 m: lane-following only, no collision with props, no animation, max 120 pedestrians, 30 cars. Beyond: nothing simulated; a per-chunk density map respawns actors at the bubble edge, off screen. Police pursuers and mission-critical actors are promoted to Tier A and tracked as data records, so wanted state persists across chunks. Total about 260 actors, 400 hard cap.
- **Native (GDExtension C++, one call per frame):** spatial hash, pedestrian steering, car lane following and oriented-hull collision, circle-vs-rect collision, projectile step, and writing transforms and frame data straight into the `multimesh_set_buffer` array. **Stay in GDScript:** missions, wanted logic, HUD, input, spawn rules, police decisions (low frequency). Keep the current GDScript sim as the reference implementation with deterministic parity tests (the spike already has a seeded fixed-step sim [L]).
- **Frame budget at 60 fps (16.6 ms):** native sim 3 ms; render submission and MultiMesh upload 3 ms; GDScript gameplay 2 ms; nav, A* and flow field 1 ms; streaming main-thread share 0.5 ms; GPU-bound work overlaps; headroom 5-6 ms. Steam Deck target: 40 fps first (25 ms), same sim cost, test early.
- **Go/no-go gate (about 5-7 working days):** 400 actors in bubble tiers, one chunk streaming every few seconds, exported build on Deck-class hardware: CPU frame at most 7 ms on the desktop dev machine, 1% low above 45 fps, no frame over 50 ms during chunk swaps. If it fails, fall back to district-at-a-time loading.

## 4. Top 5 risks

1. **Native hot path slows agent iteration.** The spike's strength was a 3 s edit-to-frame loop [L]. A compile step and native crashes cost that. Mitigation: GDScript reference plus parity tests, a small stable C ABI-like surface (packed arrays in, packed arrays out), C# as the fallback if C++ friction is too high.
2. **Streaming and load hitches.** Unexplained 100 ms to 2.5 s frames already occurred [L]. Mitigation: data-only worker-thread prep, one activation per frame, prewarmed materials, built-in hitch telemetry in every run.
3. **Traffic and pedestrian behaviour quality (jams, deadlocks, stuck cars).** Mitigation: authored lane graph with intersection reservation, progress-based breakers, silent despawn of stuck off-screen cars.
4. **Texture and import cost of sprite atlases** (1024x9472 per robot [L]). Mitigation: shared atlases, 8-16 baked headings, or pre-render orthographic 3D to sprites in the art pipeline.
5. **Platform and engine-version risk:** GodotSteam, Deck performance and shader cost untested [L]; version migration bites (Dome Keeper's Godot 4 move broke mods [S]); no shipped Godot precedent for this genre. Mitigation: Deck and GodotSteam smoke test inside the gate milestone, pin one Godot version for the whole project.

## Sources

- Local: `C:\Users\kazda\kiro\gtai-spike\lanes\godot\REPORT.md`, `JOURNAL.md` (stress200 51.3 avg / 26.3 1% low; 10-15 ms sim).
- https://en.wikipedia.org/wiki/Brotato - engine Godot, sales, Metacritic.
- https://raijin.gg/app/1942280/Brotato - third-party sales estimate.
- https://en.wikipedia.org/wiki/Halls_of_Torment - Godot, sales, console release dates.
- https://media.ccc.de/v/godotfest2025-a-peek-under-the-hood-technical-learnings-from-halls-of-torment - talk abstract.
- https://godotengine.org/article/godot-showcase-2dynamic-games-lumencraft/ - Godot 3, custom C++ modules, swarms, Deck.
- https://gamingonlinux.com/2022/04/lumencraft-hits-20000-copies-in-the-first-week-roadmap-detailed - first-week sales.
- https://www.gamingonlinux.com/2024/03/backpack-battles-has-sold-500000-copies-in-two-weeks-on-steam - sales, Deck.
- https://www.gamesmarket.global/slay-the-spire-2-achieves-strongest-steam-launch-of-the-year-so-far/ - concurrency; https://80.lv/articles/slay-the-spire-2-is-sticking-with-godot-leaving-unity-behind/ - engine switch.
- https://gamingonlinux.com/2024/07/dome-keeper-a-keepers-duty-is-a-big-free-upgrade-out-now - Godot 4 migration.
- https://forum.godotengine.org/t/building-an-gta-inspired-open-world-crime-game-solo-showcasing-the-systems-ive-built-in-godot-4-6/137378 - lane traffic design.
- https://forum.godotengine.org/t/my-first-game-2d-crime-city-game/114936 - 2D crime city WIP.
- https://forum.godotengine.org/t/5019-naval-rts-in-godot-4-up-to-1-000-units/144774 - draw-cost numbers.
- https://forum.godotengine.org/t/2d-rendering-performance/45719 - Sprite2D vs RenderingServer vs MultiMesh numbers (4.2.1).
- https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html and https://docs.godotengine.org/en/stable/tutorials/performance/using_servers.html - MultiMesh and servers guidance.
- https://docs.godotengine.org/en/stable/about/faq.html - language performance, data-oriented design.
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html - typed GDScript opcodes.
- https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_using_navigationservers.html - nav threading; NavigationAgent2D docs for avoidance cost warning.
- https://github.com/godotengine/godot/pull/36640 - threaded loading API and 4-6x figure.
- https://forum.godotengine.org/t/chunking-system-causing-stutters/66007 and related TileMapLayer chunking threads (search result summary) - set_cell thread-safety, quadrant_size.
- https://godotengine.org/article/dev-snapshot-godot-4-4-dev-3/ - 2D batching for RD renderers.
- https://forum.godotengine.org/t/state-of-gdscript-vs-c-performance-in-godot-4-0/5875 - C# about 4x GDScript (informal).
- https://redlib.hbubli.cc/u/JerryShell (r/godot survivors benchmark) and https://github.com/AidarGiza - informal GDScript/C#/Rust/C++ enemy benchmarks, no figures retrieved.
- https://docs.godotengine.org/en/stable/tutorials/platform/consoles.html and https://gamefromscratch.com/godot-4-getting-console-support/ - consoles, W4 Games, Steam Deck.
- https://github.com/timenoe/GodotSteam - GodotSteam GDExtension notes.
- https://opper.ai/ai-roundtable/questions/would-you-use-gecs-library-in-godot-for-web-browser-24fae406 - opinion only on GECS at scale (weak).
