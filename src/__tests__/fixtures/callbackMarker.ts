/**
 * Canonical `@@CALLBACK…@@END_CALLBACK` marker fixture.
 *
 * Single source of truth for the marker wire format in tests — it mirrors what
 * `buildCallbackSection` emits and what the shared `parseCallbackMarker`
 * (cli-task) parses for BOTH consumers of the format: the client terminal
 * (`extractCallbackPayload` → `{ callbackId, payload }`) and the server-side
 * `awaitCallback` (cli-service, which wants the parsed object).
 */
export const CALLBACK_MARKER_FIXTURE = {
  /** The callback id on the marker line (no constrained prefix). */
  callbackId: 'cb-1717000000000-1',
  /** The trimmed JSON body between the markers. */
  payload: '{\n  "completed": true,\n  "count": 5\n}',
  /** The parsed JSON body. */
  data: { completed: true, count: 5 },
  /** A full assistant-output blob with the marker embedded among other text. */
  text: [
    'Here are the results of the run.',
    '@@CALLBACK:cb-1717000000000-1',
    '{',
    '  "completed": true,',
    '  "count": 5',
    '}',
    '@@END_CALLBACK',
    'All done.',
  ].join('\n'),
} as const;
