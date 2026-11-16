# Lane handheld: readiness without a device

The owner kept every n9 handheld call as built: 60 Hz default with the player's 30 / 40 / 60 cap, pad assist on handheld rows only, no desktop boss cam, no text scale. **Do not reopen those.** Every number stays labelled as the PC simulator.

1. **Keep handheld green on the new main:** combo, 1.65 m Rivet and mailbox vsync all landed after your last run. Re-run your rows (`--device=deck`, `deck40`, `handheld_1080`, `switch-handheld`) and fix what they broke, including lane world's walls once they land (merge `n10-world` when it has them).
2. **Windows handheld model strings** for the auto-pick (`models`), from public documentation, with the source named in the LEDGER; leave unconfirmed ones out.
3. **The Steam backend checks** as far as they can go with no Steam app: `IsSteamRunningOnSteamDeck()` as the auto-pick's first check behind the same interface, and Steam Input origin glyphs stubbed so the swap is one call.
4. **The research loop** on `docs/handheld/LEDGER.md`: update the port readiness table. Stop when two ideas in a row give nothing the simulator can measure.
