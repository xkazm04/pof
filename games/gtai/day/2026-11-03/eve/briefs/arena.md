# Lane: arena (the test environment every other lane plugs into)

**Mission:** the place where combat, movement, enemies, powers and animation are designed, measured and judged. It must be quick to iterate in, honest in its numbers, and close enough to the real game that what feels right here also feels right in the city.

**You own:** `project/features/arena/**`, `project/dev/arena/**` (the scene and its boot), `project/data/tables/arena*.json` and the loader of `project/data/tables/arena_stations/*.json` (every other lane writes its own file there; you read them all), the tuning panel, the arena telemetry, and the city proving block's cordon.

## Work order
1. **The arena scene** (D5 look, 32 px/m default, zoom keys for 48/64/128), with these areas, each a "station":
   - **range:** firing lanes at 5 / 10 / 20 / 35 m, static and moving targets (strafing, approaching), a dummy that reports hits;
   - **pit:** an open floor with low and high cover and a few doors, where waves of enemies fight Rivet;
   - **course:** a movement course (slalom, corners, a narrow corridor, a crowd patch) to judge turning, strafing, sprint, roll and tackles;
   - **powers pad:** space and props for Hauler (things to stomp and ram) and Gearbox (parked and moving cars, a short road loop).
   Rivet is the real player Rivet (the merged slice's controller, input table and body), not a stand-in.
2. **Stations as data.** Load every `data/tables/arena_stations/*.json` (schema it: id, name, area, spawn list, props, the tuning keys it exposes, the measurements it reports). A lane adds a station by adding its file. Ship `arena_stations/arena.json` with the range and the course.
3. **The live tuning panel** (a dev overlay, toggled by a key): every number a station exposes (weapon, movement, enemy, power values) as a slider or field, changed live, with **save to the data table** and **reset**. Changes are logged so the owner's tuning is recorded.
4. **Telemetry, shown in the arena HUD and written to a JSON log per session:** time to kill per weapon and range, hit rate, damage taken, input-to-motion latency (frames from key press to visible motion), turn rate, dodges of enemy bullets, knockdowns. This is what "smooth" is measured with. Read `controller-latency-instrumentation` and `encounter-balance-simulation` in the registry.
5. **The city proving block:** one cordoned block of the real generated city (pick a junction with sidewalks and a plaza), with the same stations' spawns allowed there and the same telemetry. A flag `--arena=city` loads it.
6. **Recording:** a scripted-input scenario for each station that plays deterministically and replays identically, so every lane can capture timing-true clips of its station and the night run can regression-test feel.
7. **Ask the owner early** (the ASK protocol in the common brief): the arena's size and layout from a first frame, which stations matter most, and what the tuning panel must show.

**Proof:** clips of each station at 32 and 48 px/m, the panel changing a value live, a telemetry JSON, the city block. Scenario tests for the arena boot and each station's replay.

**Branch:** `e-arena`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\arena\`.
