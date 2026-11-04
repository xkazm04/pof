# Lane: ghost-powers (Hauler and Gearbox, playable)

**Owner decision:** prototype **Hauler** and **Gearbox** first. Canon (`C:\Users\kazda\kiro\pof\games\gtai\pitch.md` §4, §5): Rivet carries the souls of dead robots from his line; each soul changes his look and gives a special ability with upgrades. The souls are the comedy engine (they argue and heckle). The Madness meter (pitch §5) is both power and cost.
- **Hauler** (heavy press and haul bot): **tank transform**, Rivet becomes a large tank robot for N seconds. Upgrade path: duration, cannon, stomp shockwave, ramming armour. The owner also said Rivet "can grow large if later in game transformed into bulky ghost": this is that form.
- **Gearbox** (delivery and driver bot): **car manipulation**, remote-hijack any car in view. Upgrades: range, residue (a car keeps driving your last order), two cars at once, car bomb. The vehicles lane built the soul-hijacked car state (`soul_hijack_traffic(slot)`, teal plate) and `VehicleService`.

**You own:** `features/souls/**` (create: the power framework, Hauler, Gearbox), the power table `data/tables/powers.json`, the bulky ghost form's rig plan (a new `RivetPlan.FORMS` row; the night `rivet_ghost` body class is reserved at 0.9 m / 600 kg in `bodies.json`), the power input bindings (a minimal change to the input table, recorded), and `data/tables/arena_stations/ghost-powers.json`.
The soul **trail** behind Rivet stays off (owner verdict); powers are not the trail. Teal is the souls' colour.

## Read first
- `docs/day/2026-11-03/vehicles/REPORT.md` (the hijack and soul states), `collisions/REPORT.md` (body classes, the tackle matrix), `d5-cast/REPORT.md` (`RivetPlan.FORMS`, the ghost-form hook).
- Registry: `ability-authoring-to-engine`, `realtime-combat-semantics`, `combat-pacing-and-dramatic-arc`.

## Work order
1. **A power framework:** activation, duration, cooldown, a resource (tie it to the Madness meter as a stub: using a soul raises it), interruption rules, and the hook for each soul's voice line (a bark id; audio comes later). Data-driven.
2. **Hauler:** the transform (a short, readable morph; Rivet grows to the `rivet_ghost` body class, so the tackle matrix makes him knock down humans AND robots while transformed), heavy movement (slower turn, momentum), ram (charge through bodies and cars), stomp (radial shockwave: knockdown, short stun). The look: a bulky teal ghost-tank silhouette on the cutout rig; make it from Rivet's parts scaled and armoured first, and ASK before generating new art.
3. **Gearbox:** target a car in view (a soft lock on the nearest car under the reticle, with a range), take control: the car drives where Rivet aims or steers toward a marked enemy, then crashes (using the vehicles lane's damage and wreck states). Rivet stays on foot and vulnerable while steering, which is the cost.
4. **ASK the owner** with clips: the Hauler transform look (2-3 options), its duration and cooldown, and Gearbox's control scheme (aim-to-steer vs target-and-launch).
5. **Station** `arena_stations/ghost-powers.json` on the powers pad.

**Proof:** clips at 32 and 48 px/m of both powers used against a wave and in the city block; numbers (kills per activation, time transformed); scenario tests with planted faults.

**Branch:** `e-powers`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\ghost-powers\`.
