/**
 * Prerendered-sprite acceptance (/diablo W05, decisions D16 + D18).
 *
 * Diablo I's monsters are 3D models rendered from ONE fixed diagonal camera and reduced to sprite
 * resolution; a text-to-image prompt cannot reach that look (W03: 0/5), a render of the rigged model
 * can (W04). This grades what a render RECORDS about itself: every direction present, the fixed
 * projection it was rendered with, and a frame size. It cannot see the pixels — whether the sprite
 * READS as its creature is the family check's job — so it is L1 and says so.
 */
import type { Checker } from './types';
import { tagRequiredFields } from './requiredFields';

/** Diablo I's projection: orthographic, 30° elevation, 45° azimuth (a 2:1 ground diamond). */
export const SPRITE_PROJECTION = { projection: 'orthographic', elevationDeg: 30, azimuthDeg: 45 } as const;
export const SPRITE_DIRECTIONS = 8;

export function spriteSetRendered(field: string, label: string): Checker {
  const checker: Checker = (data) => {
    const s = data[field] as Record<string, unknown> | undefined;
    const fail = (reason: string, status: 'pending' | 'fail' = 'pending') =>
      ({ label, tier: 'L1' as const, status, detail: reason, reason: `field "${field}": ${reason}` });
    if (!s || typeof s !== 'object') return fail('no sprite set rendered yet');
    const dirs = Array.isArray(s.directions) ? s.directions : [];
    // A requested-but-not-rendered set: the render runs OUTSIDE the lab (Blender headless), so this
    // is deferred with the command that runs it — never pending as if the lab could do it.
    if (dirs.length === 0) {
      return {
        label, tier: 'L3', status: 'deferred',
        detail: 'render requested, not run',
        reason: 'the sprite render runs outside the lab: `npx tsx scripts/diablo/render.ts --id <entity>` renders the rigged 3D & Rig mesh and records the set here',
      };
    }
    if (dirs.length !== SPRITE_DIRECTIONS) return fail(`${dirs.length} direction(s), needs ${SPRITE_DIRECTIONS}`);
    const cam = (s.camera ?? {}) as Record<string, unknown>;
    if (cam.projection !== SPRITE_PROJECTION.projection
      || Number(cam.elevationDeg) !== SPRITE_PROJECTION.elevationDeg
      || Number(cam.azimuthDeg) !== SPRITE_PROJECTION.azimuthDeg) {
      return fail(`rendered with ${String(cam.projection)} ${String(cam.elevationDeg)}°/${String(cam.azimuthDeg)}°, the canon needs orthographic 30°/45°`, 'fail');
    }
    const size = Number(s.frameSize);
    if (!(size > 0)) return fail('no frame size recorded');
    return {
      label, tier: 'L1', status: 'pass',
      detail: `${SPRITE_DIRECTIONS} directions · ${size}px · orthographic 30°/45° (recorded by the render; pixels not judged here)`,
    };
  };
  return tagRequiredFields(checker, {
    field,
    keys: ['directions', 'camera', 'frameSize'],
    shape: `directions: a JSON ARRAY of ${SPRITE_DIRECTIONS} rendered frames; camera: { projection: "orthographic", elevationDeg: 30, azimuthDeg: 45 }`,
  });
}
