# Lane rivet: a defect hunt, not new art

The owner kept every n9 Rivet call as built: 5 of 17 weapons have armed runs, no up-fire art wired, reload only standing, one arm bare and the claw armed. **Do not reopen those, and do not ask the asset lane for new Rivet art.**

Hunt defects on Rivet in the real game at combo, biggest first:
1. **Walk all 17 weapons** in the arena and quest 1 at 48 and 64 px/m: walk, run, fire in 8 directions, reload, knock-down and get-up. Log every wrong frame: hand on the wrong side, a pop between states, a card that slides, a muzzle off the barrel.
2. **Quest 1 start to end** (`--autostart`) as Rivet at 1.65 m: anything that clips through doors, props or dialogue framing, or that his new size broke.
3. **State transitions:** weapon swap while running, a roll into a shot, a knock-down during a reload, entering and leaving vehicles.
4. Add the missing bare-walk segment to the combined clip.

Every fixed defect gets a test that fails on the old code where one is possible, and a before/after frame. If a pass over all of this finds nothing further, stop as the common brief says.
