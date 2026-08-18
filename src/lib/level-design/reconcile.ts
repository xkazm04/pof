/**
 * Reconciling one divergence in the DOC-ADOPTS-CODE direction.
 *
 * A divergence has two honest resolutions and the panel offers both:
 *   - **Fix code** dispatches the reconcile CLI task — the C++ is edited to match
 *     the design document (the pre-existing behaviour of the "Fix" button);
 *   - **Adopt code** is this module — the design document takes the value the
 *     code already has, locally, with no CLI round trip.
 *
 * The second direction only works for divergences that name a field the document
 * actually HAS. The sync report's `field` is free text written by an LLM, so an
 * unmappable field (`spawnCount`, `waveConfig`, …) must be REFUSED with a reason
 * rather than guessed at — a wrong adopt silently rewrites a designer's level.
 *
 * Adopting never touches `syncStatus` or `lastCodeHash`: the stored verdict was
 * produced by a comparison against a specific version of the code, and editing
 * the doc afterwards does not re-verify anything. The row disappears from the
 * report; the verdict stands until the next Check Sync.
 */

import type {
  LevelDesignDocument,
  RoomNode,
  RoomType,
  PacingCurve,
  DifficultyLevel,
  SyncDivergence,
} from '@/types/level-design';
import { ok, err, type Result } from '@/types/result';

const ROOM_TYPES: readonly RoomType[] = [
  'combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub',
];
const PACING_CURVES: readonly PacingCurve[] = ['rising', 'falling', 'peak', 'rest', 'buildup'];

/** Normalise an LLM-written field name so `Room Name`, `roomName` and `room_name` agree. */
function normalizeField(field: string): string {
  return field.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Split a delimited list value ("A.cpp, B.cpp") into its entries. */
function splitList(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Apply one code value to one room. Returns the reason when the named field is
 * not a single adoptable field on a room.
 */
function applyField(room: RoomNode, field: string, codeValue: string): Result<RoomNode, string> {
  switch (normalizeField(field)) {
    case 'name':
    case 'roomname': {
      if (!codeValue.trim()) return err('The code value is empty — a room cannot adopt an empty name.');
      return ok({ ...room, name: codeValue.trim() });
    }
    case 'description':
      return ok({ ...room, description: codeValue });
    case 'encounterdesign':
    case 'encounter':
      return ok({ ...room, encounterDesign: codeValue });
    case 'difficulty': {
      const n = Number(codeValue);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return err(`"${codeValue}" is not a difficulty between 1 and 5, so the document cannot adopt it.`);
      }
      return ok({ ...room, difficulty: n as DifficultyLevel });
    }
    case 'pacing': {
      const v = codeValue.trim().toLowerCase();
      if (!(PACING_CURVES as readonly string[]).includes(v)) {
        return err(`"${codeValue}" is not one of ${PACING_CURVES.join(', ')}, so the pacing cannot be adopted.`);
      }
      return ok({ ...room, pacing: v as PacingCurve });
    }
    case 'type':
    case 'roomtype': {
      const v = codeValue.trim().toLowerCase();
      if (!(ROOM_TYPES as readonly string[]).includes(v)) {
        return err(`"${codeValue}" is not one of ${ROOM_TYPES.join(', ')}, so the room type cannot be adopted.`);
      }
      return ok({ ...room, type: v as RoomType });
    }
    case 'linkedfiles':
    case 'files':
      return ok({ ...room, linkedFiles: splitList(codeValue) });
    case 'tags':
      return ok({ ...room, tags: splitList(codeValue) });
    default:
      return err(
        `The design document has no single "${field}" field on a room to adopt. ` +
        'Use "Fix code" to change the C++ instead, or edit the room by hand.',
      );
  }
}

export interface AdoptCodePatch {
  rooms: RoomNode[];
  /** The report with this divergence removed — everything else is untouched. */
  syncReport: SyncDivergence[];
}

/**
 * Build the document patch that makes the doc adopt the code's value for one
 * divergence, or the reason it cannot be adopted automatically.
 */
export function adoptCodeValue(
  doc: LevelDesignDocument,
  divergence: SyncDivergence,
): Result<AdoptCodePatch, string> {
  const index = doc.rooms.findIndex((r) => r.id === divergence.roomId);
  if (index === -1) {
    return err(
      `Room "${divergence.roomName || divergence.roomId}" is no longer in this design document — run Check Sync again.`,
    );
  }

  const applied = applyField(doc.rooms[index], divergence.field, divergence.codeValue);
  if (!applied.ok) return err(applied.error);

  const rooms = doc.rooms.map((r, i) => (i === index ? applied.data : r));
  const syncReport = doc.syncReport.filter(
    (d) => !(d.roomId === divergence.roomId && d.field === divergence.field),
  );
  return ok({ rooms, syncReport });
}
