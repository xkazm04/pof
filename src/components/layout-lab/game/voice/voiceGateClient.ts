/**
 * Client-safe copies of the human-gate constants (`@/lib/voice/gate` is server-only: node:crypto).
 * Keep in step with `GATE_HEADER` / `GATE_TTL_MS` there; `voiceRoom.test.tsx` pins the header name.
 */
export const VOICE_GATE_HEADER = 'x-voice-gate';
export const VOICE_GATE_TTL_MS = 10 * 60 * 1000;
export const VOICE_API = '/api/games/gtai/voice';

export const NO_CLONE_NOTE = "Voices are designed from a text description only. Never imitate or clone a real person's voice; no recordings are uploaded.";
