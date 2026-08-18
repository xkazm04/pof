/**
 * How an edit made in a level-design editor should reach the server.
 *
 * The three values map one-to-one onto `useDocCommitBuffer`'s methods:
 *   - `stage`    → local only, zero writes (a drag's mouse-move frames)
 *   - `debounce` → local now, one write after the typing/repeat pause (text, key nudge)
 *   - `commit`   → local now, write now (discrete acts: mouseup, a click, add/delete)
 *
 * Callers that omit the mode get `commit`, so an editor rendered without a
 * buffer (previews, tests) behaves exactly as it did before the buffer existed.
 */
export type EditCommitMode = 'commit' | 'stage' | 'debounce';
