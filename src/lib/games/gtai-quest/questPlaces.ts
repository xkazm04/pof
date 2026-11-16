/**
 * Places: a quest may name only places the world has. The runtime resolves a beat's `location` against the
 * places table's markers, a vehicle verb's `target` against its vehicles, any other verb's target against its
 * actors, and an encounter verb's location against its encounters (`quest_beat_validator.gd`). The table
 * (`gtai.questMarkers/1`, e.g. `collect_call_places.json`) is the world's: it is staged after a quest is
 * designed, so a quest with no table yet is simply not place-checked. Pure; the caller reads the file.
 */
import { err, ok, type Result } from '@/types/result';
import type { GuardFinding, QuestDesign, QuestPlaces, QuestRules } from '@/lib/games/gtai-quest/types';

export const QUEST_PLACES_SCHEMA = 'gtai.questMarkers/1' as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseQuestPlaces(raw: unknown): Result<QuestPlaces> {
  if (!isObject(raw)) return err('places table is not an object');
  if (raw.schema !== QUEST_PLACES_SCHEMA) return err(`schema is ${JSON.stringify(raw.schema)}, expected ${QUEST_PLACES_SCHEMA}`);
  const keys = (section: unknown, name: string, required: boolean): Result<string[]> => {
    if (section === undefined && !required) return ok([]);
    return isObject(section) ? ok(Object.keys(section)) : err(`${name} is missing or not an object`);
  };
  const markers = keys(raw.markers, 'markers', true);
  const vehicles = keys(raw.vehicles, 'vehicles', true);
  const actors = keys(raw.actors, 'actors', true);
  const encounters = keys(raw.encounters, 'encounters', false);
  for (const r of [markers, vehicles, actors, encounters]) if (!r.ok) return err(r.error);
  return ok({ markers: markers.ok ? markers.data : [], vehicles: vehicles.ok ? vehicles.data : [], actors: actors.ok ? actors.data : [], encounters: encounters.ok ? encounters.data : [] });
}

/** Every location, target and encounter a beat uses that the places table does not have. */
export function placeFindings(design: QuestDesign, rules: QuestRules, places: QuestPlaces): GuardFinding[] {
  const out: GuardFinding[] = [];
  const err = (code: string, message: string, ref: string) => out.push({ code, severity: 'error', message, ref });
  for (const beat of design.beats) {
    const { verb, target, location } = beat.objective;
    const row = rules.verbs.find((v) => v.id === verb);
    if (!row) continue; // an unknown verb is already named by the verb check
    if (row.needsTarget && target?.trim()) {
      const pool = row.targetIsVehicle ? places.vehicles : places.actors;
      if (!pool.includes(target)) err('VOCAB_UNKNOWN_TARGET', `target "${target}" is not a ${row.targetIsVehicle ? 'vehicle' : 'actor'} in the places table (${pool.join(', ') || 'none'})`, beat.id);
    }
    if (row.needsLocation && location?.trim()) {
      if (!places.markers.includes(location)) err('VOCAB_UNKNOWN_PLACE', `location "${location}" is not a marker in the places table (${places.markers.join(', ')})`, beat.id);
      else if (row.needsEncounter && !places.encounters.includes(location)) err('VOCAB_NO_ENCOUNTER', `"${location}" holds no encounter for "${verb}" (encounters: ${places.encounters.join(', ') || 'none'})`, beat.id);
    }
  }
  return out;
}
