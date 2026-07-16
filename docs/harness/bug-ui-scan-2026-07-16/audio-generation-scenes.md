# Audio Generation & Scenes — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Event catalog is a single global store shared by every audio scene
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/content/audio/audioEventCatalogStore.ts:18 (consumed from src/components/modules/content/audio/AudioEventCatalog/index.tsx:39-49)
- **Scenario**: User has two audio scene docs, "Dungeon" and "Overworld". While "Dungeon" is active they open the Event Catalog tab and add/edit an event (e.g. rename "Boss Theme" or change its cooldown). They switch the left sidebar to "Overworld" and open its Event Catalog tab.
- **Root cause**: `useAudioEventCatalogStore` is a single zustand `persist` store keyed by the fixed localStorage key `pof-audio-event-catalog`, with no scene/doc id in its shape. `AudioEventCatalog` is mounted per-scene (inside `AudioView`'s tab content, scoped visually to `activeDoc`) but reads/writes this same global store regardless of which scene is active — it takes no `sceneId` prop at all.
- **Impact**: Edits made while curating one scene's catalog silently overwrite the "shared" catalog seen under every other scene, and the change persists across reloads. Users reasonably assume the catalog is scene-local (it's tabbed under a specific scene) but it is really one mutable, persisted, cross-scene singleton — a correctness/data-isolation bug that can surface as "my events changed by themselves" when switching scenes.
- **Fix sketch**: Key the store by `activeDoc.id` (`Record<number, AudioEvent[]>`) or thread a `sceneId` prop into `AudioEventCatalog` and namespace the persisted key per scene.

### 2. Dragging a sound emitter across a zone boundary never reparents it
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/audio/AudioScenePainter/useAudioScenePainter.ts:136-148
- **Scenario**: Paint "Zone A" and "Zone B" side by side. Drop an emitter inside Zone A (it auto-assigns `zoneId: 'zone-A'` via `findContainingZone` at creation time — see line 92). Drag the same emitter, in Select mode, until it visually sits fully inside Zone B.
- **Root cause**: The `dragState.type === 'zone' | 'emitter'` branch of `handleMouseMove` only updates `x`/`y`; `findContainingZone` is only invoked once, at emitter-creation time (`handleCanvasMouseDown`'s `paintMode === 'emitter'` branch). Nothing re-derives `zoneId` on move or on mouse-up.
- **Impact**: `EmitterLayer` keeps drawing the zone-link connector and membership ring to the stale parent zone (Zone A) even though the emitter is visibly inside Zone B, and any zone-scoped generation (reverb preset, soundscape description, occlusion) that keys off `emitter.zoneId` continues to treat it as belonging to Zone A. The visual "child of this zone" cue actively misleads the user.
- **Fix sketch**: On `handleMouseUp` (or during the emitter drag branch), recompute `findContainingZone(pt.x, pt.y, zones)` and patch `zoneId` into the updated emitter before calling `onUpdateEmitters`.

### 3. Scene deletion has no confirmation, unlike every other destructive action in the module
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/audio/AudioView/index.tsx:154-160
- **Scenario**: User reaches for the "Generate Audio System" button in the scene header and misclicks the adjacent trash icon instead.
- **Root cause**: The header's `onClick={() => deleteDoc(activeDoc.id)}` fires immediately with no guard. Contrast with `AudioLibraryPanel.handleDeleteSet` (src/components/modules/content/audio/AudioLibraryPanel.tsx:95-99), which gates the equivalent action behind `if (!confirm('Delete this set and all its variations?')) return;`. The in-canvas zone/emitter delete-× buttons (ZoneLayer.tsx:144-153, EmitterLayer.tsx:140-149) are similarly unconfirmed.
- **Impact**: A single misclick permanently destroys an entire scene — all zones, emitters, descriptions, and code-gen history — with no undo path.
- **Fix sketch**: Reuse the same `confirm(...)` (or an in-app confirmation modal) pattern already established in `AudioLibraryPanel` for scene deletion, and consider it for the canvas zone/emitter deletes too.

### 4. Pitch range sliders allow min > max with no cross-field validation
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/content/audio/AudioPropertyPanel/index.tsx:229-232
- **Scenario**: Select an emitter, drag "Pitch Max" down to 0.6 while "Pitch Min" is still 1.2 (or vice versa) — both sliders independently allow the full [0.5, 2] range.
- **Root cause**: Each `SliderField` only clamps its own value against its own `min`/`max` prop; nothing compares `pitchMin` against `pitchMax` when either changes.
- **Impact**: The saved emitter has an inverted pitch range with no visual warning. Downstream UE5 code generation that assumes `pitchMin <= pitchMax` (e.g. `FMath::FRandRange(pitchMin, pitchMax)`) either silently auto-swaps (masking the authoring mistake) or produces a range no artist intended.
- **Fix sketch**: When updating `pitchMin`, clamp it to `Math.min(value, emitter.pitchMax)` (and symmetrically for `pitchMax`), or surface an inline warning when min > max.

### 5. "Sound Pool Size" / "Max Concurrent Sounds" ignore their documented upper bound
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/content/audio/AudioView/SettingsTab.tsx:22-28, 36-42
- **Scenario**: Type `99999` directly into the "Sound Pool Size" number input (labelled/attributed `max={256}`) or "Max Concurrent Sounds" (`max={128}`).
- **Root cause**: The `onChange` handler only enforces the floor — `Math.max(1, Number(e.target.value))` — never clamping against the upper bound that the `max` HTML attribute advertises (native `<input type="number" max>` does not prevent typed/pasted values from exceeding it).
- **Impact**: An arbitrarily large pool size gets persisted via `updateDoc` and flows into audio system code generation with no server-side guard visible in this component, producing a nonsensical/expensive allocation count in generated UE5 C++.
- **Fix sketch**: Mirror the min clamp with a max clamp, e.g. `Math.min(256, Math.max(1, ...))`.

## UI findings

### 6. Ten-item tab bar has no overflow handling on narrow viewports
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/audio/AudioView/index.tsx:164-175
- **Scenario**: Resize the browser to a tablet-width viewport, or view the Audio module in a docked/narrower panel layout.
- **Root cause**: The tab bar is a plain `flex items-center gap-1 px-5` row of 10 `TabButton`s (Overview, Roadmap, Scene Painter, Event Catalog, Soundscapes, Settings, Code Gen, Auto Gen, Sound Forge, Library) with no `overflow-x-auto`, wrapping, or responsive collapse into an overflow menu.
- **Impact**: On narrower widths the trailing tabs (e.g. "Sound Forge", "Library") are clipped or pushed off-screen with no scroll affordance, making entire features unreachable.
- **Fix sketch**: Wrap the tab row in `overflow-x-auto` with a subtle scroll-shadow, or collapse low-priority tabs into a "More" dropdown below a breakpoint.

### 7. Generated code-gen file groups render in non-deterministic order
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/audio/AudioCodeGenPanel.tsx:78-88, 169
- **Scenario**: Run "Generate C++ Code" twice on the same scene (or on two different scenes) and compare the order of the category cards (Reverb Presets / Sound Attenuation / Audio Volumes / Emitter Spawner / MetaSounds / Scene Manager).
- **Root cause**: `grouped` is built by iterating `result.files` and inserting into a `Map` in first-seen order, then spread to `[...map.entries()]` — the display order tracks whatever order the API happened to emit files in, not the canonical `CATEGORY_META` ordering already defined at the top of the file (line 18-25).
- **Impact**: The section order shuffles between generations, undermining the "read top-to-bottom by architectural layer" mental model the category icons/colors are clearly trying to establish.
- **Fix sketch**: Sort `grouped` by the fixed key order of `CATEGORY_META` before rendering.

### 8. Zone name labels can overflow and overlap neighboring zones on small/dense layouts
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/audio/AudioScenePainter/ZoneLayer.tsx:113-127
- **Scenario**: Draw a small rectangular zone (the minimum accepted draw size is only `w > 20 || h > 20`, per `useAudioScenePainter.ts:157`) and give it a longer name; place it near another zone.
- **Root cause**: The label background rect width is computed as `Math.max(80, zone.name.length * 6 + 10)` with no relation to the zone's actual `width`/`height`, and is drawn at a fixed offset from the zone's corner (`zone.x + 8`) regardless of available space.
- **Impact**: On small zones or dense clusters, the name/reverb-preset label plate extends well past the zone's own boundary and visually overlaps neighboring zones' bodies or labels, making it hard to tell which label belongs to which zone in a busy scene — the exact area (Scene Painter) where legibility matters most.
- **Fix sketch**: Clamp/truncate the label to the zone's rendered width (with a tooltip for the full name), or anchor small-zone labels outside the zone bounds consistently (as circles already do above the shape) instead of inside a possibly-too-small rect.

### 9. Inconsistent styling between near-identical numeric inputs in the same module
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/audio/AudioView/SettingsTab.tsx:22-28 vs src/components/modules/content/audio/AudioEventCatalog/EventEditor.tsx:155-173
- **Scenario**: Open Settings → "Sound Pool Size" input, then open Event Catalog → edit an event → "Max Simultaneous"/"Cooldown ms" inputs.
- **Root cause**: Both are plain `<input type="number">` fields serving the same purpose (a bounded integer/ms value) in the same Audio module, but use different tokens: SettingsTab uses `px-3 py-2 ... rounded-md` with left-aligned, non-monospace text; EventEditor uses `px-4 py-2.5 ... rounded-xl font-mono text-center`.
- **Impact**: Two visually distinct numeric-input styles appear across tabs of the same feature with no functional reason for the divergence, reading as an inconsistent design system rather than an intentional visual distinction.
- **Fix sketch**: Extract a shared `NumberField` control (mirroring the already-shared `Field`/`SliderField` pattern in `AudioPropertyPanel/controls.tsx`) and use it in both places.
